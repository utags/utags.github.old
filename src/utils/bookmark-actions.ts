import { get } from 'svelte/store'
import { type BookmarkKeyValuePair } from '../types/bookmarks.js'
import { bookmarks } from '../stores/stores.js'
import {
  saveDeletedBookmarks,
  removeDeletedBookmarks,
} from '../stores/deleted-bookmarks.js'

/**
 * Delete one or multiple bookmarks with confirmation dialog and undo capability
 *
 * This function handles both single bookmark deletion and batch deletion scenarios.
 * It provides user confirmation, error handling, and the ability to undo the deletion.
 *
 * Features:
 * - Supports both single URL string or array of URLs
 * - Provides confirmation dialog (can be skipped)
 * - Creates an undo function for restoring deleted bookmarks
 * - Handles error cases gracefully
 * - Updates bookmark store and saves deleted bookmarks
 *
 * @param bookmarkUrls - Single bookmark URL or array of bookmark URLs to delete
 * @param options - Configuration options for the deletion process
 * @param options.skipConfirmation - Whether to skip the confirmation dialog (default: false)
 * @param options.actionType - The type of action that caused the deletion (default: 'delete')
 * @param options.onSuccess - Callback function called on successful deletion, receives undo function and deleted count
 * @param options.onError - Callback function called when an error occurs
 * @returns Promise with operation result and undo function if successful
 *
 * @example
 * // Delete a single bookmark
 * batchDeleteBookmarks('https://example.com')
 *   .then(result => {
 *     if (result.success && result.undo) {
 *       // Show undo button
 *     }
 *   });
 *
 * @example
 * // Delete multiple bookmarks with custom options
 * batchDeleteBookmarks(['https://example1.com', 'https://example2.com'], {
 *   skipConfirmation: true,
 *   actionType: 'batch-delete-bookmarks',
 *   onSuccess: (undoFn, deletedCount) => {
 *     if (deletedCount > 0) {
 *       showUndoNotification(`Deleted ${deletedCount} bookmarks`, undoFn);
 *     } else {
 *       showNotification('No bookmarks were deleted');
 *     }
 *   }
 * });
 *
 * @example
 * // Complete error handling and success handling example
 * batchDeleteBookmarks(urls)
 *   .then(result => {
 *     if (!result.success) {
 *       // Handle error case
 *       if (result.error) {
 *         console.error('Failed to delete bookmarks:', result.error.message);
 *         // Can handle different types of errors based on error type or message
 *       }
 *     } else {
 *       // Handle success case
 *       console.log(`Successfully deleted ${result.deletedCount} bookmarks`);
 *       if (result.undo) {
 *         // Show undo button
 *       }
 *     }
 *   });
 */
export async function batchDeleteBookmarks(
  bookmarkUrls: string | string[],
  options: {
    skipConfirmation?: boolean
    actionType?:
      | 'delete'
      | 'import'
      | 'sync'
      | 'batch-delete-bookmarks'
      | 'batch-delete-tags'
    onSuccess?: (undoFn: (() => void) | undefined, deletedCount: number) => void
    onError?: (error: Error) => void
  } = {}
): Promise<{
  success: boolean
  undo?: () => void
  deletedCount: number
  error?: Error
}> {
  // Convert single bookmark to array format
  const urlsArray = Array.isArray(bookmarkUrls) ? bookmarkUrls : [bookmarkUrls]

  // Set default actionType
  const actionType = options.actionType || 'delete'

  if (urlsArray.length === 0) {
    // No bookmarks to delete, call onSuccess with undefined undo function and 0 count
    if (options.onSuccess) {
      options.onSuccess(undefined, 0)
    }

    return { success: true, deletedCount: 0 }
  }

  // Show confirmation dialog if not skipped
  if (!options.skipConfirmation) {
    const confirmMessage =
      urlsArray.length === 1
        ? 'Are you sure you want to delete this bookmark?'
        : `Are you sure you want to delete these ${urlsArray.length} bookmarks?`

    // eslint-disable-next-line no-alert
    if (!confirm(confirmMessage)) return { success: false, deletedCount: 0 }
  }

  try {
    const $bookmarks = get(bookmarks)
    const deletedBookmarks: BookmarkKeyValuePair[] = []

    // Delete each selected bookmark
    for (const url of urlsArray) {
      if ($bookmarks.data[url]) {
        // Save the deleted bookmark for potential restoration
        deletedBookmarks.push([url, $bookmarks.data[url]])
        // Remove from bookmarks store
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete $bookmarks.data[url]
      }
    }

    // If no bookmarks were deleted, call onSuccess with undefined undo function and 0 count
    if (deletedBookmarks.length === 0) {
      if (options.onSuccess) {
        options.onSuccess(undefined, 0)
      }

      return { success: true, deletedCount: 0 }
    }

    // Create undo function for restoring deleted bookmarks
    let undoExecuted = false
    const undoFunction = () => {
      // Prevent multiple executions
      if (undoExecuted) {
        return
      }

      const currentBookmarks = get(bookmarks)

      // Restore all deleted bookmarks
      for (const [url, data] of deletedBookmarks) {
        delete data.deletedMeta
        currentBookmarks.data[url] = data
      }

      // Update bookmarks store
      bookmarks.set(currentBookmarks)

      // Trigger UI update
      bookmarks.update((b) => b)

      // Remove these bookmarks from deletion history
      // Use the same actionType as when deleting to ensure correct removal
      removeDeletedBookmarks(
        deletedBookmarks.map(([url]) => url),
        { actionType }
      )

      // Mark undo operation as executed
      undoExecuted = true
    }

    // Update bookmarks store
    bookmarks.set($bookmarks)

    // Trigger UI update
    bookmarks.update((b) => b)

    // Return Promise to support async operation
    return await new Promise((resolve) => {
      // Save deleted bookmarks for history
      const success = saveDeletedBookmarks(deletedBookmarks, {
        actionType,
      })

      if (success) {
        const deletedCount = deletedBookmarks.length
        if (options.onSuccess) options.onSuccess(undoFunction, deletedCount)
        resolve({ success: true, undo: undoFunction, deletedCount })
      } else {
        const error = new Error('Failed to save deleted bookmarks!')
        if (options.onError) options.onError(error)
        console.error(`Failed to save deleted bookmarks!`, error)
        resolve({ success: false, deletedCount: 0, error })
      }
    })
  } catch (error) {
    if (options.onError) options.onError(error as Error)
    console.error(`Error occurred while deleting bookmarks:`, error)
    return {
      success: false,
      deletedCount: 0,
      error: error as Error,
    }
  }
}

export async function handleBookmarkDelete(href: string) {
  const result = await batchDeleteBookmarks(href)
  console.log('handleBookmarkDelete', result)
  if (result.success && result.undo) {
    // Show undo button
    // TODO
  }
}

export function handleBookmarkEdit(href: string) {
  const event = new CustomEvent('editBookmark', {
    detail: { href },
    bubbles: true,
  })
  globalThis.dispatchEvent(event)
}

/**
 * Handle AI summary request for the bookmark
 * Opens a new window with the LinkSumm service to summarize the URL
 *
 * @param {string} url - The URL to summarize
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function handleAISummary(url: string) {
  // Construct the LinkSumm URL with the target URL as a parameter
  const summaryUrl = `https://linksumm.aimerge.cc/?url=${encodeURIComponent(url)}`

  // Open the summary URL in a new window/tab
  window.open(summaryUrl, '_blank', 'noopener,noreferrer')
}

// TODO: add copy url action
// TODO: add show QR code action
