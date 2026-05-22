<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Appelation, Region, Label } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let appellations: Appelation[] = [];
  let regions: Region[] = [];
  let labels: Label[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingAppellation: Appelation | null = null;

  // Form fields
  let formData = {
    name: "",
    description: "",
    region_id: "",
    label_id: "",
  };

  onMount(async () => {
    await loadAppellations();
    await loadRegions();
    await loadLabels();
  });

  async function loadAppellations() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("appelation")
      .select(
        `
        *,
        region (
          *,
          country (*)
        ),
        label (*)
      `
      )
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      appellations = data || [];
    }
    loading = false;
  }

  async function loadRegions() {
    const { data } = await supabase
      .from("region")
      .select(
        `
        *,
        country (*)
      `
      )
      .order("name");
    if (data) regions = data;
  }

  async function loadLabels() {
    const { data } = await supabase.from("label").select("*").order("name");
    if (data) labels = data;
  }

  function openCreateModal() {
    editingAppellation = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(appellation: Appelation) {
    editingAppellation = appellation;
    formData = {
      name: appellation.name,
      description: appellation.description || "",
      region_id: appellation.region_id || "",
      label_id: appellation.label_id || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingAppellation = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      description: "",
      region_id: "",
      label_id: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name) {
      error = "Le nom de l'appellation est obligatoire";
      return;
    }

    const appellationData = {
      name: formData.name,
      description: formData.description || null,
      region_id: formData.region_id || null,
      label_id: formData.label_id || null,
    };

    if (editingAppellation) {
      const { error: updateError } = await supabase
        .from("appelation")
        .update(appellationData)
        .eq("id", editingAppellation.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("appelation")
        .insert(appellationData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadAppellations();
  }

  async function deleteAppellation(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette appellation ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("appelation")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadAppellations();
  }
</script>

<svelte:head>
  <title>Appellations - Gestion</title>
</svelte:head>

<ManagePageShell title="Appellations">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouvelle appellation</button>
  </svelte:fragment>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if appellations.length === 0}
      <div class="empty-state">
        <p>Aucune appellation trouvée</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer la première appellation
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Description</th>
              <th>Région</th>
              <th>Label</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each appellations as appellation}
              <tr>
                <td><strong>{appellation.name}</strong></td>
                <td>
                  {#if appellation.description}
                    <div class="description">{appellation.description}</div>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  {#if appellation.region}
                    <div class="region-name">
                      {#if appellation.region.country?.flag}
                        <span class="country-flag"
                          >{appellation.region.country.flag}</span
                        >
                      {/if}
                      {appellation.region.name}
                    </div>
                  {:else}
                    -
                  {/if}
                </td>
                <td>{appellation.label?.name || "-"}</td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(appellation)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteAppellation(appellation.id)}
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
  title={editingAppellation ? "Modifier l'appellation" : "Nouvelle appellation"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom de l'appellation *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group full-width">
        <label for="description">Description</label>
        <textarea id="description" bind:value={formData.description} rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="region_id">Région</label>
        <select id="region_id" bind:value={formData.region_id}>
          <option value="">Sélectionner une région</option>
          {#each regions as region}
            <option value={region.id}>{region.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="label_id">Label</label>
        <select id="label_id" bind:value={formData.label_id}>
          <option value="">Sélectionner un label</option>
          {#each labels as label}
            <option value={label.id}>{label.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingAppellation ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>

