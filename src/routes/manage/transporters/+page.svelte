<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Country } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let transporters: any[] = [];
  let countries: Country[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingTransporter: any = null;

  // Form fields
  let formData = {
    name: "",
    email: "",
    phone_number: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    zip_code: "",
    country_id: "",
    vat: "",
  };

  onMount(async () => {
    await loadTransporters();
    await loadCountries();
  });

  async function loadTransporters() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("transporter")
      .select("*, country (*)")
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      transporters = data || [];
    }
    loading = false;
  }

  async function loadCountries() {
    const { data } = await supabase.from("country").select("*").order("name");
    if (data) countries = data;
  }

  function openCreateModal() {
    editingTransporter = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(transporter: any) {
    editingTransporter = transporter;
    formData = {
      name: transporter.name,
      email: transporter.email || "",
      phone_number: transporter.phone_number || "",
      address_line_1: transporter.address_line_1 || "",
      address_line_2: transporter.address_line_2 || "",
      city: transporter.city || "",
      zip_code: transporter.zip_code || "",
      country_id: transporter.country_id || "",
      vat: transporter.vat || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingTransporter = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      email: "",
      phone_number: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      zip_code: "",
      country_id: "",
      vat: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name) {
      error = "Le nom du transporteur est obligatoire";
      return;
    }

    const transporterData = {
      name: formData.name,
      email: formData.email || null,
      phone_number: formData.phone_number || null,
      address_line_1: formData.address_line_1 || null,
      address_line_2: formData.address_line_2 || null,
      city: formData.city || null,
      zip_code: formData.zip_code || null,
      country_id: formData.country_id || null,
      vat: formData.vat || null,
    };

    if (editingTransporter) {
      const { error: updateError } = await supabase
        .from("transporter")
        .update(transporterData)
        .eq("id", editingTransporter.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("transporter")
        .insert(transporterData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadTransporters();
  }

  async function deleteTransporter(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce transporteur ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("transporter")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadTransporters();
  }
</script>

<svelte:head>
  <title>Transporteurs - Gestion</title>
</svelte:head>

<ManagePageShell title="Transporteurs">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouveau transporteur</button>
  </svelte:fragment>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if transporters.length === 0}
      <div class="empty-state">
        <p>Aucun transporteur trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier transporteur
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Ville</th>
              <th>Pays</th>
              <th>TVA</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each transporters as transporter}
              <tr>
                <td><strong>{transporter.name}</strong></td>
                <td>{transporter.email || "-"}</td>
                <td>{transporter.phone_number || "-"}</td>
                <td>{transporter.city || "-"}</td>
                <td>
                  {#if transporter.country}
                    <span
                      >{transporter.country.flag}
                      {transporter.country.name}</span
                    >
                  {:else}
                    -
                  {/if}
                </td>
                <td>{transporter.vat || "-"}</td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(transporter)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteTransporter(transporter.id)}
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
  title={editingTransporter
    ? "Modifier le transporteur"
    : "Nouveau transporteur"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" bind:value={formData.email} />
      </div>

      <div class="form-group">
        <label for="phone_number">Téléphone</label>
        <input
          type="text"
          id="phone_number"
          bind:value={formData.phone_number}
        />
      </div>

      <div class="form-group full-width">
        <label for="address_line_1">Adresse ligne 1</label>
        <input
          type="text"
          id="address_line_1"
          bind:value={formData.address_line_1}
        />
      </div>

      <div class="form-group full-width">
        <label for="address_line_2">Adresse ligne 2</label>
        <input
          type="text"
          id="address_line_2"
          bind:value={formData.address_line_2}
        />
      </div>

      <div class="form-group">
        <label for="city">Ville</label>
        <input type="text" id="city" bind:value={formData.city} />
      </div>

      <div class="form-group">
        <label for="zip_code">Code postal</label>
        <input type="text" id="zip_code" bind:value={formData.zip_code} />
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
        <label for="vat">Numéro de TVA</label>
        <input type="text" id="vat" bind:value={formData.vat} />
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingTransporter ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>

