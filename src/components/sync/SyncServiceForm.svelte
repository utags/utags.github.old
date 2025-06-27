<script lang="ts">
  import { onMount } from 'svelte'
  import Modal from '../Modal.svelte'
  import {
    addSyncService,
    updateSyncService,
  } from '../../stores/sync-config-store.js'

  import InputField from '../ui/InputField.svelte'
  import Switch from '../Switch.svelte'
  import type { SyncServiceConfig } from '../../sync/types.js'
  import type { MergeStrategy } from '../../lib/bookmark-merge-utils.js'
  import {
    mergeMetaOptions,
    mergeTagsOptions,
  } from '../../config/merge-options.js'

  type FormConfig = Omit<SyncServiceConfig, 'mergeStrategy'> & {
    mergeStrategy: MergeStrategy
  }

  let { showForm = $bindable(), service = null } = $props<{
    showForm: boolean
    service?: SyncServiceConfig | null
  }>()

  let config = $state<FormConfig>({
    id: '',
    name: '',
    type: 'github',
    enabled: true,
    autoSyncEnabled: true,
    autoSyncOnChanges: true,
    autoSyncInterval: 60,
    autoSyncDelayOnChanges: 5,
    scope: 'all',
    credentials: {
      username: '',
      password: '',
      token: '',
      apiKey: '',
    },
    target: {
      url: '',
      repo: '',
      path: '',
      branch: '',
      authTestEndpoint: '',
    },
    mergeStrategy: {
      meta: 'merge',
      tags: 'union',
      defaultDate: '',
      preferOldestCreated: true,
      preferNewestUpdated: true,
    },
  })

  onMount(() => {
    if (service) {
      config.id = service.id
      config.name = service.name
      config.type = service.type
      config.enabled = service.enabled
      config.autoSyncEnabled = service.autoSyncEnabled
      config.autoSyncInterval = service.autoSyncInterval
      config.autoSyncOnChanges = service.autoSyncOnChanges
      config.autoSyncDelayOnChanges = service.autoSyncDelayOnChanges
      if (service.credentials) {
        config.credentials = { ...config.credentials, ...service.credentials }
      }
      if (service.target) {
        config.target = { ...config.target, ...service.target }
      }
      if (service.mergeStrategy) {
        config.mergeStrategy = {
          ...config.mergeStrategy,
          ...service.mergeStrategy,
        }
      }
    } else {
      config.id = crypto.randomUUID()
    }
  })

  function handleSubmit() {
    let serviceToSave: SyncServiceConfig

    const baseConfig = {
      id: config.id,
      name: config.name,
      type: config.type,
      enabled: config.enabled,
      autoSyncEnabled: config.autoSyncEnabled,
      autoSyncOnChanges: config.autoSyncOnChanges,
      autoSyncInterval: config.autoSyncInterval,
      autoSyncDelayOnChanges: config.autoSyncDelayOnChanges,
      scope: config.scope,
      mergeStrategy: config.mergeStrategy,
    }

    switch (config.type) {
      case 'github':
        serviceToSave = {
          ...baseConfig,
          type: 'github',
          credentials: {
            token: config.credentials.token,
          },
          target: {
            repo: config.target.repo,
            path: config.target.path,
            branch: config.target.branch,
          },
        }
        break
      case 'webdav':
        serviceToSave = {
          ...baseConfig,
          type: 'webdav',
          credentials: {
            username: config.credentials.username,
            password: config.credentials.password,
          },
          target: {
            url: config.target.url,
            path: config.target.path,
          },
        }
        break
      case 'customApi':
        serviceToSave = {
          ...baseConfig,
          type: 'customApi',
          credentials: {
            token: config.credentials.token,
            apiKey: config.credentials.apiKey,
          },
          target: {
            url: config.target.url,
            path: config.target.path,
            authTestEndpoint: config.target.authTestEndpoint,
          },
        }
        break
      case 'browserExtension':
        serviceToSave = {
          ...baseConfig,
          type: 'browserExtension',
          credentials: {},
          target: {},
        }
        break
      default:
        // Should not happen
        return
    }

    if (service) {
      // Preserve sync metadata when updating service
      serviceToSave = {
        ...serviceToSave,
        lastSyncTimestamp: service.lastSyncTimestamp,
        lastSyncLocalDataHash: service.lastSyncLocalDataHash,
        lastSyncMeta: service.lastSyncMeta,
      }
      updateSyncService(serviceToSave)
    } else {
      addSyncService(serviceToSave)
    }
    showForm = false
  }

  function onInputEnter() {
    handleSubmit()
  }
