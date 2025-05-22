import { STORAGE_KEY_BOOKMARKS } from '../config/constants.js'
import type {
  BookmarksStore,
  BookmarkKeyValuePair,
  BookmarkTagsAndMetadata,
  BookmarkKey,
} from '../types/bookmarks.js'
import { isNonNullObject } from '../utils/index.js'

/**
 * Bookmark Storage Service
 *
 * Responsible for saving and retrieving bookmark data from local storage or remote servers.
 * Provides methods for CRUD operations on bookmarks and manages the bookmark store structure.
 */
export class BookmarkStorage {
  /**
   * Storage key used for localStorage
   * @private
   */
  private readonly storageKey: string

  /**
   * Current database version
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  private readonly currentVersion: number = 3

  /**
   * Creates a new BookmarkStorage instance
   * @param storageKey - Custom storage key for localStorage, defaults to 'utags-bookmarks'
   */
  constructor(storageKey: string = STORAGE_KEY_BOOKMARKS) {
    this.storageKey = storageKey
  }

  /**
   * Saves bookmark store data to local storage
   *
   * @param bookmarksStore - The bookmark store data to save
   * @param skipValidation - Whether to skip validation (useful for internal calls)
   * @returns A promise that resolves when the data has been saved
   * @throws Error if saving fails or data is invalid
   */
  async saveBookmarksStore(
    bookmarksStore: BookmarksStore,
    skipValidation = false
  ): Promise<void> {
    try {
      // Validate the bookmarks store before saving if not skipped
      const validatedStore = skipValidation
        ? bookmarksStore
        : this.validateBookmarksStore(bookmarksStore, false)

      const bookmarksJson = JSON.stringify(validatedStore)
      localStorage.setItem(this.storageKey, bookmarksJson)

      const event = new CustomEvent('updateBookmarksStore')
      globalThis.dispatchEvent(event)
    } catch (error) {
      console.error('Failed to save bookmarks:', error)
      throw error
    }
  }

  /**
   * Retrieves bookmark store data from local storage
   *
   * @returns A promise that resolves with the bookmark store data
   * If no data exists, returns an initialized empty store
   * @throws Error if the database version is incompatible or validation fails
   */
  async getBookmarksStore(): Promise<BookmarksStore> {
    try {
      const bookmarksJson = localStorage.getItem(this.storageKey)
      if (bookmarksJson) {
        const parsedData = JSON.parse(bookmarksJson) as BookmarksStore

        // Validate the parsed data
        return this.validateBookmarksStore(parsedData)
      }

      // Return empty initialized data
      return this.createEmptyBookmarksStore()
    } catch (error) {
      console.error('Failed to retrieve bookmarks:', error)
      throw error
    }
  }

  /**
   * Retrieves all bookmarks as an array of key-value pairs
   *
   * @returns A promise that resolves with an array of bookmark key-value pairs
   * Returns an empty array if retrieval fails
   */
  async getBookmarksAsArray(): Promise<BookmarkKeyValuePair[]> {
    try {
      const bookmarksStore = await this.getBookmarksStore()
      return Object.entries(bookmarksStore.data) as BookmarkKeyValuePair[]
    } catch (error) {
      console.error('Failed to retrieve bookmarks as array:', error)
      throw error
    }
  }

  /**
   * Retrieves specific bookmarks as an array of key-value pairs based on provided keys
   *
   * @param bookmarkKeys - Array of bookmark URLs to retrieve
   * @returns A promise that resolves with an array of requested bookmark key-value pairs
   * @throws Error if retrieval fails
   */
  async getBookmarksAsArrayByKeys(
    bookmarkKeys: BookmarkKey[]
  ): Promise<BookmarkKeyValuePair[]> {
    try {
      const bookmarksStore = await this.getBookmarksStore()
      const bookmarksData = bookmarksStore.data

      // Filter bookmarks by the provided keys
      return bookmarkKeys
        .filter((key) => key in bookmarksData)
        .map((key) => [key, bookmarksData[key]] as BookmarkKeyValuePair)
    } catch (error) {
      console.error('Failed to retrieve specific bookmarks as array:', error)
      throw error
    }
  }

