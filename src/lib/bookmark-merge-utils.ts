import {
  type BookmarkTagsAndMetadata,
  type BookmarksData,
} from '../types/bookmarks.js'
import { DELETED_BOOKMARK_TAG } from '../config/constants.js'
import {
  type MergeMetaStrategy,
  type MergeTagsStrategy,
} from '../config/merge-options.js'
import { isValidDate } from '../utils/date.js'
import { processInBatches } from './batch-processor.js'

/**
 * Defines the strategy for merging bookmarks from local and remote sources.
 */
export type MergeStrategy = {
  /** Strategy for merging titles. default is 'merge' */
  meta: MergeMetaStrategy
  /** Strategy for merging tags. default is 'union' or 'merge' */
  tags: MergeTagsStrategy
  /** Default date to use if created/updated timestamps are invalid. Can be a timestamp number or a date string. */
  defaultDate: number | string
  /** If true, skips merging existing bookmarks. Defaults to false. */
  skipExisting?: boolean
  /** If true, an update operation will take precedence over a delete operation. Defaults to true. */
  updateOverDelete?: boolean
  /** If true, local deleted bookmarks can be overwritten by remote non-deleted versions. */
  overwriteLocalDeleted?: boolean
  /** If true, remote deleted bookmarks can be overwritten by local non-deleted versions. (Reserved for future use) */
  overwriteRemoteDeleted?: boolean
}

/**
 * Options for synchronization operations.
 */
export type SyncOption = {
  /** The current timestamp, used as a reference for new or updated items. */
  currentTime: number
  /** The timestamp of the last successful synchronization. */
  lastSyncTime: number
}

/**
 * Normalizes the metadata of a bookmark, ensuring 'created' and 'updated' timestamps are valid.
 * If 'created' is invalid, both 'created' and 'updated' are set to 'defaultDate'.
 * If 'updated' is invalid but 'created' is valid, 'updated' is set to 'created'.
 * This function directly modifies the 'meta' object of the provided bookmark data.
 * It does not explicitly handle 'updated2' as its validity is usually tied to specific operations like sync or import.
 * @param {BookmarkTagsAndMetadata | undefined} data - The bookmark data to normalize. Can be undefined.
 * @param {number} defaultDate - The default timestamp to use if 'created' is invalid.
 */
function normalizeBookmark(
  data: BookmarkTagsAndMetadata | undefined,
  defaultDate: number
): void {
  if (!data || !data.meta) {
    // Log or handle the case where data or data.meta is undefined, if necessary
    // console.warn('normalizeBookmark: Received undefined data or meta.');
    return // Early return if data or meta is not present
  }

  const meta = data.meta
  const { created, updated } = meta

  if (!isValidDate(created)) {
    meta.created = defaultDate
    // When created is invalid, updated should also be set to defaultDate,
    // as 'updated' should not be earlier than 'created'.
    meta.updated = defaultDate
  } else if (!isValidDate(updated)) {
    meta.updated = created
  }

  // Ensure updated2 is not earlier than updated or created if it exists
  if (meta.updated2 && meta.updated2 < Math.max(meta.created, meta.updated)) {
    // This case might indicate an inconsistency. Depending on the desired behavior,
    // it could be logged, or updated2 could be adjusted.
    // For now, we assume updated2 is managed correctly by the calling process (e.g., sync, import)
  }
}

/**
 * Gets the most recent update timestamp from a bookmark's metadata.
 * It considers 'created', 'updated' (manual user edit timestamp), and 'updated2' (any modification timestamp).
 * This is useful for determining the effective last modification time for sync logic or conflict resolution.
 * @param {BookmarkTagsAndMetadata['meta']} meta - The metadata object of a bookmark.
 * @returns {number} The latest timestamp among created, updated, and updated2 (if present, otherwise 0 for updated2).
 */
function getUpdated(meta: BookmarkTagsAndMetadata['meta']): number {
  return Math.max(meta.created, meta.updated, meta.updated2 || 0)
}

/**
 * Checks if a bookmark is considered valid for synchronization based on its last update time.
 * A bookmark is valid if it exists and its most recent update timestamp (obtained via getUpdated)
 * is greater than or equal to the 'lastSyncTime'.
 * @param {BookmarkTagsAndMetadata | undefined} data - The bookmark data to check. Can be undefined if the bookmark doesn't exist on one side.
 * @param {number} lastSyncTime - The timestamp of the last successful synchronization.
 * @returns {boolean} True if the bookmark is valid for sync, false otherwise.
 */
function isValid(
  data: BookmarkTagsAndMetadata | undefined,
  lastSyncTime: number
): data is BookmarkTagsAndMetadata {
  // Type predicate to narrow down type
  return Boolean(data) && getUpdated(data!.meta) >= lastSyncTime
}

