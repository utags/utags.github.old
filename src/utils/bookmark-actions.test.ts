import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'
import { bookmarks } from '../stores/stores.js'
import * as deletedBookmarksStore from '../stores/deleted-bookmarks.js'
import { type BookmarksStore } from '../types/bookmarks.js'
import { batchDeleteBookmarks } from './bookmark-actions.js'

// Mock svelte/store's get function
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}))

// Mock the stores module
vi.mock('../stores/stores', () => ({
  bookmarks: {
    set: vi.fn(),
    update: vi.fn(),
  },
}))

// Mock the deleted-bookmarks module
vi.mock('../stores/deleted-bookmarks', () => ({
  saveDeletedBookmarks: vi.fn(),
  removeDeletedBookmarks: vi.fn().mockReturnValue(true),
}))

// Mock globalThis.confirm
const originalConfirm = globalThis.confirm
const mockConfirm = vi.fn()

describe('batchDeleteBookmarks', () => {
  // Sample bookmark data for testing
  const sampleBookmarks: BookmarksStore = {
    data: {
      'https://example.com': {
        tags: ['example', 'test'],
        meta: {
          created: 1_234_567_890,
          updated: 1_234_567_900,
        },
      },
      'https://test.com': {
        tags: ['test'],
        meta: {
          created: 1_234_567_891,
          updated: 1_234_567_901,
        },
      },
      'https://another.com': {
        tags: ['another'],
        meta: {
          created: 1_234_567_892,
          updated: 1_234_567_902,
        },
      },
    },
    meta: {
      databaseVersion: 1,
      created: 1_234_567_800,
    },
  }

  // Create a deep copy for test assertions
  let originalBookmarkData: typeof sampleBookmarks.data
  let copyOfSampleBookmarks: typeof sampleBookmarks

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Create a deep copy of the original data before each test
    originalBookmarkData = structuredClone(sampleBookmarks.data)
    copyOfSampleBookmarks = structuredClone(sampleBookmarks)

    // Mock globalThis.confirm
    globalThis.confirm = mockConfirm

    // Mock get function to return sample data when called with bookmarks
    vi.mocked(get).mockImplementation((store) => {
      if (store === bookmarks) {
        return { ...copyOfSampleBookmarks }
      }

      return undefined
    })

    // Mock saveDeletedBookmarks to return true by default
    vi.mocked(deletedBookmarksStore.saveDeletedBookmarks).mockReturnValue(true)

    // Mock removeDeletedBookmarks to return true by default
    vi.mocked(deletedBookmarksStore.removeDeletedBookmarks).mockReturnValue(
      true
    )
  })

  afterEach(() => {
    // Restore original globalThis.confirm after each test
    globalThis.confirm = originalConfirm
  })

  /**
   * Test case for deleting a single bookmark with confirmation
   */
  it('should delete a single bookmark with confirmation', async () => {
    // Arrange
    const url = 'https://example.com'
    mockConfirm.mockReturnValueOnce(true)
    const onSuccess = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(url, { onSuccess })

    // Assert
    expect(mockConfirm).toHaveBeenCalledWith(
      'Are you sure you want to delete this bookmark?'
    )
    expect(bookmarks.set).toHaveBeenCalled()
    expect(bookmarks.update).toHaveBeenCalled()
    expect(deletedBookmarksStore.saveDeletedBookmarks).toHaveBeenCalledWith(
      [[url, originalBookmarkData[url]]],
      { actionType: 'delete' }
    )

    // Verify that the bookmark was actually removed from storage
    const mockGetCall = vi
      .mocked(get)
      .mock.calls.find((call) => call[0] === bookmarks)
    expect(mockGetCall).toBeDefined()
    const returnedBookmarks = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(returnedBookmarks.data[url]).toBeUndefined()

    expect(result.success).toBe(true)
    expect(result.deletedCount).toBe(1)
    expect(typeof result.undo).toBe('function')
    expect(onSuccess).toHaveBeenCalledWith(expect.any(Function), 1)
  })

  /**
   * Test case for deleting multiple bookmarks with confirmation
   */
  it('should delete multiple bookmarks with confirmation', async () => {
    // Arrange
    const urls = ['https://example.com', 'https://test.com']
    mockConfirm.mockReturnValueOnce(true)
    const onSuccess = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(urls, { onSuccess })

    // Assert
    expect(mockConfirm).toHaveBeenCalledWith(
      'Are you sure you want to delete these 2 bookmarks?'
    )
    expect(bookmarks.set).toHaveBeenCalled()
    expect(bookmarks.update).toHaveBeenCalled()
    expect(deletedBookmarksStore.saveDeletedBookmarks).toHaveBeenCalledWith(
      [
        ['https://example.com', originalBookmarkData['https://example.com']],
        ['https://test.com', originalBookmarkData['https://test.com']],
      ],
      { actionType: 'delete' }
    )

    // Verify that the bookmarks were actually removed from storage
    const returnedBookmarks = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(returnedBookmarks.data['https://example.com']).toBeUndefined()
    expect(returnedBookmarks.data['https://test.com']).toBeUndefined()

    expect(result.success).toBe(true)
    expect(result.deletedCount).toBe(2)
    expect(typeof result.undo).toBe('function')
    expect(onSuccess).toHaveBeenCalledWith(expect.any(Function), 2)
  })

  /**
   * Test case for canceling bookmark deletion
   */
  it('should cancel deletion when user declines confirmation', async () => {
    // Arrange
    const url = 'https://example.com'
    mockConfirm.mockReturnValueOnce(false)
    const onSuccess = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(url, { onSuccess })

    // Assert
    expect(mockConfirm).toHaveBeenCalledWith(
      'Are you sure you want to delete this bookmark?'
    )
    expect(bookmarks.set).not.toHaveBeenCalled()
    expect(bookmarks.update).not.toHaveBeenCalled()
    expect(deletedBookmarksStore.saveDeletedBookmarks).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
    expect(result.deletedCount).toBe(0)
    expect(result.undo).toBeUndefined()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  /**
   * Test case for skipping confirmation
   */
  it('should skip confirmation when skipConfirmation is true', async () => {
    // Arrange
    const url = 'https://example.com'
    const onSuccess = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(url, {
      skipConfirmation: true,
      onSuccess,
    })

    // Assert
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(bookmarks.set).toHaveBeenCalled()
    expect(bookmarks.update).toHaveBeenCalled()
    expect(deletedBookmarksStore.saveDeletedBookmarks).toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.deletedCount).toBe(1)
    expect(onSuccess).toHaveBeenCalledWith(expect.any(Function), 1)
  })

  /**
   * Test case for custom action type
   */
  it('should use custom actionType when provided', async () => {
    // Arrange
    const url = 'https://example.com'
    mockConfirm.mockReturnValueOnce(true)
    const actionType = 'batch-delete-tags'

    // Act
    await batchDeleteBookmarks(url, {
      actionType,
      skipConfirmation: true,
    })

    // Assert
    expect(deletedBookmarksStore.saveDeletedBookmarks).toHaveBeenCalledWith(
      [[url, sampleBookmarks.data[url]]],
      { actionType }
    )
  })

  /**
   * Test case for empty input array
   */
  it('should handle empty array input', async () => {
    // Arrange
    const urls: string[] = []
    const onSuccess = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(urls, { onSuccess })

    // Assert
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(bookmarks.set).not.toHaveBeenCalled()
    expect(bookmarks.update).not.toHaveBeenCalled()
    expect(deletedBookmarksStore.saveDeletedBookmarks).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.deletedCount).toBe(0)
    expect(result.undo).toBeUndefined()
    expect(onSuccess).toHaveBeenCalledWith(undefined, 0)
  })

  /**
   * Test case for non-existent bookmarks
   */
  it('should handle non-existent bookmarks', async () => {
    // Arrange
    const urls = ['https://nonexistent.com']
    mockConfirm.mockReturnValueOnce(true)
    const onSuccess = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(urls, { onSuccess })

    // Assert
    expect(mockConfirm).toHaveBeenCalled()
    expect(bookmarks.set).not.toHaveBeenCalled()
    expect(bookmarks.update).not.toHaveBeenCalled()
    expect(deletedBookmarksStore.saveDeletedBookmarks).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.deletedCount).toBe(0)
    expect(result.undo).toBeUndefined()
    expect(onSuccess).toHaveBeenCalledWith(undefined, 0)
  })

  /**
   * Test case for mixed existing and non-existent bookmarks
   */
  it('should handle mixed existing and non-existent bookmarks', async () => {
    // Arrange
    const urls = ['https://example.com', 'https://nonexistent.com']
    mockConfirm.mockReturnValueOnce(true)
    const onSuccess = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(urls, { onSuccess })

    // Assert
    expect(mockConfirm).toHaveBeenCalled()
    expect(bookmarks.set).toHaveBeenCalled()
    expect(bookmarks.update).toHaveBeenCalled()
    expect(deletedBookmarksStore.saveDeletedBookmarks).toHaveBeenCalledWith(
      [['https://example.com', originalBookmarkData['https://example.com']]],
      { actionType: 'delete' }
    )

    // Verify that existing bookmarks were removed from storage
    const returnedBookmarks = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(returnedBookmarks.data['https://example.com']).toBeUndefined()
    // Non-existent bookmarks were not in storage to begin with
    expect(returnedBookmarks.data['https://nonexistent.com']).toBeUndefined()

    expect(result.success).toBe(true)
    expect(result.deletedCount).toBe(1)
    expect(typeof result.undo).toBe('function')
    expect(onSuccess).toHaveBeenCalledWith(expect.any(Function), 1)
  })

  /**
   * Test case for failed save operation
   */
  it('should handle failed save operation', async () => {
    // Arrange
    const url = 'https://example.com'
    mockConfirm.mockReturnValueOnce(true)
    vi.mocked(deletedBookmarksStore.saveDeletedBookmarks).mockReturnValue(false)
    const onSuccess = vi.fn()
    const onError = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(url, { onSuccess, onError })

    // Assert
    expect(mockConfirm).toHaveBeenCalled()
    expect(bookmarks.set).toHaveBeenCalled()
    expect(bookmarks.update).toHaveBeenCalled()
    expect(deletedBookmarksStore.saveDeletedBookmarks).toHaveBeenCalled()
    expect(result.success).toBe(false)
    expect(result.deletedCount).toBe(0)
    expect(result.undo).toBeUndefined()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    // Verify the returned error object
    expect(result.error).toBeDefined()
    expect(result.error?.message).toBe('Failed to save deleted bookmarks!')
  })

  /**
   * Test case for error handling
   */
  it('should handle errors during deletion process', async () => {
    // Arrange
    const url = 'https://example.com'
    mockConfirm.mockReturnValueOnce(true)
    const error = new Error('Test error')
    vi.mocked(bookmarks.set).mockImplementationOnce(() => {
      throw error
    })
    const onError = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(url, { onError })

    // Assert
    expect(mockConfirm).toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(error)
    // Verify the returned error object
    expect(result.error).toBeDefined()
    expect(result.error).toBe(error)
    expect(result.success).toBe(false)
    expect(result.deletedCount).toBe(0)
    expect(result.undo).toBeUndefined()
  })

  /**
   * Test case for undo functionality
   */
  it('should restore bookmarks when undo function is called', async () => {
    // Arrange
    const url = 'https://example.com'
    mockConfirm.mockReturnValueOnce(true)

    // Act
    const result = await batchDeleteBookmarks(url, { skipConfirmation: true })

    // Verify that the bookmark was actually removed from storage
    const returnedBookmarksBeforeUndo = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(returnedBookmarksBeforeUndo.data[url]).toBeUndefined()

    // Call the undo function
    if (result.undo) {
      result.undo()
    }

    // Verify that the bookmark was actually restored to storage
    const returnedBookmarksAfterUndo = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(returnedBookmarksAfterUndo.data[url]).toEqual(
      originalBookmarkData[url]
    )

    // Assert
    expect(bookmarks.set).toHaveBeenCalledTimes(2) // Once for delete, once for undo
    expect(bookmarks.update).toHaveBeenCalledTimes(2) // Once for delete, once for undo

    // Verify removeDeletedBookmarks was called with correct parameters
    expect(deletedBookmarksStore.removeDeletedBookmarks).toHaveBeenCalledWith(
      [url],
      { actionType: 'delete' }
    )

    // Check that the bookmark was restored
    const setCall = vi.mocked(bookmarks.set).mock.calls[1][0]
    expect(setCall.data['https://example.com']).toBeDefined()
    expect(setCall.data['https://example.com'].tags).toEqual([
      'example',
      'test',
    ])
  })

  /**
   * Test case for undo functionality with multiple bookmarks
   */
  it('should restore multiple bookmarks when undo function is called', async () => {
    // Arrange
    const urls = ['https://example.com', 'https://test.com']
    mockConfirm.mockReturnValueOnce(true)

    // Act
    const result = await batchDeleteBookmarks(urls, { skipConfirmation: true })

    // Verify that the bookmarks were actually removed from storage
    const returnedBookmarksBeforeUndo = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(
      returnedBookmarksBeforeUndo.data['https://example.com']
    ).toBeUndefined()
    expect(returnedBookmarksBeforeUndo.data['https://test.com']).toBeUndefined()

    // Call the undo function
    if (result.undo) {
      result.undo()
    }

    // Verify that the bookmarks were actually restored to storage
    const returnedBookmarksAfterUndo = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(returnedBookmarksAfterUndo.data['https://example.com']).toEqual(
      originalBookmarkData['https://example.com']
    )
    expect(returnedBookmarksAfterUndo.data['https://test.com']).toEqual(
      originalBookmarkData['https://test.com']
    )

    // Verify the bookmarks were restored
    const setCall = vi.mocked(bookmarks.set).mock.calls[1][0]
    expect(setCall.data['https://example.com']).toBeDefined()
    expect(setCall.data['https://test.com']).toBeDefined()
    expect(setCall.data['https://example.com'].tags).toEqual([
      'example',
      'test',
    ])
    expect(setCall.data['https://test.com'].tags).toEqual(['test'])

    // Assert
    expect(bookmarks.set).toHaveBeenCalledTimes(2) // Once for delete, once for undo
    expect(bookmarks.update).toHaveBeenCalledTimes(2) // Once for delete, once for undo
  })

  /**
   * Test case for undo functionality with custom action type
   */
  it('should restore bookmarks with custom action type when undo function is called', async () => {
    // Arrange
    const url = 'https://example.com'
    const actionType = 'batch-delete-tags'
    mockConfirm.mockReturnValueOnce(true)

    // Act
    const result = await batchDeleteBookmarks(url, {
      skipConfirmation: true,
      actionType,
    })

    // Verify that the bookmark was actually removed from storage
    const returnedBookmarksBeforeUndo = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(returnedBookmarksBeforeUndo.data[url]).toBeUndefined()

    // Verify that the custom actionType was used
    expect(deletedBookmarksStore.saveDeletedBookmarks).toHaveBeenCalledWith(
      [[url, originalBookmarkData[url]]],
      { actionType }
    )

    // Call the undo function
    if (result.undo) {
      result.undo()
    }

    // Verify the bookmark was restored
    const setCall = vi.mocked(bookmarks.set).mock.calls[1][0]
    expect(setCall.data[url]).toBeDefined()
    expect(setCall.data[url].tags).toEqual(['example', 'test'])

    // Assert
    expect(bookmarks.set).toHaveBeenCalledTimes(2) // Once for delete, once for undo
    expect(bookmarks.update).toHaveBeenCalledTimes(2) // Once for delete, once for undo
  })

  /**
   * Test case for undo functionality with onSuccess callback
   */
  it('should call onSuccess callback after undo function is called', async () => {
    // Arrange
    const url = 'https://example.com'
    mockConfirm.mockReturnValueOnce(true)
    const onSuccess = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(url, {
      skipConfirmation: true,
      onSuccess,
    })

    // Verify onSuccess was called
    expect(onSuccess).toHaveBeenCalledWith(expect.any(Function), 1)

    // Verify that the bookmark was actually removed from storage
    const returnedBookmarksBeforeUndo = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(returnedBookmarksBeforeUndo.data[url]).toBeUndefined()

    // Reset onSuccess call records
    onSuccess.mockReset()

    // Call the undo function
    if (result.undo) {
      result.undo()
    }

    // Verify the bookmark was restored
    const setCall = vi.mocked(bookmarks.set).mock.calls[1][0]
    expect(setCall.data[url]).toBeDefined()

    // Assert
    expect(bookmarks.set).toHaveBeenCalledTimes(2) // Once for delete, once for undo
    expect(bookmarks.update).toHaveBeenCalledTimes(2) // Once for delete, once for undo
    // Verify onSuccess is not called again after undo
    expect(onSuccess).not.toHaveBeenCalled()
  })

  /**
   * Test case for multiple undo calls
   */
  it('should handle multiple undo calls correctly', async () => {
    // Arrange
    const url = 'https://example.com'
    mockConfirm.mockReturnValueOnce(true)

    // Act
    const result = await batchDeleteBookmarks(url, { skipConfirmation: true })

    // Verify that the bookmark was actually removed from storage
    const returnedBookmarksBeforeUndo = vi.mocked(get).mock.results[0]
      .value as BookmarksStore
    expect(returnedBookmarksBeforeUndo.data[url]).toBeUndefined()

    // Call the undo function multiple times
    if (result.undo) {
      result.undo()
      result.undo() // Second call should have no effect
      result.undo() // Third call should have no effect
    }

    // Assert
    expect(bookmarks.set).toHaveBeenCalledTimes(2) // Should still be called only twice
    expect(bookmarks.update).toHaveBeenCalledTimes(2) // Should still be called only twice

    // Verify the bookmark was restored
    const setCall = vi.mocked(bookmarks.set).mock.calls[1][0]
    expect(setCall.data[url]).toBeDefined()
    expect(setCall.data[url].tags).toEqual(['example', 'test'])
  })

  /**
   * Test case for undo after error
   */
  it('should not provide undo function when deletion fails', async () => {
    // Arrange
    const url = 'https://example.com'
    mockConfirm.mockReturnValueOnce(true)
    const error = new Error('Test error')
    vi.mocked(bookmarks.set).mockImplementationOnce(() => {
      throw error
    })
    const onError = vi.fn()

    // Act
    const result = await batchDeleteBookmarks(url, { onError })

    // Assert
    expect(mockConfirm).toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(error)
    expect(result.error).toBeDefined()
    expect(result.success).toBe(false)
    expect(result.deletedCount).toBe(0)
    expect(result.undo).toBeUndefined() // No undo function should be provided
  })
})