  /**
   * Updates multiple bookmarks in batch
   *
   * @param bookmarks - An array of bookmark key-value pairs to update
   * @returns A promise that resolves when all bookmarks have been updated
   * @throws Error if updating fails
   */
  async updateBookmarks(bookmarks: BookmarkKeyValuePair[]): Promise<void> {
    try {
      console.log('updateBookmarks', bookmarks)
      const bookmarksStore = await this.getBookmarksStore()

      // Update bookmark data
      for (const [key, entry] of bookmarks) {
        bookmarksStore.data[key] = entry
      }

      // Update the last modified timestamp
      bookmarksStore.meta.updated = Date.now()

      await this.saveBookmarksStore(bookmarksStore, true)
    } catch (error) {
      console.error('Failed to update bookmarks in batch:', error)
      throw error
    }
  }

  /**
   * Saves a single bookmark to local storage
   *
   * @param key - The URL of the bookmark
   * @param entry - The tags and metadata of the bookmark
   * @returns A promise that resolves when the bookmark has been saved
   * @throws Error if saving fails
   */
  async saveBookmark(
    key: BookmarkKey,
    entry: BookmarkTagsAndMetadata
  ): Promise<void> {
    try {
      const bookmarksStore = await this.getBookmarksStore()

      // Update or add the bookmark
      bookmarksStore.data[key] = entry

      // Update the last modified timestamp
      bookmarksStore.meta.updated = Date.now()

      await this.saveBookmarksStore(bookmarksStore, true)
    } catch (error) {
      console.error('Failed to save bookmark:', error)
      throw error
    }
  }