/**
 * Checks if a bookmark is marked as deleted.
 * A bookmark is considered deleted if its tags array includes the 'DELETED_BOOKMARK_TAG'.
 * @param {BookmarkTagsAndMetadata} data - The bookmark data to check.
 * @returns {boolean} True if the bookmark is marked as deleted, false otherwise.
 */
function isDeleted(data: BookmarkTagsAndMetadata): boolean {
  return data.tags.includes(DELETED_BOOKMARK_TAG)
}

/**
 * Merges local and remote bookmark data based on the provided strategy and sync options.
 * This function processes bookmarks in batches to avoid blocking the main thread.
 * @param {BookmarksData | undefined} localDataInput - The local bookmarks data. Should not be modified directly.
 * @param {BookmarksData | undefined} remoteDataInput - The remote bookmarks data. Should not be modified directly.
 * @param {MergeStrategy} strategy - The strategy to use for merging.
 * @param {SyncOption} syncOption - Options for the synchronization process.
 * @returns {Promise<{ merged: BookmarksData; deleted: string[] }>} A promise that resolves to an object containing the merged data and a list of deleted bookmark URLs.
 */
export async function mergeBookmarks(
  localDataInput: BookmarksData | undefined,
  remoteDataInput: BookmarksData | undefined,
  strategy: MergeStrategy,
  syncOption: SyncOption
): Promise<{
  merged: BookmarksData
  deleted: string[] // URLs of bookmarks that were deleted during the merge
}> {
  // Basic error handling for input data
  if (!localDataInput || !remoteDataInput) {
    console.error(
      'mergeBookmarks: Invalid input data. LocalData or RemoteData is undefined.'
    )
    return {
      merged: {},
      deleted: [],
    }
  }

  // Clone data to avoid modifying original objects
  const localData = structuredClone(localDataInput)
  const remoteData = structuredClone(remoteDataInput)

  const defaultDate = new Date(strategy.defaultDate).getTime()
  const { lastSyncTime = 0 } = syncOption

  const merged: BookmarksData = {}
  const deletedUrls: string[] = [] // Keep track of deleted bookmark URLs

  // Collect all URLs to process from both local and remote data
  const allUrls = Array.from(
    new Set([...Object.keys(localData), ...Object.keys(remoteData)])
  )

  const batchSize = 100 // Process 100 URLs per batch

  await processInBatches(
    allUrls,
    async (batchUrls) => {
      for (const url of batchUrls) {
        const local = localData[url]
        const remote = remoteData[url]

        // Normalize timestamps before comparison
        normalizeBookmark(local, defaultDate)
        normalizeBookmark(remote, defaultDate)

        const localValid = isValid(local, lastSyncTime)
        const remoteValid = isValid(remote, lastSyncTime)

        if (local && remote) {
          // Case 1: Bookmark exists in both local and remote
          const data = mergeBothSources(
            local,
            localValid,
            remote,
            remoteValid,
            strategy
          )
          if (data) {
            // Update created, updated, and updated2 timestamps for the merged entry
            data.meta.created = Math.min(
              local.meta.created,
              remote.meta.created
            )
            data.meta.updated = Math.max(
              local.meta.updated,
              remote.meta.updated
            )
            // Ensure updated2 is always the latest, incrementing to avoid conflicts with exact same timestamps from other sources
            data.meta.updated2 =
              Math.max(getUpdated(local.meta), getUpdated(remote.meta)) + 1

            merged[url] = data
          } else {
            // If mergeBothSources returns undefined, it means both are invalid and should
            // simply ignored or keep local data.
            // This case is handled by the fact that 'merged[url]' won't be set.
            // If it was previously deleted and now both are invalid, it remains deleted.
            // Since we will use `BookmarkStorage.updateBookmarks` to update the bookmarks,
            // this case will be handled correctly.
          }
        } else if (local && !remote) {
          // Case 2: Bookmark exists only locally
          if (localValid) {
            merged[url] = local // Keep local if it's valid (updated since last sync)
          } else {
            // If local is not valid (not updated since last sync), it implies it might have been deleted on remote
            // or it's an old entry. We mark it for deletion from the merged set.
            deletedUrls.push(url)
          }
        } else if (!local && remote) {
          // Case 3: Bookmark exists only remotely
          if (remoteValid) {
            merged[url] = remote // Keep remote if it's valid (updated since last sync)
          } else {
            // If remote is not valid, it implies it might have been deleted locally
            // or it's an old entry. We mark it for deletion from the merged set.
            deletedUrls.push(url)
          }
        } else {
          // Case 4: Bookmark exists in neither (should not happen if allUrls is derived from keys of localData and remoteData)
          // This case implies an issue with allUrls collection or data integrity.
          // console.warn(`Bookmark with URL ${url} found in neither local nor remote data during merge.`)
        }
      }
    },
    {
      batchSize,
      onProgress({ processedItems, totalItems }) {
        console.log(
          `Processed URLs ${Math.max(processedItems - batchSize, 0) + 1} to ${processedItems} of ${totalItems}`
        )
      },
    }
  )

  return { merged, deleted: deletedUrls }
}

