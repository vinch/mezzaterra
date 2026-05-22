<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Winery, Country, Region } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let wineries: Winery[] = [];
  let countries: Country[] = [];
  let regions: Region[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingWinery: Winery | null = null;

  // Form fields
  let formData = {
    name: "",
    city: "",
    url: "",
    country_id: "",
    region_id: "",
    latitude: "",
    longitude: "",
  };

  onMount(async () => {
    await loadWineries();
    await loadCountries();
    await loadRegions();
  });

  async function loadWineries() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("winery")
      .select(
        `
        *,
        country (*),
        region (*)
      `
      )
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      wineries = data || [];
    }
    loading = false;
  }

  async function loadCountries() {
    const { data } = await supabase.from("country").select("*").order("name");
    if (data) countries = data;
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

  function openCreateModal() {
    editingWinery = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(winery: Winery) {
    editingWinery = winery;
    formData = {
      name: winery.name,
      city: winery.city || "",
      url: winery.url || "",
      country_id: winery.country_id || "",
      region_id: winery.region_id || "",
      latitude: winery.latitude?.toString() || "",
      longitude: winery.longitude?.toString() || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingWinery = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      city: "",
      url: "",
      country_id: "",
      region_id: "",
      latitude: "",
      longitude: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name) {
      error = "Le nom du vignoble est obligatoire";
      return;
    }

    const wineryData = {
      name: formData.name,
      city: formData.city || null,
      url: formData.url || null,
      country_id: formData.country_id || null,
      region_id: formData.region_id || null,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
    };

    if (editingWinery) {
      const { error: updateError } = await supabase
        .from("winery")
        .update(wineryData)
        .eq("id", editingWinery.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("winery")
        .insert(wineryData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadWineries();
  }

  async function deleteWinery(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce vignoble ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("winery")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadWineries();
  }
</script>

<svelte:head>
  <title>Vignobles - Gestion</title>
</svelte:head>

<ManagePageShell title="Vignobles">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouveau vignoble</button>
  </svelte:fragment>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if wineries.length === 0}
      <div class="empty-state">
        <p>Aucun vignoble trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier vignoble
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Ville</th>
              <th>Région</th>
              <th>Pays</th>
              <th>Site web</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each wineries as winery}
              <tr>
                <td><strong>{winery.name}</strong></td>
                <td>{winery.city || "-"}</td>
                <td>{winery.region?.name || "-"}</td>
                <td>
                  {#if winery.country}
                    <span>{winery.country.flag} {winery.country.name}</span>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  {#if winery.url}
                    <a
                      href={winery.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="external-link"
                    >
                      Visiter
                    </a>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(winery)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteWinery(winery.id)}
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
  title={editingWinery ? "Modifier le vignoble" : "Nouveau vignoble"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom du vignoble *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group">
        <label for="city">Ville</label>
        <input type="text" id="city" bind:value={formData.city} />
      </div>

      <div class="form-group">
        <label for="url">Site web</label>
        <input type="url" id="url" bind:value={formData.url} />
      </div>

      <div class="form-group">
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
        <label for="latitude">Latitude</label>
        <input
          type="number"
          step="any"
          id="latitude"
          bind:value={formData.latitude}
        />
      </div>

      <div class="form-group">
        <label for="longitude">Longitude</label>
        <input
          type="number"
          step="any"
          id="longitude"
          bind:value={formData.longitude}
        />
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingWinery ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>

