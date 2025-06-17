import { type Unsubscriber } from 'svelte/store'
import {
  type BookmarkTagsAndMetadata,
  type BookmarksData,
  type BookmarksStore,
} from '../types/bookmarks.js'
import { DEFAULT_DATE } from '../config/constants.js'
import { prettyPrintJson } from '../utils/pretty-print-json.js'
import {
  settingsStore,
  getSyncServiceById,
  updateSyncService,
  type AppSettings,
} from '../stores/settings-store.js'
import { EventEmitter } from '../lib/event-emitter.js'
import {
  mergeBookmarks,
  type MergeStrategy,
  type SyncOption,
} from '../lib/bookmark-merge-utils.js'
import { bookmarkStorage } from '../lib/bookmark-storage.js'
import { CustomApiSyncAdapter } from './custom-api-sync-adapter.js'
import { GitHubSyncAdapter } from './git-hub-sync-adapter.js'
import { BrowserExtensionSyncAdapter } from './browser-extension-sync-adapter.js'
import { WebDAVSyncAdapter } from './webdav-sync-adapter.js'
import type {
  SyncAdapter,
  SyncServiceConfig,
  SyncStatus,
  SyncEvents,
  SyncMetadata,
  AuthStatus,
} from './types.js'

export class SyncManager extends EventEmitter<SyncEvents> {
  private readonly adapters = new Map<string, SyncAdapter>()
  private currentSettings!: AppSettings
  private currentSyncStatus: SyncStatus = { type: 'idle' } // Updated initial state
  private readonly unsubscriber: Unsubscriber
  private readonly defaultMergeStrategy: MergeStrategy = {
    meta: 'merge',
    tags: 'union',
    defaultDate: DEFAULT_DATE,
  } // Default merge strategy

  constructor() {
    super()
    this.unsubscriber = settingsStore.subscribe((newSettings) => {
      console.log(
        '[SyncManager] Settings updated:',
        prettyPrintJson(newSettings)
      )
      // This will be called whenever the settings change and the sync manager is subscribed to it
      this.currentSettings = newSettings
      this.emit('settingsChanged', newSettings)
    })
  }

  /**
   * Cleans up resources used by the SyncManager.
   * This includes unsubscribing from stores, destroying cached adapters,
   * and clearing the adapter cache.
   */
  public destroy(): void {
    // Unsubscribe from the settings store to prevent memory leaks and further updates
    if (this.unsubscriber) {
      this.unsubscriber()
    }

    // Destroy all cached adapters
    for (const [id, adapter] of this.adapters.entries()) {
      if (typeof adapter.destroy === 'function') {
        try {
          adapter.destroy()
        } catch (error) {
          console.error(`Error destroying cached adapter (ID: ${id}):`, error)
        }
      }
    }

    this.adapters.clear()

    // Optionally, emit a destroyed event if the EventEmitter supports it
    this.emit('destroyed', '')

    console.log('[SyncManager] Destroyed')
  }

  /**
   * Gets the current sync status object.
   * @returns The current sync status object.
   */
  public getStatus(): SyncStatus {
    return this.currentSyncStatus
  }

  /**
   * Initiates a synchronization operation.
   * If serviceId is provided, it syncs that specific service.
   * Otherwise, it attempts to sync the currently active service from settings.
   *
   * @param serviceId - Optional. The ID of the sync service to use.
   * @returns A promise that resolves with true if sync was successful, false otherwise.
   */
  public async sync(serviceId?: string): Promise<boolean> {
    const targetServiceId =
      serviceId || this.currentSettings?.activeSyncServiceId
    if (!targetServiceId) {
      const errMsg =
        'No sync service ID provided and no active sync service configured.'
      this.emit('error', { message: errMsg })
      this.updateStatus({ type: 'error', error: errMsg })
      return false
    }

    // Call synchronize which handles getting/creating the adapter
    return this.synchronize(targetServiceId)
  }