/**
 * Merges bookmark data when it exists in both local and remote sources.
 * Determines the final state based on validity (recency) and merge strategy.
 * @param {BookmarkTagsAndMetadata} local - The local version of the bookmark.
 * @param {boolean} localValid - Whether the local version is valid (updated since last sync).
 * @param {BookmarkTagsAndMetadata} remote - The remote version of the bookmark.
 * @param {boolean} remoteValid - Whether the remote version is valid (updated since last sync).
 * @param {MergeStrategy} mergeStrategy - The overall merge strategy configuration.
 * @returns {BookmarkTagsAndMetadata | undefined} The merged bookmark data, or undefined if both are invalid.
 */
// eslint-disable-next-line max-params
function mergeBothSources(
  local: BookmarkTagsAndMetadata,
  localValid: boolean,
  remote: BookmarkTagsAndMetadata,
  remoteValid: boolean,
  mergeStrategy: MergeStrategy
): BookmarkTagsAndMetadata | undefined {
  // Ignore if both local and remote versions are outdated (not valid)
  if (!localValid && !remoteValid) {
    return undefined
  }

  // If only remote is valid, take remote
  if (!localValid && remoteValid) {
    return remote
  }

  // If only local is valid, take local
  if (localValid && !remoteValid) {
    return local
  }

  // If both are valid, merge them based on strategy
  // Both localValid and remoteValid are true at this point
  return mergeUpdates(local, remote, mergeStrategy)
}

/**
 * Merges updates from local and remote bookmarks when both are considered valid.
 * This function handles the merging of tags and metadata based on the specified strategies.
 * @param {BookmarkTagsAndMetadata} local - The local bookmark data.
 * @param {BookmarkTagsAndMetadata} remote - The remote bookmark data.
 * @param {MergeStrategy} mergeStrategy - The strategy defining how to merge tags and metadata.
 * @returns {BookmarkTagsAndMetadata} The resulting merged bookmark data.
 */
function mergeUpdates(
  local: BookmarkTagsAndMetadata,
  remote: BookmarkTagsAndMetadata, // Removed localValid, remoteValid as they are true by this point
  mergeStrategy: MergeStrategy
): BookmarkTagsAndMetadata {
  const mergeTagsStrategy = mergeStrategy.tags
  const mergeMetaStrategy = mergeStrategy.meta

  // Merge tags based on the specified strategy
  const mergedTags = mergeTags(local, remote, mergeTagsStrategy)

  // Merge metadata based on the specified strategy
  const mergedMeta = mergeMeta(local, remote, mergeMetaStrategy)

  // If the merged tags include the DELETED_BOOKMARK_TAG, also merge the deletedMeta
  const mergedDeletedMetaValue = mergedTags.includes(DELETED_BOOKMARK_TAG)
    ? mergeDeletedMeta(local, remote, mergeMetaStrategy)
    : undefined

  return mergedDeletedMetaValue
    ? {
        tags: mergedTags,
        meta: mergedMeta,
        deletedMeta: mergedDeletedMetaValue,
      }
    : {
        tags: mergedTags,
        meta: mergedMeta,
      }
}

/**
 * Merges tags from local and remote bookmarks based on the specified strategy.
 * Assumes both local and remote bookmarks are valid for merging at this stage.
 * @param {BookmarkTagsAndMetadata} local - The local bookmark data.
 * @param {BookmarkTagsAndMetadata} remote - The remote bookmark data.
 * @param {MergeTagsStrategy} mergeTagsStrategy - The strategy for merging tags ('local', 'remote', 'newer', 'union').
 * @returns {string[]} An array of merged tags.
 */
function mergeTags(
  local: BookmarkTagsAndMetadata,
  remote: BookmarkTagsAndMetadata,
  mergeTagsStrategy: MergeTagsStrategy
): string[] {
  switch (mergeTagsStrategy) {
    case 'local': {
      return local.tags
    }

    case 'remote': {
      return remote.tags
    }

    case 'newer': {
      // If 'newer' strategy, choose tags from the bookmark with the more recent 'updated' timestamp.
      return getUpdated(local.meta) >= getUpdated(remote.meta)
        ? local.tags
        : remote.tags
    }

    default: {
      // Default to 'union' (or 'merge', which behaves like union for tags)
      // Combine tags from both, ensuring uniqueness.
      return Array.from(new Set([...local.tags, ...remote.tags]))
    }
  }
}

