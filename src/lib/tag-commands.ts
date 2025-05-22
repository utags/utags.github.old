import { splitTags } from 'utags-utils'
import type { BookmarkKeyValuePair } from '../types/bookmarks.js'
import { normalizeAndDeduplicateStrings } from '../utils/index.js'

/**
 * Tag Command Interface - Base interface for all tag operation commands
 */
export type TagCommand = {
  /**
   * Execute the command
   * @returns Map of affected bookmark URLs and their original tags, for undo operations
   */
  execute(): Map<string, string[]>

  /**
   * Undo the command
   * @param affected Map of affected bookmark URLs and their original tags
   */
  undo(affected: Map<string, string[]>): void

  /**
   * Get command type
   */
  getType(): 'add' | 'remove' | 'rename'

  /**
   * Get source tags
   * @returns Array of source tags
   */
  getSourceTags(): string[]

  /**
   * Get target tags (only for rename operations)
   * @returns Array of target tags or undefined
   */
  getTargetTags(): string[] | undefined

  /**
   * Get command description for UI display
   */
  getDescription?(): string

  /**
   * Get command timestamp
   */
  getTimestamp?(): number
}

/**
 * Base Tag Command - Abstract base class for tag commands with common functionality
 */
export abstract class BaseTagCommand implements TagCommand {
  // eslint-disable-next-line @typescript-eslint/parameter-properties
  protected bookmarks: BookmarkKeyValuePair[]
  protected sourceTags: string[]
  private readonly timestamp: number

  /**
   * Create a base tag command
   * @param bookmarks Array of bookmarks to operate on
   * @param sourceTags Source tags to operate on (string or string array)
   */
  constructor(
    bookmarks: BookmarkKeyValuePair[],
    sourceTags: string | string[]
  ) {
    this.bookmarks = bookmarks
    this.sourceTags = Array.isArray(sourceTags)
      ? normalizeAndDeduplicateStrings(sourceTags)
      : splitTags(sourceTags)
    this.timestamp = Date.now()
  }

  /**
   * Undo tag operation
   * @param affected Map of affected bookmark URLs and their original tags
   */
  undo(affected: Map<string, string[]>): void {
    for (const bookmark of this.bookmarks) {
      if (affected.has(bookmark[0])) {
        // Restore original tags
        bookmark[1].tags = [...affected.get(bookmark[0])!]
      }
    }
  }

  /**
   * Get source tags
   * @returns Array of source tags
   */
  getSourceTags(): string[] {
    return [...this.sourceTags]
  }

  /**
   * Get target tags (to be implemented by subclasses if needed)
   * @returns Array of target tags or undefined
   */
  getTargetTags(): string[] | undefined {
    return undefined
  }

  getTimestamp(): number {
    return this.timestamp
  }

  /**
   * Execute tag operation (to be implemented by subclasses)
   * @returns Map of affected bookmark URLs and their original tags
   */
  abstract execute(): Map<string, string[]>

  /**
   * Get command type (to be implemented by subclasses)
   */
  abstract getType(): 'add' | 'remove' | 'rename'
}

/**
 * Add Tag Command - Adds multiple tags to selected bookmarks
 */
export class AddTagCommand extends BaseTagCommand {
  /**
   * Execute add tag operation
   * @returns Map of affected bookmark URLs and their original tags
   */
  execute(): Map<string, string[]> {
    const affected = new Map<string, string[]>()

    for (const bookmark of this.bookmarks) {
      // Check if any of the tags need to be added
      const tagsToAdd = this.sourceTags.filter(
        (tag) => !bookmark[1].tags.includes(tag)
      )

      if (tagsToAdd.length > 0) {
        // Save original state for undo
        affected.set(bookmark[0], [...bookmark[1].tags])
        // Add tags
        bookmark[1].tags = [...bookmark[1].tags, ...tagsToAdd]
      }
    }

    return affected
  }

  /**
   * Get command type
   */
  getType(): 'add' {
    return 'add'
  }

  getDescription(): string {
    return `添加标签: ${this.sourceTags.join(', ')}`
  }
}

/**
 * Remove Tag Command - Removes multiple tags from selected bookmarks
 */
export class RemoveTagCommand extends BaseTagCommand {
  /**
   * Execute remove tag operation
   * Only removes tags if the bookmark contains ALL specified tags
   * @returns Map of affected bookmark URLs and their original tags
   */
  execute(): Map<string, string[]> {
    const affected = new Map<string, string[]>()

    for (const bookmark of this.bookmarks) {
      // Check if bookmark contains ALL specified tags
      const hasAllTags = this.sourceTags.every((tag) =>
        bookmark[1].tags.includes(tag)
      )

      if (hasAllTags) {
        // Save original state for undo
        affected.set(bookmark[0], [...bookmark[1].tags])

        // Remove all specified tags
        bookmark[1].tags = bookmark[1].tags.filter(
          (tag) => !this.sourceTags.includes(tag)
        )
      }
    }

    return affected
  }

  /**
   * Get command type
   */
  getType(): 'remove' {
    return 'remove'
  }

