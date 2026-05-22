<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Region, Country } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let regions: Region[] = [];
  let countries: Country[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingRegion: Region | null = null;

  // Form fields
  let formData = {
    name: "",
    country_id: "",
  };

  onMount(async () => {
    await loadRegions();
    await loadCountries();
  });

  async function loadRegions() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("region")
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
      regions = data || [];
    }
    loading = false;
  }

  async function loadCountries() {
    const { data } = await supabase.from("country").select("*").order("name");
    if (data) countries = data;
  }

  function openCreateModal() {
    editingRegion = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(region: Region) {
    editingRegion = region;
    formData = {
      name: region.name,
      country_id: region.country_id || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingRegion = null;
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
      error = "Le nom de la région est obligatoire";
      return;
    }

    const regionData = {
      name: formData.name,
      country_id: formData.country_id || null,
    };

    if (editingRegion) {
      const { error: updateError } = await supabase
        .from("region")
        .update(regionData)
        .eq("id", editingRegion.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("region")
        .insert(regionData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadRegions();
  }

  async function deleteRegion(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette région ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("region")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadRegions();
  }
</script>

<svelte:head>
  <title>Régions - Gestion</title>
</svelte:head>

<ManagePageShell title="Régions">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouvelle région</button>
  </svelte:fragment>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if regions.length === 0}
      <div class="empty-state">
        <p>Aucune région trouvée</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer la première région
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
            {#each regions as region}
              <tr>
                <td><strong>{region.name}</strong></td>
                <td>
                  {#if region.country}
                    <span>{region.country.flag} {region.country.name}</span>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(region)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteRegion(region.id)}
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
  title={editingRegion ? "Modifier la région" : "Nouvelle région"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom de la région *</label>
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
        {editingRegion ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>