/**
 * Merges metadata (title, created, updated timestamps) from local and remote bookmarks.
 * Assumes both local and remote bookmarks are valid for merging at this stage.
 * @param {BookmarkTagsAndMetadata} local - The local bookmark data.
 * @param {BookmarkTagsAndMetadata} remote - The remote bookmark data.
 * @param {MergeMetaStrategy} mergeMetaStrategy - The strategy for merging metadata ('local', 'remote', 'newer', 'merge').
 * @returns {BookmarkTagsAndMetadata['meta']} The merged metadata object.
 */
function mergeMeta(
  local: BookmarkTagsAndMetadata,
  remote: BookmarkTagsAndMetadata,
  mergeMetaStrategy: MergeMetaStrategy
): BookmarkTagsAndMetadata['meta'] {
  switch (mergeMetaStrategy) {
    case 'local': {
      return local.meta
    }

    case 'remote': {
      return remote.meta
    }

    case 'newer': {
      // If 'newer' strategy, choose metadata from the bookmark with the more recent 'updated' timestamp.
      return getUpdated(local.meta) >= getUpdated(remote.meta) // Use >= to prefer local on exact match
        ? local.meta
        : remote.meta
    }

    default: {
      // Default to 'merge' strategy.
      // Prioritize the newer item's metadata, but overlay it onto the older one to preserve fields like 'created' if not present in newer.
      // A more robust merge might involve field-by-field comparison if specific fields have different merge rules.
      // For simplicity here, if 'local' is newer, its 'meta' takes precedence. If 'remote' is newer, its 'meta' takes precedence.
      // The spread operator order ensures this.
      return getUpdated(local.meta) >= getUpdated(remote.meta) // Use >= to prefer local on exact match
        ? { ...remote.meta, ...local.meta } // Local overwrites remote where keys overlap
        : { ...local.meta, ...remote.meta } // Remote overwrites local where keys overlap
    }
  }
}

/**
 * Merges the 'deletedMeta' field from local and remote bookmarks if a bookmark is marked as deleted.
 * Assumes both local and remote bookmarks are valid for merging at this stage.
 * The 'deletedMeta' typically stores information about the bookmark at the time of deletion.
 * @param {BookmarkTagsAndMetadata} local - The local bookmark data.
 * @param {BookmarkTagsAndMetadata} remote - The remote bookmark data.
 * @param {MergeMetaStrategy} mergeMetaStrategy - The strategy for merging metadata, also applied to 'deletedMeta'.
 * @returns {BookmarkTagsAndMetadata['deletedMeta'] | undefined} The merged 'deletedMeta' object, or undefined if neither has it.
 */
function mergeDeletedMeta(
  local: BookmarkTagsAndMetadata,
  remote: BookmarkTagsAndMetadata,
  mergeMetaStrategy: MergeMetaStrategy // Reusing MergeMetaStrategy for deletedMeta consistency
): BookmarkTagsAndMetadata['deletedMeta'] | undefined {
  const localDeletedMeta = local.deletedMeta
  const remoteDeletedMeta = remote.deletedMeta

  // If neither has deletedMeta, return undefined.
  if (!localDeletedMeta && !remoteDeletedMeta) {
    return undefined
  }

  // If only one has deletedMeta, return that one.
  if (!localDeletedMeta) {
    return remoteDeletedMeta
  }

  if (!remoteDeletedMeta) {
    return localDeletedMeta
  }

  // If both have deletedMeta, merge them based on the strategy.
  // This reuses the mergeMeta logic, assuming timestamps within deletedMeta (like original 'updated') guide the merge.
  switch (mergeMetaStrategy) {
    case 'local': {
      return localDeletedMeta
    }

    case 'remote': {
      return remoteDeletedMeta
    }

    case 'newer': {
      // Compare based on the 'updated' timestamp within the deletedMeta, if available and relevant.
      // Or, fall back to the main bookmark's update time if deletedMeta doesn't have its own comparable timestamp.
      // For simplicity, we'll use the main getUpdated, assuming deletion is an update.
      return getUpdated(local.meta) >= getUpdated(remote.meta)
        ? localDeletedMeta
        : remoteDeletedMeta
    }

    default: {
      // 'merge' strategy for deletedMeta
      return getUpdated(local.meta) >= getUpdated(remote.meta)
        ? { ...remoteDeletedMeta, ...localDeletedMeta }
        : { ...localDeletedMeta, ...remoteDeletedMeta }
    }
  }
}