  /**
   * Deletes a bookmark from storage
   *
   * @param key - The URL of the bookmark to delete
   * @returns A promise that resolves when the bookmark has been deleted
   * @throws Error if deletion fails
   */
  async deleteBookmark(key: BookmarkKey): Promise<void> {
    try {
      const bookmarksStore = await this.getBookmarksStore()

      if (bookmarksStore.data[key]) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete bookmarksStore.data[key]
        bookmarksStore.meta.updated = Date.now()
        await this.saveBookmarksStore(bookmarksStore, true)
      }
    } catch (error) {
      console.error('Failed to delete bookmark:', error)
      throw error
    }
  }

  /**
   * Exports bookmarks store as a JSON string
   *
   * @returns A promise that resolves with the bookmarks store as a JSON string
   * @throws Error if export fails
   */
  async exportBookmarks(): Promise<string> {
    try {
      const bookmarksStore = await this.getBookmarksStore()

      // Update export timestamp
      bookmarksStore.meta.exported = Date.now()

      return JSON.stringify(bookmarksStore, null, 2) // Pretty print for export
    } catch (error) {
      console.error('Failed to export bookmarks:', error)
      throw error
    }
  }

  /**
   * Imports bookmarks from a JSON string
   *
   * @param jsonData - The JSON string containing bookmarks data
   * @returns A promise that resolves when the import is complete
   * @throws Error if import fails or data is invalid
   */
  async importBookmarks(jsonData: string): Promise<void> {
    try {
      // Parse the imported data
      const importedData = JSON.parse(jsonData) as BookmarksStore

      // Validate the imported data and handle migration if needed
      const validatedData = this.validateBookmarksStore(importedData, false)

      // Get current bookmarks store
      const currentStore = await this.getBookmarksStore()

      // Merge the imported data with existing bookmarks
      const mergedStore = {
        data: {
          ...currentStore.data,
          ...validatedData.data,
        },
        meta: {
          ...validatedData.meta,
          // updated: Date.now(), // Update the timestamp
        },
      }

      // Save the merged data (skip validation as we already validated)
      await this.saveBookmarksStore(mergedStore, true)

      console.log('Bookmarks imported successfully')
    } catch (error) {
      console.error('Failed to import bookmarks:', error)
      throw error
    }
  }

  /**
   * Creates an empty initialized bookmark store
   *
   * @returns A new empty BookmarksStore with current version and timestamps
   * @private
   */
  private createEmptyBookmarksStore(): BookmarksStore {
    return {
      data: {},
      meta: {
        databaseVersion: this.currentVersion,
        created: Date.now(),
        updated: Date.now(),
      },
    }
  }

  /**
   * Validates bookmark store data structure and version compatibility
   *
   * @param data - The data to validate
   * @param saveAfterMigration - Whether to save after migration, defaults to true
   * @returns The validated data as BookmarksStore if valid
   * @throws Error if the data structure is invalid or version is incompatible
   * @private
   */
  private validateBookmarksStore(
    data: any,
    saveAfterMigration = true
  ): BookmarksStore {
    // Validate the parsed data structure
    if (!isNonNullObject(data.data) || !isNonNullObject(data.meta)) {
      throw new Error(
        'Invalid bookmark store format: data and meta must be non-null objects'
      )
    }

    // Validate database version
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { databaseVersion } = data.meta

    // Check if databaseVersion is a number
    if (typeof databaseVersion !== 'number' || Number.isNaN(databaseVersion)) {
      throw new TypeError(
        'Invalid bookmark store format: databaseVersion must be a number'
      )
    }

    // Check if version is compatible
    if (databaseVersion > this.currentVersion) {
      throw new Error(
        `Incompatible database version: ${databaseVersion} is newer than the supported version ${this.currentVersion}`
      )
    }

    // Handle migration for older versions
    if (databaseVersion < this.currentVersion) {
      // Perform migration
      return this.migrateBookmarksStore(
        data,
        databaseVersion,
        saveAfterMigration
      )
    }

    return data as BookmarksStore
  }

  /**
   * Migrates bookmark store data from older versions to the current version
   *
   * @param oldStore - The old bookmark store data
   * @param oldVersion - The version of the old bookmark store
   * @param saveAfterMigration - Whether to save the migrated data, defaults to true
   * @returns The migrated bookmark store data
   * @private
   */
  private migrateBookmarksStore(
    oldStore: any,
    oldVersion: number,
    saveAfterMigration = true
  ): BookmarksStore {
    console.log(
      `Migrating bookmarks from version ${oldVersion} to version ${this.currentVersion}`
    )

    // Create a copy of the old store
    const newStore: BookmarksStore = {
      data: { ...(oldStore.data as BookmarksStore['data']) },
      meta: {
        ...(oldStore.meta as BookmarksStore['meta']),
        databaseVersion: this.currentVersion,
        updated: Date.now(),
      },
    }

    let migrationVersion = oldVersion

    // Version-specific migrations - apply sequentially
    if (migrationVersion === 1) {
      // Migrate from version 1 to 2
      this.migrateV1toV2(newStore)

      migrationVersion = 2
    }

    if (migrationVersion === 2) {
      // Migrate from version 2 to 3
      this.migrateV2toV3(newStore)

      migrationVersion = 3
    }

    // Save the migrated store if required
    if (saveAfterMigration) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.saveBookmarksStore(newStore, true) // Skip validation as we just validated
      } catch (error) {
        console.error('Failed to save migrated bookmarks:', error)
      }
    }

    return newStore
  }

  /**
   * Migrates bookmark store from version 1 to version 2
   *
   * @param store - The store to migrate
   * @private
   */
  private migrateV1toV2(store: BookmarksStore): void {
    // Implement version 1 to 2 migration logic
    // Example: Add missing fields or transform data structure
    console.log('Migrating from version 1 to 2')
  }

  /**
   * Migrates bookmark store from version 2 to version 3
   *
   * @param store - The store to migrate
   * @private
   */
  private migrateV2toV3(store: BookmarksStore): void {
    // Implement version 2 to 3 migration logic
    // Example: Update data structure or add new required fields
    console.log('Migrating from version 2 to 3')
  }
}

// Create singleton instance
export const bookmarkStorage = new BookmarkStorage()
