<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Customer, Country } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";

  let customers: Customer[] = [];
  let countries: Country[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingCustomer: Customer | null = null;

  // Form fields
  let formData = {
    first_name: "",
    last_name: "",
    email: "",
    company_name: "",
    phone_number: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    zip_code: "",
    country_id: "",
    vat: "",
  };

  let isCompany = false;

  onMount(async () => {
    await loadCustomers();
    await loadCountries();
  });

  async function loadCustomers() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("customer")
      .select("*, country (*)")
      .order("created_at", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
    } else {
      customers = data || [];
    }
    loading = false;
  }

  async function loadCountries() {
    const { data } = await supabase.from("country").select("*").order("name");

    if (data) {
      countries = data;
    }
  }

  function openCreateModal() {
    editingCustomer = null;
    resetForm();
    isCompany = false;
    showModal = true;
  }

  function openEditModal(customer: Customer) {
    editingCustomer = customer;
    isCompany = !!(customer.company_name || customer.vat);
    formData = {
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      company_name: customer.company_name || "",
      phone_number: customer.phone_number || "",
      address_line_1: customer.address_line_1 || "",
      address_line_2: customer.address_line_2 || "",
      city: customer.city || "",
      zip_code: customer.zip_code || "",
      country_id: customer.country_id || "",
      vat: customer.vat || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingCustomer = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      first_name: "",
      last_name: "",
      email: "",
      company_name: "",
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
    if (!formData.first_name || !formData.last_name || !formData.email) {
      error = "Prénom, nom et email sont obligatoires";
      return;
    }

    const customerData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      company_name: isCompany ? formData.company_name || null : null,
      phone_number: formData.phone_number || null,
      address_line_1: formData.address_line_1 || null,
      address_line_2: formData.address_line_2 || null,
      city: formData.city || null,
      zip_code: formData.zip_code || null,
      country_id: formData.country_id || null,
      vat: isCompany ? formData.vat || null : null,
    };

    if (editingCustomer) {
      // Update
      const { error: updateError } = await supabase
        .from("customer")
        .update(customerData)
        .eq("id", editingCustomer.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      // Create
      const { error: insertError } = await supabase
        .from("customer")
        .insert(customerData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadCustomers();
  }

  async function deleteCustomer(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("customer")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadCustomers();
  }
</script>

<svelte:head>
  <title>Clients - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Clients</h1>
    <button class="btn-primary" on:click={openCreateModal}>
      + Nouveau client
    </button>
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if customers.length === 0}
      <div class="empty-state">
        <p>Aucun client trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier client
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Entreprise</th>
              <th>Téléphone</th>
              <th>Ville</th>
              <th>Pays</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each customers as customer}
              <tr>
                <td>{customer.first_name} {customer.last_name}</td>
                <td>{customer.email}</td>
                <td>{customer.company_name || "-"}</td>
                <td>{customer.phone_number || "-"}</td>
                <td>{customer.city || "-"}</td>
                <td>
                  {#if customer.country}
                    <span>{customer.country.flag} {customer.country.name}</span>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(customer)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteCustomer(customer.id)}
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
  </div>
</div>

<Modal
  show={showModal}
  title={editingCustomer ? "Modifier le client" : "Nouveau client"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group">
        <label for="first_name">Prénom *</label>
        <input
          type="text"
          id="first_name"
          bind:value={formData.first_name}
          required
        />
      </div>

      <div class="form-group">
        <label for="last_name">Nom *</label>
        <input
          type="text"
          id="last_name"
          bind:value={formData.last_name}
          required
        />
      </div>

      <div class="form-group">
        <label for="email">Email *</label>
        <input type="email" id="email" bind:value={formData.email} required />
      </div>

      <div class="form-group">
        <label for="phone_number">Téléphone</label>
        <input
          type="tel"
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
        <label for="zip_code">Code postal</label>
        <input type="text" id="zip_code" bind:value={formData.zip_code} />
      </div>

      <div class="form-group">
        <label for="city">Ville</label>
        <input type="text" id="city" bind:value={formData.city} />
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

      <div class="form-group full-width">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={isCompany} />
          Client professionnel (entreprise)
        </label>
      </div>

      {#if isCompany}
        <div class="form-group">
          <label for="company_name">Nom de l'entreprise</label>
          <input
            type="text"
            id="company_name"
            bind:value={formData.company_name}
          />
        </div>

        <div class="form-group">
          <label for="vat">Numéro de TVA</label>
          <input type="text" id="vat" bind:value={formData.vat} />
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingCustomer ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>

<style>
  .page-container {
    min-height: 100vh;
  }

  .page-header {
    background: white;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-header h1 {
    margin: 0;
    color: #333;
    font-size: 1.75rem;
  }

  .page-content {
    padding: 2rem;
  }

  .error-message {
    background: #f8d7da;
    color: #721c24;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .empty-state {
    background: white;
    padding: 3rem;
    border-radius: 8px;
    text-align: center;
  }

  .empty-state p {
    color: #666;
    margin: 0 0 1rem 0;
  }

  .table-container {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background: #f8f9fa;
  }

  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: #333;
    border-bottom: 2px solid #dee2e6;
  }

  td {
    padding: 1rem;
    border-bottom: 1px solid #e9ecef;
  }

  tbody tr:hover {
    background: #f8f9fa;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-primary {
    padding: 0.5rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-primary:hover {
    background: #0056b3;
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-secondary:hover {
    background: #5a6268;
  }

  .btn-edit {
    padding: 0.4rem 0.8rem;
    background: #ffc107;
    color: #333;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-edit:hover {
    background: #e0a800;
  }

  .btn-delete {
    padding: 0.4rem 0.8rem;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-delete:hover {
    background: #c82333;
  }

  form {
    padding: 1.5rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  label {
    margin-bottom: 0.5rem;
    color: #333;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: normal;
    margin-bottom: 0;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    margin: 0;
    cursor: pointer;
  }

  input,
  select {
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: #007bff;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e9ecef;
  }
</style>
