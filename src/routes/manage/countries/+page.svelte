<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let countries: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingCountry: any = null;

  // Form fields
  let formData = {
    name: "",
    iso_code: "",
    flag: "",
  };

  onMount(async () => {
    await loadCountries();
  });

  async function loadCountries() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("country")
      .select("*")
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      countries = data || [];
    }
    loading = false;
  }

  function openCreateModal() {
    editingCountry = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(country: any) {
    editingCountry = country;
    formData = {
      name: country.name,
      iso_code: country.iso_code,
      flag: country.flag,
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingCountry = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      iso_code: "",
      flag: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name || !formData.iso_code || !formData.flag) {
      error = "Tous les champs sont obligatoires";
      return;
    }

    const countryData = {
      name: formData.name,
      iso_code: formData.iso_code,
      flag: formData.flag,
    };

    if (editingCountry) {
      const { error: updateError } = await supabase
        .from("country")
        .update(countryData)
        .eq("id", editingCountry.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("country")
        .insert(countryData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadCountries();
  }

  async function deleteCountry(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce pays ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("country")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadCountries();
  }
</script>

<svelte:head>
  <title>Pays - Gestion</title>
</svelte:head>

<ManagePageShell title="Pays">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouveau pays</button>
  </svelte:fragment>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if countries.length === 0}
    <div class="empty-state">
      <p>Aucun pays trouvé</p>
      <button class="btn-primary" on:click={openCreateModal}>
        Créer le premier pays
      </button>
    </div>
  {:else}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Code ISO</th>
            <th>Drapeau</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each countries as country}
            <tr>
              <td><strong>{country.name}</strong></td>
              <td>{country.iso_code}</td>
              <td>{country.flag}</td>
              <td>
                <div class="actions">
                  <button
                    class="btn-edit"
                    on:click={() => openEditModal(country)}
                  >
                    Modifier
                  </button>
                  <button
                    class="btn-delete"
                    on:click={() => deleteCountry(country.id)}
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
  title={editingCountry ? "Modifier le pays" : "Nouveau pays"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom du pays *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group">
        <label for="iso_code">Code ISO *</label>
        <input
          type="text"
          id="iso_code"
          bind:value={formData.iso_code}
          maxlength="3"
          required
        />
      </div>

      <div class="form-group">
        <label for="flag">Drapeau (emoji) *</label>
        <input type="text" id="flag" bind:value={formData.flag} required />
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingCountry ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>
