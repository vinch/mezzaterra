<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Country } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let suppliers: any[] = [];
  let countries: Country[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingSupplier: any = null;

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
    await loadSuppliers();
    await loadCountries();
  });

  async function loadSuppliers() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("supplier")
      .select("*, country (*)")
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      suppliers = data || [];
    }
    loading = false;
  }

  async function loadCountries() {
    const { data } = await supabase.from("country").select("*").order("name");
    if (data) countries = data;
  }

  function openCreateModal() {
    editingSupplier = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(supplier: any) {
    editingSupplier = supplier;
    formData = {
      name: supplier.name,
      email: supplier.email || "",
      phone_number: supplier.phone_number || "",
      address_line_1: supplier.address_line_1 || "",
      address_line_2: supplier.address_line_2 || "",
      city: supplier.city || "",
      zip_code: supplier.zip_code || "",
      country_id: supplier.country_id || "",
      vat: supplier.vat || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingSupplier = null;
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
      error = "Le nom du fournisseur est obligatoire";
      return;
    }

    const supplierData = {
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

    if (editingSupplier) {
      const { error: updateError } = await supabase
        .from("supplier")
        .update(supplierData)
        .eq("id", editingSupplier.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("supplier")
        .insert(supplierData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadSuppliers();
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce fournisseur ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("supplier")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadSuppliers();
  }
</script>

<svelte:head>
  <title>Fournisseurs - Gestion</title>
</svelte:head>

<ManagePageShell title="Fournisseurs">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouveau fournisseur</button>
  </svelte:fragment>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if suppliers.length === 0}
      <div class="empty-state">
        <p>Aucun fournisseur trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier fournisseur
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
            {#each suppliers as supplier}
              <tr>
                <td><strong>{supplier.name}</strong></td>
                <td>{supplier.email || "-"}</td>
                <td>{supplier.phone_number || "-"}</td>
                <td>{supplier.city || "-"}</td>
                <td>
                  {#if supplier.country}
                    <span>{supplier.country.flag} {supplier.country.name}</span>
                  {:else}
                    -
                  {/if}
                </td>
                <td>{supplier.vat || "-"}</td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(supplier)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteSupplier(supplier.id)}
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
  title={editingSupplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}
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
        {editingSupplier ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>

