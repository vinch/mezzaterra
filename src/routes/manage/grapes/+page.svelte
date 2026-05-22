<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let grapes: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingGrape: any = null;

  // Form fields
  let formData = {
    name: "",
    description: "",
  };

  onMount(async () => {
    await loadGrapes();
  });

  async function loadGrapes() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("grape")
      .select("*")
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      grapes = data || [];
    }
    loading = false;
  }

  function openCreateModal() {
    editingGrape = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(grape: any) {
    editingGrape = grape;
    formData = {
      name: grape.name,
      description: grape.description || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingGrape = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      description: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name) {
      error = "Le nom du cépage est obligatoire";
      return;
    }

    const grapeData = {
      name: formData.name,
      description: formData.description || null,
    };

    if (editingGrape) {
      const { error: updateError } = await supabase
        .from("grape")
        .update(grapeData)
        .eq("id", editingGrape.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("grape")
        .insert(grapeData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadGrapes();
  }

  async function deleteGrape(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce cépage ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("grape")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadGrapes();
  }
</script>

<svelte:head>
  <title>Cépages - Gestion</title>
</svelte:head>

<ManagePageShell title="Cépages">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouveau cépage</button>
  </svelte:fragment>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if grapes.length === 0}
    <div class="empty-state">
      <p>Aucun cépage trouvé</p>
      <button class="btn-primary" on:click={openCreateModal}>
        Créer le premier cépage
      </button>
    </div>
  {:else}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each grapes as grape}
            <tr>
              <td><strong>{grape.name}</strong></td>
              <td>
                {#if grape.description}
                  <span class="description-text" title={grape.description}>
                    {grape.description.length > 50
                      ? grape.description.substring(0, 50) + "..."
                      : grape.description}
                  </span>
                {:else}
                  -
                {/if}
              </td>
              <td>
                <div class="actions">
                  <button
                    class="btn-edit"
                    on:click={() => openEditModal(grape)}
                  >
                    Modifier
                  </button>
                  <button
                    class="btn-delete"
                    on:click={() => deleteGrape(grape.id)}
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
  title={editingGrape ? "Modifier le cépage" : "Nouveau cépage"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom du cépage *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group full-width">
        <label for="description">Description</label>
        <textarea id="description" bind:value={formData.description} rows="3"
        ></textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingGrape ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>