  getDescription(): string {
    return `删除标签: ${this.sourceTags.join(', ')}`
  }
}

/**
 * Rename Tag Command - Renames multiple tags in selected bookmarks
 */
export class RenameTagCommand extends BaseTagCommand {
  private readonly targetTags: string[]

  /**
   * Create a rename tag command
   * @param bookmarks Array of bookmarks to operate on
   * @param sourceTags Original tag name(s) (string or string array)
   * @param targetTags New tag name(s) (string or string array)
   */
  constructor(
    bookmarks: BookmarkKeyValuePair[],
    sourceTags: string | string[],
    targetTags: string | string[]
  ) {
    super(bookmarks, sourceTags)
    this.targetTags = Array.isArray(targetTags)
      ? normalizeAndDeduplicateStrings(targetTags)
      : splitTags(targetTags)
  }

  /**
   * Execute rename tag operation
   * Only renames tags if the bookmark contains ALL specified source tags
   * @returns Map of affected bookmark URLs and their original tags
   */
  execute(): Map<string, string[]> {
    const affected = new Map<string, string[]>()

    // Calculate tags to remove once outside the loop
    // This preserves the order of tags that are both in source and target
    const tagsToRemove = new Set(
      this.sourceTags.filter((tag) => !this.targetTags.includes(tag))
    )

    for (const bookmark of this.bookmarks) {
      // Check if bookmark contains ALL specified source tags
      const hasAllSourceTags = this.sourceTags.every((tag) =>
        bookmark[1].tags.includes(tag)
      )

      if (hasAllSourceTags) {
        // Save original state for undo
        affected.set(bookmark[0], [...bookmark[1].tags])

        // Keep tags that are not in the removal list
        const remainingTags = bookmark[1].tags.filter(
          (tag) => !tagsToRemove.has(tag)
        )

        // Combine remaining tags with all target tags and let normalizeAndDeduplicateStrings handle deduplication
        bookmark[1].tags = normalizeAndDeduplicateStrings([
          ...remainingTags,
          ...this.targetTags,
        ])
      }
    }

    return affected
  }

  /**
   * Get command type
   */
  getType(): 'rename' {
    return 'rename'
  }

  /**
   * Get target tags
   */
  override getTargetTags(): string[] {
    return [...this.targetTags]
  }

  getDescription(): string {
    return `修改标签: ${this.sourceTags.join(', ')} -> ${this.targetTags.join(', ')}`
  }
}

/**
 * Composite Tag Command - Combines multiple commands into a single command
 */
export class CompositeTagCommand implements TagCommand {
  private readonly commands: TagCommand[]
  private readonly type: 'add' | 'remove' | 'rename'
  private readonly name: string

  /**
   * Create a composite tag command
   * @param commands Array of commands to combine
   * @param type Type of the composite command
   * @param name Optional name for the composite command
   */
  constructor(
    commands: TagCommand[],
    type: 'add' | 'remove' | 'rename',
    name = '复合命令'
  ) {
    this.commands = [...commands]
    this.type = type
    this.name = name
  }

  /**
   * Execute all commands in sequence
   * @returns Map of affected bookmark URLs and their original tags
   */
  execute(): Map<string, string[]> {
    const affected = new Map<string, string[]>()

    // Execute all commands and merge affected bookmarks
    for (const command of this.commands) {
      const commandAffected = command.execute()

      // Merge affected bookmarks, preserving the original state
      for (const [url, tags] of commandAffected.entries()) {
        if (!affected.has(url)) {
          affected.set(url, tags)
        }
      }
    }

    return affected
  }

  /**
   * Undo all commands in reverse sequence
   * @param affected Map of affected bookmark URLs and their original tags
   */
  undo(affected: Map<string, string[]>): void {
    // Undo commands in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo(affected)
    }
  }

  /**
   * Get command type
   */
  getType(): 'add' | 'remove' | 'rename' {
    return this.type
  }

  /**
   * Get source tags from all commands
   */
  getSourceTags(): string[] {
    const allTags: string[] = []

    for (const command of this.commands) {
      allTags.push(...command.getSourceTags())
    }

    return [...new Set(allTags)] // 去重
  }

  /**
   * Get target tags from all commands
   */
  getTargetTags(): string[] | undefined {
    if (this.type !== 'rename') {
      return undefined
    }

    const allTargetTags: string[] = []

    for (const command of this.commands) {
      const targetTags = command.getTargetTags()
      if (targetTags) {
        allTargetTags.push(...targetTags)
      }
    }

    return allTargetTags.length > 0 ? [...new Set(allTargetTags)] : undefined
  }

  /**
   * Get command name
   */
  getName(): string {
    return this.name
  }
}

/**
 * Command Manager - Manages command history and executes undo/redo operations
 */
export class CommandManager {
  private commandHistory: TagCommand[] = []
  private currentIndex = -1
  private affectedBookmarks: Array<Map<string, string[]>> = []
  private readonly persistCallback?: (
    bookmarks: BookmarkKeyValuePair[]
  ) => Promise<void>