</script>

<Modal
  bind:isOpen={showForm}
  title={service ? 'Edit Sync Service' : 'Add Sync Service'}
  onConfirm={handleSubmit}
  {onInputEnter}>
  <div class="space-y-4 p-1">
    <div
      class="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-700">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >Service Status</span>
      <Switch bind:checked={config.enabled} />
    </div>

    <InputField bind:value={config.name} placeholder="My Sync Service">
      Service Name:
    </InputField>

    <div class="space-y-3">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        Sync Server Information
      </h3>
      <label
        for="service-type"
        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >Service Type:</label>
      <select
        id="service-type"
        bind:value={config.type}
        disabled={!!service}
        class="mt-1 block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
        <option value="github">GitHub</option>
        <option value="webdav">WebDAV</option>
        <option value="customApi">Custom API</option>
        <option value="browserExtension">Browser Extension</option>
      </select>
      {#if config.type === 'webdav'}
        <InputField
          bind:value={config.target.url}
          placeholder="https://example.com/dav">
          WebDAV URL:
        </InputField>
        <InputField
          bind:value={config.target.path}
          placeholder="utags/bookmarks.json">
          Path:
        </InputField>
        <InputField
          bind:value={config.credentials.username}
          placeholder="Username">
          Username:
        </InputField>
        <InputField
          type="password"
          bind:value={config.credentials.password}
          placeholder="Password">
          Password:
        </InputField>
      {/if}

      {#if config.type === 'github'}
        <InputField bind:value={config.target.repo} placeholder="owner/repo">
          Repository Name:
        </InputField>
        <InputField
          bind:value={config.target.path}
          placeholder="utags/bookmarks.json">
          File Path:
        </InputField>
        <InputField bind:value={config.target.branch} placeholder="main">
          Branch:
        </InputField>
        <InputField
          type="password"
          bind:value={config.credentials.token}
          placeholder="GitHub Personal Access Token">
          Token:
        </InputField>
      {/if}

      {#if config.type === 'customApi'}
        <InputField
          bind:value={config.target.url}
          placeholder="https://api.example.com/v1">
          API Base URL:
        </InputField>
        <InputField
          bind:value={config.target.path}
          placeholder="utags-bookmarks.json">
          Path:
        </InputField>
        <InputField
          bind:value={config.target.authTestEndpoint}
          placeholder="auth/status">
          Auth Test Endpoint:
        </InputField>
        <InputField
          type="password"
          bind:value={config.credentials.token}
          placeholder="Bearer Token">
          Token:
        </InputField>
        <InputField
          type="password"
          bind:value={config.credentials.apiKey}
          placeholder="API Key">
          API Key:
        </InputField>
      {/if}
    </div>
    <div class="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        Auto-sync Behavior
      </h3>
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >Auto Sync Enabled</span>
        <Switch bind:checked={config.autoSyncEnabled} />
      </div>

      <InputField type="number" bind:value={config.autoSyncInterval}>
        Auto-sync Interval (minutes):
      </InputField>

      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >Auto-sync on changes</span>
        <Switch bind:checked={config.autoSyncOnChanges} />
      </div>
      <InputField type="number" bind:value={config.autoSyncDelayOnChanges}>
        Auto-sync Delay on Changes (seconds):
      </InputField>
    </div>

    <div class="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        Merge Strategy
      </h3>
      <div>
        <label
          for="meta-strategy"
          class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >Metadata Merge Strategy:</label>
        <select
          id="meta-strategy"
          bind:value={config.mergeStrategy.meta}
          class="mt-1 block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          {#each mergeMetaOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <div>
        <label
          for="tags-strategy"
          class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >Tags Merge Strategy:</label>
        <select
          id="tags-strategy"
          bind:value={config.mergeStrategy.tags}
          class="mt-1 block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          {#each mergeTagsOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <InputField bind:value={config.mergeStrategy.defaultDate}>
        Default Date for Invalid Timestamps:
      </InputField>
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >Prefer Oldest Created Timestamp</span>
        <Switch bind:checked={config.mergeStrategy.preferOldestCreated} />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >Prefer Newest Updated Timestamp</span>
        <Switch bind:checked={config.mergeStrategy.preferNewestUpdated} />
      </div>
    </div>
  </div>
</Modal>
