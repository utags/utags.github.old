import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get } from 'svelte/store'
import type { SyncServiceConfig } from '../sync/types.js'
import {
  syncConfigStore,
  addSyncService,
  updateSyncService,
  removeSyncService,
  hasSyncService,
  setActiveSyncService,
  getSyncServiceById,
  type SyncSettings,
} from './sync-config-store.js'

describe('sync-config-store', () => {
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
  }
  globalThis.localStorage = localStorageMock as any

  // Sample sync service configurations for testing
  const githubConfig: SyncServiceConfig = {
    id: 'github-1',
    type: 'github',
    name: 'GitHub Sync',
    enabled: true,
    scope: 'all',
    target: {
      repo: 'user/repo',
      branch: 'main',
      path: '/bookmarks',
    },
    credentials: {
      token: 'github-token',
    },
  }

  const webdavConfig: SyncServiceConfig = {
    id: 'webdav-1',
    type: 'webdav',
    name: 'WebDAV Sync',
    enabled: true,
    scope: 'all',
    target: {
      url: 'https://webdav.example.com',
      path: '/bookmarks',
    },
    credentials: {
      username: 'user',
      password: 'pass',
    },
  }

  const customApiConfig: SyncServiceConfig = {
    id: 'api-1',
    type: 'customApi',
    name: 'Custom API Sync',
    enabled: true,
    scope: 'all',
    target: {
      url: 'https://api.example.com',
      path: '/sync',
    },
    credentials: {
      token: 'api-token',
    },
  }

  beforeEach(() => {
    // Clear all mocks and reset store
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    syncConfigStore.set({ syncServices: [], activeSyncServiceId: undefined })
  })

  // Sample browser extension service configuration
  const browserExtensionConfig: SyncServiceConfig = {
    id: 'browser-ext-1',
    type: 'browserExtension',
    name: 'Browser Extension Sync',
    enabled: true,
    scope: 'all',
    credentials: {
      token: 'extension-token',
    },
    target: undefined,
  }

  describe('validateSyncServiceConfig', () => {
    it('should throw error for invalid service type', () => {
      const invalidConfig = {
        ...githubConfig,
        type: 'invalid' as any,
      }
      expect(() => {
        addSyncService(invalidConfig)
      }).toThrow('Invalid sync service type')
    })

    it('should throw error for missing target in non-browserExtension service', () => {
      const invalidConfig = {
        ...githubConfig,
        target: undefined,
      }
      expect(() => {
        addSyncService(invalidConfig)
      }).toThrow('Missing required field: target')
    })

    it('should allow missing target for browserExtension service', () => {
      expect(() => {
        addSyncService(browserExtensionConfig)
      }).not.toThrow()
    })

    it('should throw error for invalid GitHub credentials', () => {
      const invalidConfig = {
        ...githubConfig,
        credentials: {},
      }
      expect(() => {
        addSyncService(invalidConfig)
      }).toThrow('Invalid credentials')
    })

    it('should throw error for invalid WebDAV credentials', () => {
      const invalidConfig = {
        ...webdavConfig,
        credentials: {
          username: 'user',
          // Missing password
        },
      }
      expect(() => {
        addSyncService(invalidConfig)
      }).toThrow('Invalid credentials')
    })

    it('should throw error for invalid GitHub repository path', () => {
      const invalidConfig = {
        ...githubConfig,
        target: {
          ...githubConfig.target,
          repo: '',
        },
      }
      expect(() => {
        addSyncService(invalidConfig)
      }).toThrow('Invalid repository path')
    })

    it('should throw error for invalid WebDAV URL format', () => {
      const invalidConfig = {
        ...webdavConfig,
        target: {
          ...webdavConfig.target,
          url: 'invalid-url',
        },
      }
      expect(() => {
        addSyncService(invalidConfig)
      }).toThrow('Invalid WebDAV URL format')
    })

    it('should allow customApi service with apiKey', () => {
      const apiConfigWithApiKey: SyncServiceConfig = {
        ...customApiConfig,
        id: 'api-with-apikey',
        credentials: {
          apiKey: 'my-api-key',
        },
      }
      expect(() => {
        addSyncService(apiConfigWithApiKey)
      }).not.toThrow()
    })

    it('should throw error for invalid Custom API credentials', () => {
      const invalidConfig = {
        ...customApiConfig,
        credentials: {},
      }
      expect(() => {
        addSyncService(invalidConfig)
      }).toThrow('Invalid credentials')
    })

    it('should throw error for invalid Custom API URL format', () => {
      const invalidConfig = {
        ...customApiConfig,
        target: {
          ...customApiConfig.target,
          url: 'invalid-url',
        },
      }
      expect(() => {
        addSyncService(invalidConfig)
      }).toThrow('Invalid API URL format')
    })
  })

  describe('addSyncService', () => {
    it('should add a new GitHub sync service', () => {
      addSyncService(githubConfig)
      const store = get(syncConfigStore)
      expect(store.syncServices).toHaveLength(1)
      expect(store.syncServices[0]).toEqual(githubConfig)
    })

    it('should add multiple sync services', () => {
      addSyncService(githubConfig)
      addSyncService(webdavConfig)
      const store = get(syncConfigStore)
      expect(store.syncServices).toHaveLength(2)
      expect(store.syncServices).toContainEqual(githubConfig)
      expect(store.syncServices).toContainEqual(webdavConfig)
    })

    it('should throw error when adding service with duplicate ID', () => {
      addSyncService(githubConfig)
      expect(() => {
        addSyncService(githubConfig)
      }).toThrow('Service ID already exists')
    })
  })

  describe('updateSyncService', () => {
    it('should update an existing sync service', () => {
      addSyncService(githubConfig)
      const updatedConfig = {
        ...githubConfig,
        name: 'Updated GitHub Sync',
        target: {
          ...githubConfig.target,
          branch: 'develop',
        },
      }
      updateSyncService(updatedConfig)
      const store = get(syncConfigStore)
      expect(store.syncServices[0]).toEqual(updatedConfig)
    })

    it('should reset sync metadata when critical configuration changes', () => {
      const configWithMeta = {
        ...githubConfig,
        lastSyncTimestamp: 123_456_789,
        lastSyncLocalDataHash: 'hash123',
        lastSyncMeta: {
          timestamp: 123_456_789,
          version: 'v1',
          sha: 'hash123',
        },
      }
      addSyncService(configWithMeta)

      const updatedConfig = {
        ...configWithMeta,
        target: {
          ...configWithMeta.target,
          repo: 'user/new-repo',
        },
      }
      updateSyncService(updatedConfig)
      const store = get(syncConfigStore)
      const updated = store.syncServices[0]
      expect(updated.lastSyncTimestamp).toBeUndefined()
      expect(updated.lastSyncLocalDataHash).toBeUndefined()
      expect(updated.lastSyncMeta).toBeUndefined()
    })

    it('should not reset sync metadata when non-critical configuration changes', () => {
      const configWithMeta = {
        ...githubConfig,
        lastSyncTimestamp: 123_456_789,
        lastSyncLocalDataHash: 'hash123',
        lastSyncMeta: {
          timestamp: 123_456_789,
          version: 'v1',
          sha: 'hash123',
        },
      }
      addSyncService(configWithMeta)

      const updatedConfig = {
        ...configWithMeta,
        name: 'Updated Name',
        enabled: false,
      }
      updateSyncService(updatedConfig)
      const store = get(syncConfigStore)
      const updated = store.syncServices[0]
      expect(updated.lastSyncTimestamp).toBe(123_456_789)
      expect(updated.lastSyncLocalDataHash).toBe('hash123')
      expect(updated.lastSyncMeta).toEqual(configWithMeta.lastSyncMeta)
    })

    it('should reset sync metadata for all critical configuration changes', () => {
      const configWithMeta = {
        ...webdavConfig,
        lastSyncTimestamp: 123_456_789,
        lastSyncLocalDataHash: 'hash123',
        lastSyncMeta: {
          timestamp: 123_456_789,
          version: 'v1',
          sha: 'hash123',
        },
      }
      addSyncService(configWithMeta)

      // Test URL change
      let updatedConfig = {
        ...configWithMeta,
        target: {
          ...configWithMeta.target,
          url: 'https://new-webdav.example.com',
        },
      }
      updateSyncService(updatedConfig)
      let store = get(syncConfigStore)
      let updated = store.syncServices[0]
      expect(updated.lastSyncTimestamp).toBeUndefined()
      expect(updated.lastSyncLocalDataHash).toBeUndefined()
      expect(updated.lastSyncMeta).toBeUndefined()

      // Reset store for the next test case by re-adding the service with metadata
      // This ensures the test for the 'path' change is independent
      syncConfigStore.set({ syncServices: [], activeSyncServiceId: undefined })
      addSyncService(configWithMeta)
      store = get(syncConfigStore)
      updated = store.syncServices[0]
      expect(updated.lastSyncTimestamp).toEqual(
        configWithMeta.lastSyncTimestamp
      )
      expect(updated.lastSyncLocalDataHash).toEqual(
        configWithMeta.lastSyncLocalDataHash
      )
      expect(updated.lastSyncMeta).toEqual(configWithMeta.lastSyncMeta)

      // Test path change
      updatedConfig = {
        ...configWithMeta,
        target: {
          ...configWithMeta.target,
          path: '/new-path',
        },
      }
      updateSyncService(updatedConfig)
      store = get(syncConfigStore)
      updated = store.syncServices[0]
      expect(updated.lastSyncTimestamp).toBeUndefined()
      expect(updated.lastSyncLocalDataHash).toBeUndefined()
      expect(updated.lastSyncMeta).toBeUndefined()
    })

    it('should throw error when trying to change service type', () => {
      addSyncService(githubConfig)
      const invalidUpdate = {
        ...githubConfig,
        type: 'webdav' as const,
      }
      expect(() => {
        updateSyncService(invalidUpdate)
      }).toThrow('Cannot change sync service type from github to webdav')
    })

    it('should return unchanged settings when service not found', () => {
      const nonExistentConfig = {
        ...githubConfig,
        id: 'non-existent',
      }
      const beforeUpdate = get(syncConfigStore)
      updateSyncService(nonExistentConfig)
      const afterUpdate = get(syncConfigStore)
      expect(afterUpdate).toEqual(beforeUpdate)
    })

    it('should throw error when updating with invalid config', () => {
      addSyncService(githubConfig)
      const invalidUpdate = {
        ...githubConfig,
        credentials: {},
      }
      expect(() => {
        updateSyncService(invalidUpdate)
      }).toThrow('Invalid credentials')
    })
  })

  describe('removeSyncService', () => {
    beforeEach(() => {
      addSyncService(githubConfig)
      addSyncService(webdavConfig)
    })

    it('should remove a sync service', () => {
      removeSyncService(githubConfig.id)
      const store = get(syncConfigStore)
      expect(store.syncServices).toHaveLength(1)
      expect(store.syncServices[0]).toEqual(webdavConfig)
    })

    it('should reset activeSyncServiceId when removing active service', () => {
      setActiveSyncService(githubConfig.id)
      removeSyncService(githubConfig.id)
      const store = get(syncConfigStore)
      expect(store.activeSyncServiceId).toBeUndefined()
    })

    it('should keep activeSyncServiceId when removing non-active service', () => {
      setActiveSyncService(githubConfig.id)
      removeSyncService(webdavConfig.id)
      const store = get(syncConfigStore)
      expect(store.activeSyncServiceId).toBe(githubConfig.id)
    })

    it('should handle removing non-existent service', () => {
      const store = get(syncConfigStore)
      const beforeRemove = store.syncServices.length
      removeSyncService('non-existent')
      expect(store.syncServices).toHaveLength(beforeRemove)
    })
  })

  describe('hasSyncService', () => {
    it('should return true for existing service', () => {
      addSyncService(githubConfig)
      expect(hasSyncService(githubConfig.id)).toBe(true)
    })

    it('should return false for non-existent service', () => {
      expect(hasSyncService('non-existent')).toBe(false)
    })
  })

  describe('setActiveSyncService', () => {
    beforeEach(() => {
      // Reset the store before each test in this block
      syncConfigStore.set({ syncServices: [], activeSyncServiceId: undefined })
      addSyncService(githubConfig)
      addSyncService(webdavConfig)
    })

    it('should set active sync service', () => {
      setActiveSyncService(githubConfig.id)
      const store = get(syncConfigStore)
      expect(store.activeSyncServiceId).toBe(githubConfig.id)
    })

    it('should unset active sync service when passing undefined', () => {
      setActiveSyncService(githubConfig.id)
      setActiveSyncService(undefined)
      const store = get(syncConfigStore)
      expect(store.activeSyncServiceId).toBeUndefined()
    })

    it('should not set non-existent service as active', () => {
      setActiveSyncService('non-existent')
      const store = get(syncConfigStore)
      expect(store.activeSyncServiceId).toBeUndefined()
    })

    it('should not set disabled service as active', () => {
      const disabledConfig = {
        ...githubConfig,
        id: 'disabled-service',
        enabled: false,
      }
      addSyncService(disabledConfig)
      setActiveSyncService(disabledConfig.id)
      const store = get(syncConfigStore)
      expect(store.activeSyncServiceId).toBeUndefined()
    })
  })

  describe('getSyncServiceById', () => {
    beforeEach(() => {
      addSyncService(githubConfig)
    })

    it('should return service by id', () => {
      const store = get(syncConfigStore)
      const service = getSyncServiceById(store, githubConfig.id)
      expect(service).toEqual(githubConfig)
    })

    it('should return undefined for non-existent service', () => {
      const store = get(syncConfigStore)
      const service = getSyncServiceById(store, 'non-existent')
      expect(service).toBeUndefined()
    })
  })

  describe('localStorage integration', () => {
    const largeConfig = {
      ...githubConfig,
      // Add large data to test storage limits
      lastSyncMeta: {
        timestamp: Date.now(),
        version: 'v1',
        sha: 'a'.repeat(1024 * 1024), // 1MB of data
      },
    }
    it('should load settings from localStorage', async () => {
      const savedSettings = {
        syncServices: [githubConfig],
        activeSyncServiceId: githubConfig.id,
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedSettings))

      // Re-initialize store by importing the module again
      vi.resetModules()
      const { syncConfigStore } = await import('./sync-config-store.js')
      const store = get(syncConfigStore)
      expect(store).toEqual(savedSettings)
    })

    it('should save settings to localStorage when updated', () => {
      addSyncService(githubConfig)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'utags-sync-settings',
        expect.any(String)
      )
      const lastCall = localStorageMock.setItem.mock.calls.length - 1
      const savedData = JSON.parse(
        localStorageMock.setItem.mock.calls[lastCall][1] as string
      ) as SyncSettings
      expect(savedData.syncServices).toContainEqual(githubConfig)
    })

    it('should handle invalid localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      const store = get(syncConfigStore)
      expect(store).toEqual({
        syncServices: [],
        activeSyncServiceId: undefined,
      })
    })

    it('should handle missing syncServices array in localStorage', () => {
      localStorageMock.getItem.mockReturnValue(
        JSON.stringify({ activeSyncServiceId: 'some-id' })
      )
      const store = get(syncConfigStore)
      expect(store.syncServices).toEqual([])
    })

    it('should handle localStorage quota exceeded error', () => {
      // Mock localStorage.setItem to throw quota exceeded error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError')
      })

      // Adding a service with large data should not throw but log error
      const consoleSpy = vi.spyOn(console, 'error')
      addSyncService(largeConfig)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error saving sync settings to localStorage:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })

    it('should filter out invalid services from localStorage', async () => {
      const invalidServices = {
        syncServices: [
          githubConfig,
          { id: 'invalid' }, // Missing required fields
          null,
          undefined,
          { ...webdavConfig, type: 'invalid' }, // Invalid type
        ],
        activeSyncServiceId: githubConfig.id,
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidServices))

      // Re-initialize store
      vi.resetModules()
      const { syncConfigStore: newStore } = await import(
        './sync-config-store.js'
      )
      const store = get(newStore)
      expect(store.syncServices).toHaveLength(1)
      expect(store.syncServices[0]).toEqual(githubConfig)
      expect(store.activeSyncServiceId).toBe(githubConfig.id)
    })

    it('should handle syncServices not being an array in localStorage', async () => {
      const invalidSettings = {
        syncServices: { not: 'an array' },
        activeSyncServiceId: 'some-id',
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidSettings))

      vi.resetModules()
      const { syncConfigStore: newStore } = await import(
        './sync-config-store.js'
      )
      const store = get(newStore)
      expect(store.syncServices).toEqual([])
      expect(store.activeSyncServiceId).toBeUndefined()
    })

    it('should clear activeSyncServiceId if the active service is invalid and filtered out', async () => {
      const invalidServices = {
        syncServices: [
          githubConfig, // a valid service
          { ...webdavConfig, id: 'active-but-invalid', type: 'invalid' },
        ],
        activeSyncServiceId: 'active-but-invalid',
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidServices))

      vi.resetModules()
      const { syncConfigStore: newStore } = await import(
        './sync-config-store.js'
      )
      const store = get(newStore)
      expect(store.syncServices).toHaveLength(1)
      expect(store.syncServices[0]).toEqual(githubConfig)
      expect(store.activeSyncServiceId).toBeUndefined()
    })
  })
})
