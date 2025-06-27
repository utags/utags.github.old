<script lang="ts">
  import Modal from '../Modal.svelte'
  import {
    syncConfigStore,
    removeSyncService,
    setActiveSyncService,
  } from '../../stores/sync-config-store.js'
  import SyncServiceForm from './SyncServiceForm.svelte'
  import { SyncManager } from '../../sync/sync-manager.js'
  import type { SyncServiceConfig } from '../../sync/types.js'
  import { Pen, Trash2, RefreshCw, CheckCircle, Plus } from 'lucide-svelte'
  import ConfirmModal from '../ConfirmModal.svelte'

  let { showSyncSettings = $bindable() } = $props<{
    showSyncSettings: boolean
  }>()
  let showSyncServiceForm = $state(false)
  let editingService = $state<SyncServiceConfig | null>(null)
  let showConfirmModal = $state(false)
  let serviceToDelete = $state<string | null>(null)

  const syncManager = new SyncManager()

  function handleAdd() {
    editingService = null
    showSyncServiceForm = true
  }

  function handleEdit(service: SyncServiceConfig) {
    editingService = service
    showSyncServiceForm = true
  }

  function handleDelete(serviceId: string) {
    serviceToDelete = serviceId
    showConfirmModal = true
  }

  function confirmDelete() {
    if (serviceToDelete) {
      removeSyncService(serviceToDelete)
    }
    showConfirmModal = false
    serviceToDelete = null
  }

  function handleSyncNow(serviceId: string) {
    syncManager.synchronize(serviceId)
  }

  function handleSetAsActive(serviceId: string) {
    setActiveSyncService(serviceId)
  }
</script>

<Modal bind:isOpen={showSyncSettings} title="Sync Settings">
  <div class="flex flex-col gap-6 p-2">
    <div class="flex justify-end">
      <button
        class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-900"
        onclick={handleAdd}>
        <Plus size={18} />
        <span>Add Service</span>
      </button>
    </div>
    <ul class="space-y-3">
      {#each $syncConfigStore.syncServices as service (service.id)}
        <li
          class="group flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500">
          <div class="flex items-center gap-4">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              {#if $syncConfigStore.activeSyncServiceId === service.id && false}
                <CheckCircle class="text-green-500" size={22} />
              {:else}
                <RefreshCw size={20} />
              {/if}
            </div>
            <div>
              <p class="font-semibold text-gray-900 dark:text-gray-50">
                {service.name}
              </p>
              <div
                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{service.type}</span>
                <span class="text-xs">•</span>
                <span
                  class:text-green-600={service.enabled}
                  class:dark:text-green-400={service.enabled}
                  class:text-red-600={!service.enabled}
                  class:dark:text-red-400={!service.enabled}
                  >{service.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
          <div
            class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              class="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              onclick={() => handleEdit(service)}
              title="Edit">
              <Pen size={16} />
            </button>
            <button
              class="rounded-full p-2 text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
              onclick={() => handleDelete(service.id)}
              title="Delete">
              <Trash2 size={16} />
            </button>
            <button
              class="rounded-full p-2 text-blue-500 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50"
              onclick={() => handleSyncNow(service.id)}
              title="Sync Now">
              <RefreshCw size={16} />
            </button>
            {#if $syncConfigStore.activeSyncServiceId !== service.id && false}
              <button
                class="ml-2 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 dark:bg-green-800/50 dark:text-green-300 dark:hover:bg-green-700"
                onclick={() => handleSetAsActive(service.id)}
                >Set Active</button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </div>

  {#if showSyncServiceForm}
    <SyncServiceForm
      bind:showForm={showSyncServiceForm}
      service={editingService} />
  {/if}

  <ConfirmModal
    bind:isOpen={showConfirmModal}
    title="Delete Sync Service"
    message="Are you sure you want to delete this sync service? This action cannot be undone."
    confirmText="Delete"
    onConfirm={confirmDelete} />
</Modal>
