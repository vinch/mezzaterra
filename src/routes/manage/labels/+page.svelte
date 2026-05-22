<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Label, Country } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let labels: Label[] = [];
  let countries: Country[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingLabel: any = null;

  // Form fields
  let formData = {
    name: "",
    country_id: "",
  };

  onMount(async () => {
    await loadLabels();
    await loadCountries();
  });

  async function loadLabels() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("label")
      .select(
        `
        *,
        country (*)
      `
      )
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      labels = data || [];
    }
    loading = false;
  }

  async function loadCountries() {
    const { data } = await supabase.from("country").select("*").order("name");
    if (data) countries = data;
  }

  function openCreateModal() {
    editingLabel = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(label: Label) {
    editingLabel = label;
    formData = {
      name: label.name,
      country_id: label.country_id || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingLabel = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      country_id: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name) {
      error = "Le nom du label est obligatoire";
      return;
    }

    const labelData = {
      name: formData.name,
      country_id: formData.country_id || null,
    };

    if (editingLabel) {
      const { error: updateError } = await supabase
        .from("label")
        .update(labelData)
        .eq("id", editingLabel.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("label")
        .insert(labelData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadLabels();
  }

  async function deleteLabel(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce label ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("label")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadLabels();
  }
</script>

<svelte:head>
  <title>Labels - Gestion</title>
</svelte:head>

<ManagePageShell title="Labels">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouveau label</button>
  </svelte:fragment>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if labels.length === 0}
      <div class="empty-state">
        <p>Aucun label trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier label
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Pays</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each labels as label}
              <tr>
                <td><strong>{label.name}</strong></td>
                <td>
                  {#if label.country}
                    <span>{label.country.flag} {label.country.name}</span>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(label)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteLabel(label.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
</ManagePageShell>

<Modal
  show={showModal}
  title={editingLabel ? "Modifier le label" : "Nouveau label"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom du label *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group full-width">
        <label for="country_id">Pays</label>
        <select id="country_id" bind:value={formData.country_id}>
          <option value="">Sélectionner un pays</option>
          {#each countries as country}
            <option value={country.id}>
              {country.flag}
              {country.name}
            </option>
          {/each}
        </select>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingLabel ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>