  /**
   * Initiates a synchronization operation with the adapter with the specified configId.
   * @param configId The ID of the SyncServiceConfig to use for synchronization.
   * @returns A promise that resolves to true if sync is successful, false otherwise.
   */
  public async synchronize(configId: string): Promise<boolean> {
    const serviceConfig = getSyncServiceById(this.currentSettings, configId)

    if (!this._canStartSync(serviceConfig, configId)) {
      return false
    }

    this.updateStatus({ type: 'initializing' })

    let adapter: SyncAdapter
    try {
      adapter = await this.getAdapter(serviceConfig!) // serviceConfig is checked in _canStartSync
    } catch (error: any) {
      const errMsg = `Sync adapter for ${serviceConfig!.name} (ID: ${configId}) could not be initialized: ${error.message}`
      console.error(errMsg, error)
      this.emit('error', { message: errMsg, serviceId: configId, error })
      this.updateStatus({ type: 'error', error: errMsg })
      return false
    }

    return this._performSyncOperation(adapter, serviceConfig!)
  }

  /**
   * Checks the authentication status of a sync adapter.
   * If serviceId is provided, it checks that specific service.
   * Otherwise, it attempts to check the currently active service from settings.
   *
   * @param serviceId - Optional. The ID of the sync service to check.
   * @returns A promise that resolves to the authentication status.
   */
  public async checkAuthStatus(serviceId?: string): Promise<AuthStatus> {
    const targetServiceId =
      serviceId || this.currentSettings?.activeSyncServiceId

    if (!targetServiceId) {
      console.warn(
        'No service ID provided and no active adapter available to check auth status.'
      )
      return 'unknown'
    }

    const serviceConfig = getSyncServiceById(
      this.currentSettings,
      targetServiceId
    )
    if (!serviceConfig) {
      console.warn(
        `No service configuration found for ID: ${targetServiceId} to check auth status.`
      )
      return 'unknown'
    }

    let adapter: SyncAdapter
    try {
      adapter = await this.getAdapter(serviceConfig)
    } catch (error) {
      console.error(
        `Error getting adapter for service ${targetServiceId} to check auth status:`,
        error
      )
      this.emit('error', {
        message: `Error getting adapter for auth status check: ${serviceConfig.name}`,
        serviceId: targetServiceId,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      return 'error' // Or 'unknown' depending on desired behavior for adapter init failure
    }

    if (typeof adapter.getAuthStatus !== 'function') {
      console.warn(
        `Adapter ${adapter.constructor.name} for service ${targetServiceId} does not implement getAuthStatus. Returning 'unknown'.`
      )
      return 'unknown'
    }

    try {
      return await adapter.getAuthStatus()
    } catch (error) {
      console.error(
        `Error checking auth status for service ${targetServiceId} in SyncManager:`,
        error
      )
      this.emit('error', {
        message: `Error checking auth status for ${serviceConfig.name}`,
        serviceId: targetServiceId,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      return 'error'
    }
  }

  private async getAdapter(config: SyncServiceConfig): Promise<SyncAdapter> {
    if (this.adapters.has(config.id)) {
      const existingAdapter = this.adapters.get(config.id)!
      // Check if re-initialization is needed (e.g., if config object itself changed, not just values within)
      // Use deep comparison for config objects
      if (
        JSON.stringify(existingAdapter.getConfig()) === JSON.stringify(config)
      ) {
        return existingAdapter
      }

      // If config object changed, or for more robust re-initialization logic:
      console.log(
        `[SyncManager] Re-initializing adapter for ${config.name} due to config change.`
      )
      if (typeof existingAdapter.destroy === 'function') {
        try {
          existingAdapter.destroy()
        } catch (error) {
          console.warn(
            `[SyncManager] Error destroying adapter ${config.id} before re-initialization:`,
            error
          )
        }
      }

      this.adapters.delete(config.id) // Remove old instance before creating new
    }

    let adapter: SyncAdapter
    switch (config.type) {
      case 'github': {
        adapter = new GitHubSyncAdapter()
        break
      }

      case 'webdav': {
        adapter = new WebDAVSyncAdapter()
        break
      }

      case 'customApi': {
        adapter = new CustomApiSyncAdapter()
        break
      }

      case 'browserExtension': {
        adapter = new BrowserExtensionSyncAdapter()
        break
      }

      default: {
        // Ensure that 'never' is asserted for config.type to catch unhandled cases
        const _exhaustiveCheck: never = config.type
        throw new Error(`Unknown sync service type: ${_exhaustiveCheck}`)
      }
    }

    await adapter.init(config)
    this.adapters.set(config.id, adapter)
    return adapter
  }

  /**
   * Updates the current sync status and emits an event if it changes.
   * @param newStatus - The new sync status object.
   */
  private updateStatus(newStatus: SyncStatus): void {
    // Basic check for actual change to avoid redundant events
    // This could be more sophisticated for statuses with progress etc.
    if (this.currentSyncStatus.type !== newStatus.type) {
      this.currentSyncStatus = newStatus
      this.emit('statusChange', this.currentSyncStatus)
    } else if (
      JSON.stringify(this.currentSyncStatus) !== JSON.stringify(newStatus)
    ) {
      // More thorough check for changes in properties within the same type
      this.currentSyncStatus = newStatus
      this.emit('statusChange', this.currentSyncStatus)
    }
  }

  /**
   * Checks if a sync operation can be started for the given service config.
   * Emits info/error events and updates status if sync cannot start.
   * @param serviceConfig The configuration of the service to check.
   * @param specificAdapterCheck Set to true if checking for a specific adapter (synchronize case)
   * @returns True if sync can start, false otherwise.
   * @private
   */
  private _canStartSync(
    serviceConfig: SyncServiceConfig | undefined,
    forServiceId: string
  ): boolean {
    if (this.isSyncInProgress()) {
      this.emit('info', {
        message: `Synchronization already in progress, cannot start sync for ${serviceConfig?.name || 'unkown service'}.`,
        serviceId: forServiceId,
      })
      // Do not update status here, as it's not an error
      return false
    }

    if (!serviceConfig) {
      const errMsg = `Sync configuration for service ID '${forServiceId}' not found.`
      this.emit('error', { message: errMsg, serviceId: forServiceId })
      this.updateStatus({ type: 'error', error: errMsg })
      return false
    }

    if (!serviceConfig.enabled) {
      const infoMsg = `Sync service '${serviceConfig.name}' (ID: ${serviceConfig.id}) is not enabled.`
      this.emit('info', { message: infoMsg, serviceId: serviceConfig.id })
      this.updateStatus({ type: 'disabled' }) // Or a more specific status if needed
      return false
    }

    return true
  }

  /**
   * Performs the core synchronization logic with a given adapter.
   * @param adapter - The SyncAdapter to use for synchronization.
   * @param serviceConfig - The configuration of the service being synced.
   * @returns A promise that resolves to true if sync is successful, false otherwise.
   * @internal
   */
  private async _performSyncOperation(
    adapter: SyncAdapter,
    serviceConfig: SyncServiceConfig
  ): Promise<boolean> {
    this.emit('syncStart', { serviceId: serviceConfig.id })
    let operationSuccessful = false // Flag to track overall success

    try {
      // Stage 1: Fetch Remote Data
      const fetchResult = await this._fetchRemoteData(adapter, serviceConfig)
      if (!fetchResult.success) {
        return false // Error handling done in _fetchRemoteData
      }

      const { remoteBookmarks, remoteMetadata: downloadRemoteMeta } =
        fetchResult

      // Stage 2: Merge Data
      const syncTimestamp = Date.now() // The time of local data fetched
      const mergeResult = await this._mergeData(
        remoteBookmarks,
        serviceConfig,
        this.defaultMergeStrategy
      )
      if (!mergeResult.success || !mergeResult.mergedBookmarks) {
        return false // Error handling done in _mergeData
      }

      const { mergedBookmarks, hasChanges } = mergeResult

      // Stage 3: Upload Data
      const uploadSuccess = await this._uploadData(
        adapter,
        serviceConfig,
        mergedBookmarks,
        downloadRemoteMeta,
        hasChanges!,
        syncTimestamp
      )

      operationSuccessful = uploadSuccess // uploadSuccess is true if successful
      return operationSuccessful
    } catch (error: any) {
      console.error(`Synchronization failed for ${serviceConfig.name}:`, error)
      const errorMessage = `Synchronization failed for ${serviceConfig.name}: ${error.message}`
      this.emit('error', {
        message: errorMessage,
        serviceId: serviceConfig.id,
        error,
      })
      this.updateStatus({
        type: 'error',
        error: errorMessage,
        lastAttemptTime: Date.now(),
      })
      return false // Explicitly return false on caught error
    } finally {
      let finalEventType: 'success' | 'error' | 'conflict' = 'error' // Default to error
      if (operationSuccessful && this.currentSyncStatus.type === 'success') {
        finalEventType = 'success'
      } else if (this.currentSyncStatus.type === 'conflict') {
        finalEventType = 'conflict'
      } // Otherwise, it remains 'error' due to earlier failure or the catch block
      // If it's still a transient state, it means an unhandled error occurred or logic is incomplete
      // and it defaulted to 'error' or was set by a catch block.

      this.emit('syncEnd', {
        serviceId: serviceConfig.id,
        status: finalEventType,
        error:
          finalEventType === 'success'
            ? undefined
            : (this.currentSyncStatus as any).error ||
              (this.currentSyncStatus as any).details,
      })

      // Reset to idle only if the operation was successful.
      // If it was an error or conflict, the status should remain as such.
      if (finalEventType === 'success') {
        this.updateStatus({
          type: 'idle',
          lastSyncTime: (this.currentSyncStatus as any).lastSyncTime,
        })
      } else if (
        !this.isSyncInProgress() &&
        this.currentSyncStatus.type !== 'error' &&
        this.currentSyncStatus.type !== 'conflict'
      ) {
        // If sync is not in progress (e.g. checking, downloading etc.) and not already an error/conflict,
        // but operationSuccessful is false, it implies an issue not setting a final error/conflict state.
        // This case should ideally be covered by explicit error/conflict states from sub-operations.
        // However, as a fallback, if it's some other transient state, reset to idle.
        // This might need refinement based on how sub-operations guarantee final state setting on failure.
        this.updateStatus({ type: 'idle' })
      }
    }
  }

  /**
   * Fetches remote data and metadata from the adapter.
   * @param adapter The sync adapter.
   * @param serviceConfig The sync service configuration.
   * @returns An object containing success status, remote bookmarks, and remote metadata.
   */
  private async _fetchRemoteData(
    adapter: SyncAdapter,
    serviceConfig: SyncServiceConfig
  ): Promise<{
    success: boolean
    remoteBookmarks?: BookmarksData
    remoteMetadata?: SyncMetadata | undefined
  }> {
    try {
      this.updateStatus({ type: 'checking' })
      console.log(
        `[SyncManager] Fetching remote metadata for ${serviceConfig.name}...`
      )
      const initialRemoteMetadata = await adapter.getRemoteMetadata()

      this.updateStatus({ type: 'downloading' })
      console.log(
        `[SyncManager] Downloading remote data for ${serviceConfig.name}...`
      )
      // const { data: remoteDataString, remoteMeta: downloadRemoteMeta } =
      //   initialRemoteMetadata
      //     ? await adapter.download()
      //     : { data: null, remoteMeta: null }
      // Always attempt to download, regardless of initialRemoteMetadata
      const { data: remoteDataString, remoteMeta: downloadRemoteMeta } =
        await adapter.download()

      let remoteBookmarks: BookmarksData | undefined
      if (remoteDataString && remoteDataString.trim() !== '') {
        try {
          remoteBookmarks = JSON.parse(remoteDataString) as BookmarksData
        } catch (error: any) {
          console.error(
            `Failed to parse remote data for ${serviceConfig.name}:`,
            error
          )
          const errorMessage = `Failed to parse remote data for ${serviceConfig.name}: ${error.message}`
          this.emit('error', {
            message: errorMessage,
            serviceId: serviceConfig.id,
            error: error instanceof Error ? error : new Error(String(error)),
          })
          this.updateStatus({
            type: 'error',
            error: errorMessage,
            lastAttemptTime: Date.now(),
          })
          return { success: false }
        }
      }

      return {
        success: true,
        remoteBookmarks,
        remoteMetadata: downloadRemoteMeta || initialRemoteMetadata,
      }
    } catch (error: any) {
      console.error(
        `Error fetching remote data for ${serviceConfig.name}:`,
        error
      )
      const errorMessage = `Failed to fetch remote data for ${serviceConfig.name}: ${error.message}`
      this.emit('error', {
        message: errorMessage,
        serviceId: serviceConfig.id,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      this.updateStatus({
        type: 'error',
        error: errorMessage,
        lastAttemptTime: Date.now(),
      })
      return { success: false }
    }
  }

  /**
   * Merges local and remote bookmark data.
   * @param localData Local bookmarks data.
   * @param remoteBookmarks Remote bookmarks data.
   * @param serviceConfig The sync service configuration.
   * @param defaultMergeStrategy The default merge strategy.
   * @returns An object containing success status, merged bookmarks, deleted URLs, and changes.
   */
  private async _mergeData(
    remoteBookmarks: BookmarksData | undefined,
    serviceConfig: SyncServiceConfig,
    defaultMergeStrategy: MergeStrategy
  ): Promise<{
    success: boolean
    mergedBookmarks?: BookmarksData
    hasChanges?: boolean
  }> {
    const mergeStrategy = {
      ...defaultMergeStrategy,
      ...serviceConfig.mergeStrategy,
    }
    const syncOption: SyncOption = {
      currentTime: Date.now(),
      lastSyncTime: serviceConfig.lastSyncTimestamp || 0,
    }

    this.updateStatus({ type: 'merging' })
    console.log(
      `[SyncManager] Merging local and remote data for ${serviceConfig.name}: with merge strategy ${JSON.stringify(mergeStrategy)} and sync option ${JSON.stringify(syncOption)} ...`
    )

    try {
      const localData = await bookmarkStorage.getBookmarksData()
      let mergedDataResult:
        | {
            merged: BookmarksData
            deleted: string[]
            conflicts?: any[]
          }
        | undefined

      if (remoteBookmarks) {
        mergedDataResult = await mergeBookmarks(
          localData,
          remoteBookmarks,
          mergeStrategy,
          syncOption
        )
      } else {
        mergedDataResult = { merged: localData, deleted: [], conflicts: [] }
      }

      if (!mergedDataResult) {
        // Should not happen if mergeBookmarks is robust
        const errorMessage = `Bookmark merging resulted in no data for ${serviceConfig.name}.`
        this.emit('error', {
          message: errorMessage,
          serviceId: serviceConfig.id,
        })
        this.updateStatus({
          type: 'error',
          error: errorMessage,
          lastAttemptTime: Date.now(),
        })
        return { success: false }
      }

      const {
        merged: mergedBookmarks,
        deleted: deletedUrls,
        conflicts,
      } = mergedDataResult

      console.log('mergedDataResult', mergedDataResult)

      if (conflicts && conflicts.length > 0) {
        console.warn(
          `Merge conflicts identified for ${serviceConfig.name}:`,
          conflicts
        )
        this.updateStatus({
          type: 'conflict',
          details: conflicts,
          lastAttemptTime: Date.now(),
        })
        this.emit('syncConflict', {
          serviceId: serviceConfig.id,
          details: conflicts,
        })
        return { success: false }
      }

      if (deletedUrls.length > 0) {
        await bookmarkStorage.deleteBookmarks(deletedUrls)
        this.emit('bookmarksRemoved', {
          // No change needed, already matches new type
          serviceId: serviceConfig.id,
          urls: deletedUrls,
        })
      }

      const mergedCount = Object.keys(mergedBookmarks).length

      if (mergedCount > 0) {
        // Update bookmarks
        await bookmarkStorage.upsertBookmarks(Object.entries(mergedBookmarks))
      }

      const localDataAfterMerge = await bookmarkStorage.getBookmarksData()
      const hasChanges = deletedUrls.length > 0 || mergedCount > 0

      this.updateStatus({ type: 'merging', progress: 100 })
      return {
        success: true,
        mergedBookmarks: localDataAfterMerge,
        hasChanges,
      }
    } catch (error: any) {
      if (error.name === 'MergeConflictError') {
        console.warn(
          `Merge conflict detected for ${serviceConfig.name}:`,
          error.details
        )
        this.updateStatus({
          type: 'conflict',
          details: error.details,
          lastAttemptTime: Date.now(),
        })
        this.emit('syncConflict', {
          serviceId: serviceConfig.id,
          details: error.details,
          error,
        })
        return { success: false }
      }

      const errorMessage = `Bookmark merging failed for ${serviceConfig.name}: ${error.message}`
      console.warn(errorMessage, error)
      this.emit('error', {
        message: errorMessage,
        serviceId: serviceConfig.id,
        error,
      })
      this.updateStatus({
        type: 'error',
        error: errorMessage,
        lastAttemptTime: Date.now(),
      })
      return { success: false }
    }
  }

  /**
   * Uploads merged data to the remote server.
   * @param adapter The sync adapter.
   * @param serviceConfig The sync service configuration.
   * @param mergedBookmarks The merged bookmarks data.
   * @param localData The original local data (for comparison).
   * @param downloadRemoteMeta Metadata from the download step.
   * @param changes Calculated changes (added, updated, removed).
   * @param deletedUrls URLs that were deleted during the merge.
   * @returns A promise that resolves to true if upload is successful, false otherwise.
   */
  private async _uploadData(
    adapter: SyncAdapter,
    serviceConfig: SyncServiceConfig,
    mergedBookmarks: BookmarksData,
    downloadRemoteMeta: SyncMetadata | undefined,
    hasChanges: boolean,
    syncTimestamp: number
  ): Promise<boolean> {
    // if remote was empty (first sync) as a reason to upload
    const isFirstSync =
      !downloadRemoteMeta && !(await adapter.getRemoteMetadata()) // More robust check for first sync

    // If there are changes or if it's the first sync (implied by !downloadRemoteMeta if remote was empty)
    if (
      hasChanges ||
      (isFirstSync && Object.keys(mergedBookmarks).length > 0)
    ) {
      this.updateStatus({ type: 'uploading' })
      console.log(
        `[SyncManager] Uploading merged data for ${serviceConfig.name}...`
      )
      // console.log('Uploading', prettyPrintJson(mergedBookmarks))
      try {
        const newRemoteMeta = await adapter.upload(
          prettyPrintJson(mergedBookmarks),
          downloadRemoteMeta // Pass metadata for conditional upload
        )

        const updatedServiceConfig: SyncServiceConfig = {
          ...serviceConfig,
          lastSyncTimestamp: syncTimestamp,
          lastSyncMeta: newRemoteMeta,
        }
        updateSyncService(updatedServiceConfig)

        this.updateStatus({ type: 'success', lastSyncTime: syncTimestamp })
        this.emit('syncSuccess', {
          serviceId: serviceConfig.id,
        })
        console.log(`[SyncManager] Sync successful for ${serviceConfig.name}.`)
        return true
      } catch (error: any) {
        if (
          error.name === 'UploadConflictError' ||
          (error.status && [409, 412].includes(error.status))
        ) {
          console.warn(
            `Upload conflict detected for ${serviceConfig.name}:`,
            error.message
          )
          const conflictDetails = error.details || error.message
          this.updateStatus({
            type: 'conflict',
            details: conflictDetails,
            lastAttemptTime: Date.now(),
          })
          this.emit('syncConflict', {
            serviceId: serviceConfig.id,
            details: conflictDetails,
            error,
          })
          return false // Stop sync process on upload conflict
        }

        console.error(`Error uploading data for ${serviceConfig.name}:`, error)
        const errorMessage = `Failed to upload data for ${serviceConfig.name}: ${error.message}`
        this.emit('error', {
          message: errorMessage,
          serviceId: serviceConfig.id,
          error,
        })
        this.updateStatus({
          type: 'error',
          error: errorMessage,
          lastAttemptTime: Date.now(),
        })
        return false
      }
    } else {
      console.log(
        `[SyncManager] No changes to upload for ${serviceConfig.name}. Sync complete.`
      )
      const updatedServiceConfig: SyncServiceConfig = {
        ...serviceConfig,
        lastSyncTimestamp: syncTimestamp,
        lastSyncMeta: downloadRemoteMeta || serviceConfig.lastSyncMeta,
      }
      updateSyncService(updatedServiceConfig)

      this.updateStatus({ type: 'success', lastSyncTime: syncTimestamp })
      this.emit('syncSuccess', {
        serviceId: serviceConfig.id,
        noUploadNeeded: true,
      })
      return true
    }
  }

  private isSyncInProgress(): boolean {
    if (
      this.currentSyncStatus.type === 'initializing' ||
      this.currentSyncStatus.type === 'checking' ||
      this.currentSyncStatus.type === 'downloading' ||
      this.currentSyncStatus.type === 'uploading' ||
      this.currentSyncStatus.type === 'merging'
    ) {
      return true
    }

    return false
  }
}

// It's common to export a singleton instance of the manager
export const syncManager = new SyncManager()