  private maxHistorySize = 100 // 默认最大历史记录数

  /**
   * Create a command manager
   * @param persistCallback Persistence callback function for saving changes to storage
   * @param maxHistorySize Maximum number of commands to keep in history
   */
  constructor(
    persistCallback?: (bookmarks: BookmarkKeyValuePair[]) => Promise<void>,
    maxHistorySize = 100
  ) {
    this.persistCallback = persistCallback
    this.maxHistorySize = maxHistorySize
  }

  /**
   * Execute a command and add to history
   * @param command Command to execute
   * @param bookmarks Array of bookmarks to operate on, for persistence
   */
  async executeCommand(
    command: TagCommand,
    bookmarks?: BookmarkKeyValuePair[]
  ): Promise<void> {
    // Execute single command
    await this.executeCommandsInternal([command], bookmarks)
  }

  /**
   * Execute multiple commands as a batch transaction
   * @param commands Array of commands to execute
   * @param bookmarks Array of bookmarks to operate on, for persistence
   * @returns Whether all commands were executed successfully
   */
  async executeBatch(
    commands: TagCommand[],
    bookmarks?: BookmarkKeyValuePair[]
  ): Promise<boolean> {
    if (commands.length === 0) {
      return false
    }

    // Execute multiple commands
    await this.executeCommandsInternal(commands, bookmarks)
    return true
  }

  /**
   * Undo the last command
   * @param bookmarks Array of bookmarks to operate on, for persistence
   * @returns Whether undo was successful
   */
  async undo(bookmarks?: BookmarkKeyValuePair[]): Promise<boolean> {
    if (this.currentIndex < 0) {
      return false
    }

    const command = this.commandHistory[this.currentIndex]
    const affected = this.affectedBookmarks[this.currentIndex]

    command.undo(affected)
    this.currentIndex--

    // If persistence callback and bookmarks array provided, save changes
    if (this.persistCallback && bookmarks) {
      await this.persistCallback(bookmarks)
    }

    return true
  }

  /**
   * Redo a previously undone command
   * @param bookmarks Array of bookmarks to operate on, for persistence
   * @returns Whether redo was successful
   */
  async redo(bookmarks?: BookmarkKeyValuePair[]): Promise<boolean> {
    if (this.currentIndex >= this.commandHistory.length - 1) {
      return false
    }

    this.currentIndex++
    const command = this.commandHistory[this.currentIndex]

    // Re-execute command and update affected bookmarks
    const affected = command.execute()
    this.affectedBookmarks[this.currentIndex] = affected

    // If persistence callback and bookmarks array provided, save changes
    if (this.persistCallback && bookmarks) {
      await this.persistCallback(bookmarks)
    }

    return true
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.currentIndex >= 0
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentIndex < this.commandHistory.length - 1
  }

  /**
   * Get current command history
   */
  getCommandHistory(): TagCommand[] {
    return [...this.commandHistory]
  }

  /**
   * Get current command index
   */
  getCurrentIndex(): number {
    return this.currentIndex
  }

  /**
   * Clear command history
   */
  clear(): void {
    this.commandHistory = []
    this.affectedBookmarks = []
    this.currentIndex = -1
  }

  /**
   * Set maximum history size
   * @param size New maximum history size
   */
  setMaxHistorySize(size: number): void {
    if (size < 1) {
      throw new Error('历史记录大小必须大于0')
    }

    this.maxHistorySize = size

    // Trim history if needed
    if (this.commandHistory.length > this.maxHistorySize) {
      const excess = this.commandHistory.length - this.maxHistorySize
      this.commandHistory = this.commandHistory.slice(excess)
      this.affectedBookmarks = this.affectedBookmarks.slice(excess)
      this.currentIndex -= excess
    }
  }

  /**
   * Internal helper method to execute commands and update history
   * @param commands Array of commands to execute
   * @param bookmarks Array of bookmarks to operate on, for persistence
   * @private
   */
  private async executeCommandsInternal(
    commands: TagCommand[],
    bookmarks?: BookmarkKeyValuePair[]
  ): Promise<void> {
    // If not at the last command, clear commands after current
    if (this.currentIndex < this.commandHistory.length - 1) {
      this.commandHistory = this.commandHistory.slice(0, this.currentIndex + 1)
      this.affectedBookmarks = this.affectedBookmarks.slice(
        0,
        this.currentIndex + 1
      )
    }

    // Execute all commands and save affected bookmarks
    for (const command of commands) {
      const affected = command.execute()
      this.commandHistory.push(command)
      this.affectedBookmarks.push(affected)
      this.currentIndex++
    }

    // Limit history size
    if (this.commandHistory.length > this.maxHistorySize) {
      const excess = this.commandHistory.length - this.maxHistorySize
      this.commandHistory = this.commandHistory.slice(excess)
      this.affectedBookmarks = this.affectedBookmarks.slice(excess)
      this.currentIndex -= excess
    }

    // If persistence callback and bookmarks array provided, save changes
    if (this.persistCallback && bookmarks) {
      await this.persistCallback(bookmarks)
    }
  }
}
