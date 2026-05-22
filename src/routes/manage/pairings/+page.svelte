<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let pairings: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingPairing: any = null;

  // Form fields
  let formData = {
    description: "",
  };

  onMount(async () => {
    await loadPairings();
  });

  async function loadPairings() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("pairing")
      .select("*")
      .order("description");

    if (fetchError) {
      error = fetchError.message;
    } else {
      pairings = data || [];
    }
    loading = false;
  }

  function openCreateModal() {
    editingPairing = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(pairing: any) {
    editingPairing = pairing;
    formData = {
      description: pairing.description,
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingPairing = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      description: "",
    };
  }

  async function handleSubmit() {
    if (!formData.description) {
      error = "La description du pairing est obligatoire";
      return;
    }

    const pairingData = {
      description: formData.description,
    };

    if (editingPairing) {
      const { error: updateError } = await supabase
        .from("pairing")
        .update(pairingData)
        .eq("id", editingPairing.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("pairing")
        .insert(pairingData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadPairings();
  }

  async function deletePairing(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce pairing ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("pairing")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadPairings();
  }
</script>

<svelte:head>
  <title>Pairings - Gestion</title>
</svelte:head>

<ManagePageShell title="Pairings">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouveau pairing</button>
  </svelte:fragment>

  {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if pairings.length === 0}
      <div class="empty-state">
        <p>Aucun pairing trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier pairing
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each pairings as pairing}
              <tr>
                <td><strong>{pairing.description}</strong></td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(pairing)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deletePairing(pairing.id)}
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
  title={editingPairing ? "Modifier le pairing" : "Nouveau pairing"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="description">Description *</label>
        <input
          type="text"
          id="description"
          bind:value={formData.description}
          required
        />
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingPairing ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>

