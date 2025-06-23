import { type Writable, writable } from 'svelte/store'
import type {
  SyncServiceConfig,
  GithubCredentials,
  GithubTarget,
  WebDAVCredentials,
  WebDAVTarget,
  ApiCredentials,
  ApiTarget,
} from '../sync/types.js'

// Define a type for all possible credential types
export type CredentialsType =
  | GithubCredentials
  | WebDAVCredentials
  | ApiCredentials

// Define a type for all possible target types
export type TargetType = GithubTarget | WebDAVTarget | ApiTarget

// Define the structure for settings, including sync service configurations
export type AppSettings = {
  syncServices: SyncServiceConfig[]
  // ... other application settings
  activeSyncServiceId: string | undefined // ID of the currently active sync service
}

// Default settings
const defaultSettings: AppSettings = {
  syncServices: [],
  activeSyncServiceId: undefined,
  // ... other default settings
}

// Function to load settings from localStorage
function loadSettings(): AppSettings {
  if (typeof localStorage !== 'undefined') {
    const savedSettings = localStorage.getItem('app-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings) as AppSettings
        // Ensure syncServices is always an array
        if (!Array.isArray(parsed.syncServices)) {
          parsed.syncServices = []
        }

        return { ...defaultSettings, ...parsed }
      } catch (error) {
        console.error('Error parsing settings from localStorage:', error)
        return defaultSettings
      }
    }
  }

  return defaultSettings
}

// Create a writable store for settings
export const settingsStore: Writable<AppSettings> =
  writable<AppSettings>(loadSettings())

// Subscribe to changes and save to localStorage
if (typeof localStorage !== 'undefined') {
  settingsStore.subscribe((value) => {
    localStorage.setItem('app-settings', JSON.stringify(value))
  })
}

// --- Sync Service Configuration Management ---

/**
 * Adds a new sync service configuration.
 * @param config - The sync service configuration to add.
 */
export function addSyncService(config: SyncServiceConfig): void {
  settingsStore.update((currentSettings) => ({
    ...currentSettings,
    syncServices: [...currentSettings.syncServices, config],
  }))
}

/**
 * Updates an existing sync service configuration.
 * @param updatedConfig - The updated sync service configuration.
 */
export function updateSyncService(updatedConfig: SyncServiceConfig): void {
  settingsStore.update((currentSettings) => ({
    ...currentSettings,
    syncServices: currentSettings.syncServices.map((service) =>
      service.id === updatedConfig.id ? updatedConfig : service
    ),
  }))
}

/**
 * Removes a sync service configuration by its ID.
 * @param serviceId - The ID of the sync service to remove.
 */
export function removeSyncService(serviceId: string): void {
  settingsStore.update((currentSettings) => ({
    ...currentSettings,
    syncServices: currentSettings.syncServices.filter(
      (service) => service.id !== serviceId
    ),
    // If the removed service was active, reset activeSyncServiceId
    activeSyncServiceId:
      currentSettings.activeSyncServiceId === serviceId
        ? undefined
        : currentSettings.activeSyncServiceId,
  }))
}

/**
 * Sets the active sync service.
 * @param serviceId - The ID of the sync service to set as active.
 */
export function setActiveSyncService(serviceId: string | undefined): void {
  settingsStore.update((currentSettings) => {
    const serviceExists = serviceId
      ? currentSettings.syncServices.some((s) => s.id === serviceId)
      : false
    return {
      ...currentSettings,
      activeSyncServiceId: serviceExists ? serviceId : undefined,
    }
  })
}

/**
 * Gets a specific sync service configuration by its ID.
 * @param serviceId - The ID of the sync service.
 * @returns The sync service configuration or undefined if not found.
 */
export function getSyncServiceById(
  settings: AppSettings,
  serviceId: string
): SyncServiceConfig | undefined {
  return settings.syncServices.find((service) => service.id === serviceId)
}

// TODO:
// 如果 repo, path, branch 等变更，需要重置 lastSyncTime。或者不允许修改这些值。
