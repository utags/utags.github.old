import { get } from 'svelte/store'
import { initialBookmarks } from '../data/initial-bookmarks.js'
import { initialBookmarks as initialBookmarksCN } from '../data/initial-bookmarks-zh-CN.js'
import { bookmarkStorage } from '../lib/bookmark-storage.js'
import { isChineseLocale } from '../utils/i18n-utils.js'
import type {
  SyncServiceConfig,
  BrowserExtensionCredentials,
} from '../sync/types.js'
import { hasSyncService, addSyncService } from './sync-config-store.js'
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
  const browserExtensionSyncConfig: SyncServiceConfig = {
    id: 'default-browser-extension',
    type: 'browserExtension',
    name: 'UTags Extension',
    credentials: {
      targetExtensionId: 'utags-extension',
    } as BrowserExtensionCredentials,
    target: undefined,
    scope: 'all',
    enabled: true,
    autoSyncEnabled: true,
    autoSyncInterval: 1,
    autoSyncOnChanges: true,
    autoSyncDelayOnChanges: 0.1,
    lastSyncTimestamp: 0,
  }

  if (!hasSyncService(browserExtensionSyncConfig.id)) {
    addSyncService(browserExtensionSyncConfig)
  }
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
