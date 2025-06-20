import { get } from 'svelte/store'
import { initialBookmarks } from '../data/initial-bookmarks.js'
import { initialBookmarks as initialBookmarksCN } from '../data/initial-bookmarks-zh-CN.js'
import { bookmarkStorage } from '../lib/bookmark-storage.js'
import { isChineseLocale } from '../utils/i18n-utils.js'
import type {
  SyncServiceConfig,
  ApiCredentials,
  ApiTarget,
} from '../sync/types.js'
import { settingsStore } from './settings-store.js'
import { filters } from './saved-filters.js'
import { getCollections } from './collections.js'
import { settings } from './stores.js'

function initializeSettings() {
  console.log('initializing settings')
  const $settings = get(settings)
  console.log($settings.headerToolbarSettings)
  if (!$settings.headerToolbarSettings) {
    const headerToolbarSettings = {
      theme: false,
      sortBy: true,
      sidebarPosition: false,
      viewMode: true,
      skin: false,
      toggleNavbar: true,
      addButton: true,
    }
    settings.set({ ...$settings, headerToolbarSettings })
  }

  if ($settings.isFirstRun) {
    $settings.isFirstRun = false
    settings.set($settings)
  }
}

async function initializeBookmarks() {
  if (get(settings).isFirstRun) {
    // Initial bookmarks
    await bookmarkStorage.upsertBookmarks(
      Object.entries(isChineseLocale() ? initialBookmarksCN : initialBookmarks)
    )
  }
}

function initializeCollections() {
  const collections = getCollections()
  const $collections = get(collections)
  if ($collections.length === 0) {
    const now = Date.now()
    const collectionsPreset = isChineseLocale()
      ? [
          {
            id: crypto.randomUUID(),
            name: '稍后阅读',
            pathname: 'read-later',
            filterString: `t=${[
              'read-later',
              'Read Later',
              '稍后阅读',
              'toread',
            ].join(',')}`,
            created: now,
            updated: now,
          },
          {
            id: crypto.randomUUID(),
            name: '论坛社区',
            pathname: 'communities',
            filterString: `t=${['论坛', '社区'].join(',')}`,
            created: now,
            updated: now,
          },
        ]
      : [
          {
            id: crypto.randomUUID(),
            name: 'Read Later',
            pathname: 'read-later',
            filterString: `t=${['read-later', 'Read Later', 'toread'].join(
              ','
            )}`,
            created: now,
            updated: now,
          },
          {
            id: crypto.randomUUID(),
            name: 'Communities',
            pathname: 'communities',
            filterString: `t=${['Forum', 'Community'].join(',')}`,
            created: now,
            updated: now,
          },
        ]

    for (const preset of collectionsPreset) {
      $collections.push(preset)
    }

    collections.set($collections)
  }
}

function initializeFilters() {
  const $filters = get(filters)
  if ($filters.length === 0) {
    const now = Date.now()
    const filtersPreset = isChineseLocale()
      ? [
          {
            id: crypto.randomUUID(),
            name: 'Tools',
            description: '好用的工具',
            filterString: `#${encodeURIComponent('工具,Tools')}`,
            created: now,
            updated: now,
          },
          {
            id: crypto.randomUUID(),
            name: '浏览器扩展',
            description: '好用的浏览器扩展',
            filterString: `#${encodeURIComponent('浏览器扩展')}`,
            created: now,
            updated: now,
          },
        ]
      : [
          {
            id: crypto.randomUUID(),
            name: 'Tools',
            description: 'Useful tools',
            filterString: '#Tools',
            created: now,
            updated: now,
          },
          {
            id: crypto.randomUUID(),
            name: 'Browser Extensions',
            description: 'Useful browser extensions',
            filterString: `#${encodeURIComponent('Browser Extension')}`,
            created: now,
            updated: now,
          },
        ]

    for (const preset of filtersPreset) {
      $filters.push(preset)
    }

    filters.set($filters)
  }
}

function initializeSyncServices() {
  // TODO: initialize sync services
  const mockApiUrl = 'http://localhost:3001'
  const baseConfig: SyncServiceConfig = {
    id: 'test-custom-api',
    type: 'customApi',
    name: 'Test Custom API',
    credentials: {
      token: 'test-auth-token',
      // apiKey: 'test-api-key', // Uncomment if your mock server uses X-API-Key
    } as ApiCredentials,
    target: {
      url: mockApiUrl,
      filePath: 'test-bookmarks-1.json',
      authTestEndpoint: 'auth/status',
    } as ApiTarget,
    scope: 'all',
    enabled: true,
    autoSyncInterval: 1,
    autoSyncOnChanges: true,
    autoSyncDelayOnChanges: 0.1,
    lastSyncTimestamp: 0,
  }
  const githubConfig: SyncServiceConfig = {
    id: 'test-github-api',
    type: 'github',
    name: 'Test GitHub API',
    credentials: {
      token: 'my-token',
    },
    target: {
      repo: 'user/repo',
      path: 'bookmarks-data.json',
      branch: 'main',
    },
    scope: 'all',
    enabled: true,
    autoSyncInterval: 1,
    autoSyncOnChanges: true,
    autoSyncDelayOnChanges: 0.1,
    lastSyncTimestamp: 0,
  }
  const webdavConfig: SyncServiceConfig = {
    id: 'test-webdav-config-1',
    type: 'webdav',
    name: 'Test WebDAV Service',
    credentials: {
      serverUrl: 'https://www.webdavserver.com/User485b088',
      username: 'User485b088',
      password: 'testpassword',
    },
    target: {
      path: 'utags/bookmarks.json', // Relative path to serverUrl
    },
    scope: 'all',
    enabled: true,
    autoSyncInterval: 1,
    autoSyncOnChanges: true,
    autoSyncDelayOnChanges: 0.1,
    lastSyncTimestamp: 0,
  }
  const extensionConfig: SyncServiceConfig = {
    id: 'test-ext-sync',
    type: 'browserExtension',
    name: 'Test Extension Sync',
    credentials: { targetExtensionId: 'mock-extension-id' },
    target: {},
    enabled: true,
    scope: 'all',
    autoSyncInterval: 1,
    autoSyncOnChanges: true,
    autoSyncDelayOnChanges: 0.1,
    lastSyncTimestamp: 0,
  }
  settingsStore.set({
    // syncServices: [baseConfig, githubConfig, webdavConfig, extensionConfig],
    syncServices: [baseConfig, extensionConfig],
    activeSyncServiceId: baseConfig.id,
  })
}

export default async function initializeStores() {
  const $settings = get(settings)

  await initializeBookmarks()

  // only run once
  if ($settings.isFirstRun) {
    initializeCollections()
  }

  initializeFilters()

  // run every time when loading stores
  initializeSettings()

  initializeSyncServices()
}
