import type { BookmarkKeyValuePair } from '../types/bookmarks.js'
import { CommandManager } from '../lib/tag-commands.js'
import { bookmarkStorage } from '../lib/bookmark-storage.js'

/**
 * Global CommandManager singleton instance
 * Manages command history and undo/redo operations for tag commands
 */
export const commandManager = new CommandManager(
  // Optional persistence callback
  async (bookmarks: BookmarkKeyValuePair[]) => {
    // 使用 bookmarkStorage 进行持久化
    try {
      await bookmarkStorage.updateBookmarks(bookmarks)
    } catch (error) {
      console.error('Failed to persist bookmarks:', error)
      throw error
    }
  },
  10
)
