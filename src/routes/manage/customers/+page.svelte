<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { sortCustomersByLabel } from "$lib/customerDisplay";
  import { onMount } from "svelte";
  import type { Customer, Country } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

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
      .select("*, country (*)");

    if (fetchError) {
      error = fetchError.message;
    } else {
      customers = sortCustomersByLabel(data || []);
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
      email: customer.email ?? "",
      company_name: customer.company_name ?? "",
      phone_number: customer.phone_number ?? "",
      address_line_1: customer.address_line_1 ?? "",
      address_line_2: customer.address_line_2 ?? "",
      city: customer.city ?? "",
      zip_code: customer.zip_code ?? "",
      country_id: customer.country_id ?? "",
      vat: customer.vat ?? "",
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
    if (!formData.first_name || !formData.last_name) {
      error = "Prénom et nom sont obligatoires";
      return;
    }

    const emailTrimmed = formData.email.trim();
    const customerData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: emailTrimmed ? emailTrimmed : null,
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

<ManagePageShell title="Clients">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouveau client</button>
  </svelte:fragment>

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
              <td>{customer.email || "-"}</td>
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
</ManagePageShell>

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
        <label for="email">Email</label>
        <input type="email" id="email" bind:value={formData.email} />
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
