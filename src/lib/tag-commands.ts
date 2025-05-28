import { splitTags } from 'utags-utils'
import type {
  BookmarkKeyValuePair,
  BookmarkMetadata,
  BookmarkTagsAndMetadata,
  DeleteActionType,
} from '../types/bookmarks.js'
import { DELETED_BOOKMARK_TAG } from '../config/constants.js'
import { addTags, removeTags } from '../utils/bookmarks.js'

/**
 * Represents the original state of a bookmark before a command is executed.
 * This data is used to revert changes during an undo operation.
 */
type OriginalBookmarkData = {
  /** The original array of tags associated with the bookmark. */
  tags: string[]
  /** The original metadata of the bookmark, if any. */
  meta?: BookmarkMetadata
  /**
   * The original deletion metadata, if the bookmark was previously marked as deleted.
   * This includes the timestamp of deletion and the type of action that led to the deletion.
   */
  deletedMeta?: {
    /**
     * The timestamp of the deletion of the bookmark.
     */
    deleted: number
    /** The type of action that led to the deletion. */
    actionType: DeleteActionType
  }
}

/**
 * Represents the result of a command execution.
 * It includes the count of bookmarks affected by the command,
 * the count of bookmarks marked as deleted (if applicable),
 * and a map of the original states of the affected bookmarks for undo purposes.
 */
export type CommandExecutionResult = {
  /** The number of bookmarks directly modified by the command (e.g., tags added/removed/renamed). */
  affectedCount: number
  /** The number of bookmarks that were marked as deleted as part of this command's execution. */
  deletedCount: number
  /**
   * A map where keys are bookmark URLs (strings) and values are `OriginalBookmarkData` objects.
   * This map stores the state of each affected bookmark before the command was executed,
   * allowing for accurate restoration during an undo operation.
   */
  originalStates: Map<string, OriginalBookmarkData>
}

/**
 * Defines the interface for tag manipulation commands.
 * Each command must be able to execute its operation and undo it.
 * It also provides methods to retrieve information about the command's execution and properties.
 */
export type TagCommand = {
  /**
   * Executes the command's primary operation (e.g., adding, removing, or renaming tags).
   * This method should modify the bookmarks and store the necessary information for a potential undo.
   */
  execute(): void

  /**
   * Reverts the changes made by the `execute` method.
   * This method should restore the bookmarks to their state before the command was executed,
   * using the data stored in `executionResult`.
   */
  undo(): void

  /**
   * Retrieves the result of the command's execution.
   * @returns {CommandExecutionResult | undefined} The execution result, or undefined if the command has not been executed yet.
   */
  getExecutionResult(): CommandExecutionResult | undefined

  /**
   * Gets the type of the command.
   * @returns {'add' | 'remove' | 'rename'} The type of the command.
   */
  getType(): 'add' | 'remove' | 'rename'

  /**
   * Gets the source tags involved in the command.
   * For 'add' and 'remove' commands, these are the tags being added or removed.
   * For 'rename' commands, this is the tag being renamed from.
   * @returns {string[]} An array of source tag strings.
   */
  getSourceTags(): string[]

  /**
   * Gets the target tags involved in the command.
   * This is primarily relevant for 'rename' commands, representing the new tag name.
   * @returns {string[] | undefined} An array of target tag strings, or undefined if not applicable (e.g., for 'add' or 'remove' commands).
   */
  getTargetTags(): string[] | undefined

  /**
   * Provides a human-readable description of the command, suitable for display in a UI (e.g., in an undo/redo history list).
   * @returns {string | undefined} A description string, or undefined if not applicable.
   */
  getDescription?(): string

  /**
   * Gets the timestamp of when the command instance was created.
   * @returns {number | undefined} The creation timestamp (milliseconds since epoch), or undefined if not applicable.
   */
  getTimestamp?(): number
}

/**
 * An abstract base class for tag commands, providing common functionality
 * such as storing bookmarks, source tags, execution results, and a timestamp.
 * It also implements a basic `undo` mechanism and methods to retrieve common command properties.
 */
export abstract class BaseTagCommand implements TagCommand {
  // eslint-disable-next-line @typescript-eslint/parameter-properties
  protected bookmarks: BookmarkKeyValuePair[]
  protected sourceTags: string[]
  protected executionResult: CommandExecutionResult | undefined = undefined
  private readonly timestamp: number

  /**
   * Creates an instance of BaseTagCommand.
   * @param {BookmarkKeyValuePair[]} bookmarks - The array of bookmarks to operate on.
   * @param {string | string[]} sourceTags - The source tag(s) for the command. Can be a single string or an array of strings.
   *                                         Tags will be normalized (trimmed) and deduplicated.
   */
  constructor(
    bookmarks: BookmarkKeyValuePair[],
    sourceTags: string | string[]
  ) {
    this.bookmarks = bookmarks
    this.sourceTags = splitTags(sourceTags)
    this.timestamp = Date.now()
  }

  /**
   * Reverts the tag operation by restoring the original tags, metadata, and deletedMeta
   * of the affected bookmarks. It relies on the `executionResult` captured during the `execute` phase.
   * If `executionResult` is not available (e.g., the command was not executed or failed),
   * an error is logged, and the undo operation is aborted.
   * After a successful undo, `executionResult` is set to `undefined` to prevent re-undoing
   * without a new execution.
   */
  undo(): void {
    if (!this.executionResult) {
      console.error(
        'Cannot undo: execution result is missing. The command might not have been executed, failed, or undo has already been performed.'
      )
      return
    }

    const { originalStates } = this.executionResult

    for (const bookmark of this.bookmarks) {
      const bookmarkUrl = bookmark[0]
      const bookmarkData = bookmark[1]
      const originalState = originalStates.get(bookmarkUrl)

      if (originalState) {
        // Restore the original tags. Create a new array to avoid shared references.
        const originalTags = [...originalState.tags]
        bookmarkData.tags = originalTags

        // Restore metadata if it was present in the original state.
        // The `meta` property is only stored in `originalState` if it was modified by the command.
        // If `originalState.meta` is undefined, null, or an empty object, it means `meta` was not
        // part of the state to be restored for this specific property, or it was originally absent.
        if (originalState.meta) {
          bookmarkData.meta = { ...originalState.meta } // Shallow copy metadata
        } else {
          // If originalState.meta is not set, it implies meta was not modified or was absent.
          // Depending on desired behavior, you might want to delete bookmarkData.meta here
          // if the command could have added it. For now, we assume if originalState.meta is not there,
          // the current meta (if any) is either from before the command or from another source.
          // This part might need refinement based on how `meta` is handled across commands.
        }

        // Restore deletedMeta if it was present in the original state.
        if (originalState.deletedMeta) {
          bookmarkData.deletedMeta = { ...originalState.deletedMeta } // Shallow copy deletedMeta
        } else if (
          // If deletedMeta was not in the original state (i.e., originalState.deletedMeta is undefined),
          // but it currently exists on the bookmark (bookmarkData.deletedMeta is not undefined),
          // and the restored tags do not include DELETED_BOOKMARK_TAG (meaning the bookmark wasn't originally deleted),
          // then the current deletedMeta must have been added by this command's execution.
          // In this case, it should be removed during undo.
          bookmarkData.deletedMeta &&
          !originalTags.includes(DELETED_BOOKMARK_TAG)
        ) {
          delete bookmarkData.deletedMeta // Remove deletedMeta as it was not present originally and the bookmark is not marked as deleted.
        }
      }
    }

    // Clear the execution result after a successful undo to prevent re-undoing without a new execution.
    this.executionResult = undefined
  }

  /**
   * Retrieves the result of the command's execution.
   * @returns {CommandExecutionResult | undefined} The execution result, or undefined if the command has not been executed.
   */
  getExecutionResult(): CommandExecutionResult | undefined {
    return this.executionResult
  }

  /**
   * Gets the source tags associated with this command.
   * @returns {string[]} A new array containing the source tags to prevent external modification.
   */
  getSourceTags(): string[] {
    return [...this.sourceTags] // Return a copy to prevent external modification
  }

  /**
   * Gets the target tags associated with this command.
   * Base implementation returns undefined; subclasses like RenameTagCommand should override this.
   * @returns {string[] | undefined} Always undefined in the base class.
   */
  getTargetTags(): string[] | undefined {
    return undefined
  }

  /**
   * Gets the timestamp when this command instance was created.
   * @returns {number} The creation timestamp in milliseconds since the epoch.
   */
  getTimestamp(): number {
    return this.timestamp
  }

  /**
   * Abstract method to execute the specific tag operation.
   * Subclasses must implement this to define their behavior and populate `this.executionResult`.
   */
  abstract execute(): void

  /**
   * Abstract method to get the type of the command.
   * Subclasses must implement this to return their specific command type.
   * @returns {'add' | 'remove' | 'rename'} The type of the command.
   */
  abstract getType(): 'add' | 'remove' | 'rename'
}

/**
 * Represents a command to add one or more tags to a selection of bookmarks.
 * If the `DELETED_BOOKMARK_TAG` is among the tags being added, this command
 * will also populate the `deletedMeta` property of the affected bookmarks,
 * effectively marking them as deleted with a specific action type.
 */
export class AddTagCommand extends BaseTagCommand {
  private readonly actionType?: DeleteActionType

  /**
   * Initializes a new instance of the `AddTagCommand`.
   *
   * @param {BookmarkKeyValuePair[]} bookmarks - An array of bookmark key-value pairs (`[url, bookmarkObject]`)
   *                                           to which the tags will be added.
   * @param {string | string[]} sourceTags - The tag or tags to add. This can be a single tag string
   *                                       (which might contain multiple tags separated by spaces/commas)
   *                                       or an array of tag strings. Tags are normalized and deduplicated by the base class.
   * @param {DeleteActionType} [actionType] - Optional. Specifies the context or reason for the deletion if
   *                                          `DELETED_BOOKMARK_TAG` is being added. This information is
   *                                          stored in `deletedMeta.actionType`. If `DELETED_BOOKMARK_TAG`
   *                                          is added and no `actionType` is provided, a default like
   *                                          'BATCH_DELETE_BOOKMARKS' might be used by the `execute` method.
   */
  constructor(
    bookmarks: BookmarkKeyValuePair[],
    sourceTags: string | string[],
    actionType?: DeleteActionType
  ) {
    super(bookmarks, sourceTags)
    this.actionType = actionType
  }

  /**
   * Executes the command to add the specified tags to the bookmarks.
   * For each bookmark, it adds tags from `sourceTags` that are not already present.
   * If `DELETED_BOOKMARK_TAG` is added, it also sets the `deletedMeta` property
   * with the current timestamp and the specified or default `actionType`.
   * The method populates `this.executionResult` with the number of affected bookmarks,
   * the number of bookmarks marked as deleted, and their original states for undo purposes.
   */
  execute(): void {
    if (this.sourceTags.length === 0) {
      console.warn('AddTagCommand: No tags provided for adding.')
      this.executionResult = {
        affectedCount: 0,
        deletedCount: 0,
        originalStates: new Map(),
      }
      return
    }

    const originalStates = new Map<string, OriginalBookmarkData>()
    let affectedCount = 0
    let deletedCount = 0
    const deletionTimestamp = this.getTimestamp() // Timestamp for deletion marking
    // Provide a default actionType if not specified during construction and DELETED_BOOKMARK_TAG is added
    const currentActionType = this.actionType || 'BATCH_DELETE_BOOKMARKS'

    for (const bookmark of this.bookmarks) {
      const bookmarkUrl = bookmark[0]
      const bookmarkData = bookmark[1]

      // Determine which of the sourceTags actually need to be added to this bookmark
      const tagsToAdd = this.sourceTags.filter(
        (tag) => !bookmarkData.tags.includes(tag)
      )

      if (tagsToAdd.length > 0) {
        // Store the original state (tags, meta, deletedMeta) for potential undo operation
        originalStates.set(bookmarkUrl, {
          tags: [...bookmarkData.tags],
          deletedMeta: bookmarkData.deletedMeta
            ? { ...bookmarkData.deletedMeta }
            : undefined,
        })

        // Add the new tags
        bookmarkData.tags = addTags(bookmarkData.tags, tagsToAdd)
        affectedCount++

        // If DELETED_BOOKMARK_TAG was one of the tags added,
        // populate the deletedMeta property.
        if (tagsToAdd.includes(DELETED_BOOKMARK_TAG)) {
          deletedCount++
          bookmarkData.deletedMeta = {
            deleted: deletionTimestamp,
            actionType: currentActionType,
          }
        }
      }
    }

    this.executionResult = { affectedCount, deletedCount, originalStates }
  }

  // Note: The `undo` method is inherited from BaseTagCommand and should correctly restore
  // tags, meta, and deletedMeta based on the `originalStates` populated by this `execute` method.

  /**
   * Gets the type of this command.
   * @returns {'add'} The command type.
   */
  getType(): 'add' {
    return 'add'
  }

  /**
   * Gets a user-friendly description of the command.
   * This typically includes the action being performed and the tags involved.
   * @returns {string} A string describing the command, e.g., "Add tags: tag1, tag2".
   */
  getDescription(): string {
    // TODO: Consider localizing this string if the application supports multiple languages.
    return `Add tags: ${this.sourceTags.join(', ')}`
  }
}

/**
 * Represents a command to remove one or more tags from a selection of bookmarks.
 * This command has specific logic for handling the `DELETED_BOOKMARK_TAG`:
 *
 * 1.  **Tag Removal Condition**: The command removes `sourceTags` from a bookmark
 *     ONLY IF the bookmark currently possesses ALL of the specified `sourceTags`.
 *
 * 2.  **Marking as Deleted**: If, after removing the `sourceTags` (and the condition in point 1 is met),
 *     no other tags remain on the bookmark:
 *     - The bookmark's `tags` array is updated to include its original tags plus `DELETED_BOOKMARK_TAG`.
 *       It's crucial to retain the original tags for display purposes (e.g., on a deleted items page)
 *       and for potential restoration. The `DELETED_BOOKMARK_TAG` is added to this preserved set.
 *     - The `deletedMeta` property is populated with the current timestamp and the `actionType`
 *       (defaults to 'BATCH_REMOVE_TAGS' if not specified in the constructor).
 *     - If `DELETED_BOOKMARK_TAG` was part of the `sourceTags` being removed and the bookmark
 *       already had `deletedMeta` (i.e., it was already deleted), the existing `deletedMeta` is preserved.
 *       This effectively means the command re-confirms its deleted state without altering the original deletion metadata.
 *
 * 3.  **Clearing Deleted State (Undeletion)**: If `DELETED_BOOKMARK_TAG` is among the `sourceTags`
 *     being removed (and the condition in point 1 is met):
 *     - The bookmark's tags are updated to the new set (which will no longer include `DELETED_BOOKMARK_TAG`).
 *     - If the bookmark had `deletedMeta`, this property is cleared, effectively undeleting the bookmark.
 *
 * 4.  **Standard Tag Removal**: If tags remain on the bookmark after removing `sourceTags` (and `DELETED_BOOKMARK_TAG`
 *     was not part of the removal causing an undeletion as per point 3):
 *     - The bookmark's `tags` are updated to the new set of remaining tags.
 *
 * The `execute` method populates `this.executionResult` with the count of affected bookmarks,
 * the count of bookmarks newly marked as deleted, and a map of their original states for undo purposes.
 */
export class RemoveTagCommand extends BaseTagCommand {
  private readonly actionType?: DeleteActionType

  /**
   * Initializes a new instance of the `RemoveTagCommand`.
   *
   * @param {BookmarkKeyValuePair[]} bookmarks - An array of bookmark key-value pairs (`[url, bookmarkObject]`)
   *                                           from which the tags will be removed.
   * @param {string | string[]} sourceTags - The tag or tags to remove. This can be a single tag string or an array of strings.
   *                                       The command will only act on a bookmark if it contains ALL of these `sourceTags`.
   *                                       Tags are normalized (trimmed) and deduplicated by the base class constructor.
   * @param {DeleteActionType} [actionType] - Optional. Specifies the context for deletion if removing tags
   *                                          results in a bookmark being marked as deleted (e.g., when all user-defined tags are removed).
   *                                          This value is stored in `deletedMeta.actionType` if a bookmark becomes newly deleted.
   *                                          Defaults to 'BATCH_REMOVE_TAGS' if not provided and a bookmark is marked as deleted by this command.
   */
  constructor(
    bookmarks: BookmarkKeyValuePair[],
    sourceTags: string | string[],
    actionType?: DeleteActionType
  ) {
    super(bookmarks, sourceTags)
    this.actionType = actionType
  }

  /**
   * Executes the command to remove the specified `sourceTags` from the bookmarks.
   * The behavior is detailed in the class-level JSDoc documentation.
   * Key aspects include:
   * - Conditional removal: Only if all `sourceTags` are present on a bookmark.
   * - Handling `DELETED_BOOKMARK_TAG`: Marking as deleted (preserving original tags) or clearing deleted state.
   * - Storing original states for undo.
   */
  execute(): void {
    if (this.sourceTags.length === 0) {
      console.warn('RemoveTagCommand: No tags provided for removal.')
      this.executionResult = {
        affectedCount: 0,
        deletedCount: 0,
        originalStates: new Map(),
      }
      return
    }

    const originalStates = new Map<string, OriginalBookmarkData>()
    let affectedCount = 0
    let deletedCount = 0
    const deletionTimestamp = this.getTimestamp()
    const currentActionType = this.actionType || 'BATCH_REMOVE_TAGS'
    const tagsToRemove = this.sourceTags // Already normalized and deduplicated by base class
    const isRemovingDeletedBookmarkTag =
      tagsToRemove.includes(DELETED_BOOKMARK_TAG)

    for (const bookmark of this.bookmarks) {
      const bookmarkUrl = bookmark[0]
      const bookmarkData = bookmark[1]

      // Check if the bookmark contains ALL tags specified for removal.
      const allTagsToRemovePresent = tagsToRemove.every((tag) =>
        bookmarkData.tags.includes(tag)
      )

      if (allTagsToRemovePresent) {
        // Store the original state (tags, meta, deletedMeta) for potential undo
        originalStates.set(bookmarkUrl, {
          tags: [...bookmarkData.tags], // Deep copy of original tags
          deletedMeta: bookmarkData.deletedMeta
            ? { ...bookmarkData.deletedMeta } // Deep copy of original deletedMeta
            : undefined,
        })

        const tagsAfterRemoval = removeTags(bookmarkData.tags, tagsToRemove)
        affectedCount++

        if (tagsAfterRemoval.length > 0) {
          // Case 1: Tags remain after removal.
          bookmarkData.tags = tagsAfterRemoval

          // If DELETED_BOOKMARK_TAG was among those removed (effectively an undelete operation),
          // clear the deletedMeta.
          if (isRemovingDeletedBookmarkTag && bookmarkData.deletedMeta) {
            delete bookmarkData.deletedMeta
          }
        } else {
          // Case 2: No tags remain after removal (tagsAfterRemoval is empty).
          // The bookmark is now considered deleted.
          // It's crucial to preserve the original tags for display/undo purposes before adding DELETED_BOOKMARK_TAG.
          // Therefore, we use `bookmarkData.tags` (which still holds the tags *before* the current removal operation)
          // as the base, and then add DELETED_BOOKMARK_TAG to this original set.
          // DO NOT use `tagsAfterRemoval` here, as it would be an empty array, losing the original tag context.
          // @important This ensures that if a user views deleted items, they can see what tags it originally had.
          bookmarkData.tags = addTags(bookmarkData.tags, DELETED_BOOKMARK_TAG) // Preserve original tags + add DELETED_BOOKMARK_TAG

          if (bookmarkData.deletedMeta) {
            // If the bookmark was already marked as deleted (e.g. DELETED_BOOKMARK_TAG was part of tagsToRemove
            // but other tags were also removed, resulting in an empty set again), we keep its original deletedMeta.
            // This avoids overwriting original deletion context if it's essentially being re-deleted.
            console.warn(
              `Bookmark ${bookmarkUrl} is already deleted or being re-deleted, keeping original deletedMeta information.`
            )
          } else {
            // This is a new deletion.
            deletedCount++
            bookmarkData.deletedMeta = {
              deleted: deletionTimestamp,
              actionType: currentActionType,
            }
          }
        }
      }
    }

    this.executionResult = { affectedCount, deletedCount, originalStates }
  }

  // Note: The `undo` method is inherited from BaseTagCommand and should correctly restore
  // tags, meta, and deletedMeta based on the `originalStates` populated by this `execute` method.

  /**
   * Gets the type of this command.
   * @returns {'remove'} The command type.
   */
  getType(): 'remove' {
    return 'remove'
  }

  /**
   * Gets a user-friendly description of the command.
   * This typically includes the action being performed and the tags involved.
   * @returns {string} A string describing the command, e.g., "Remove tags: tag1, tag2".
   */
  getDescription(): string {
    // TODO: Consider localizing this string if the application supports multiple languages.
    //       This can be done using a library like ParaglideJS, passing the message key and parameters.
    //       Example: m.commandDescriptionRemoveTags({ tags: this.sourceTags.join(', ') })
    return `Remove tags: ${this.sourceTags.join(', ')}`
  }
}

/**
 * Represents a command to rename one or more tags in a collection of bookmarks.
 * This command will replace all occurrences of specified source tags with target tags
 * in bookmarks that contain *all* of the source tags.
 */
export class RenameTagCommand extends BaseTagCommand {
  private readonly targetTags: string[]

  /**
   * Creates an instance of RenameTagCommand.
   * @param bookmarks An array of bookmark key-value pairs to operate on.
   *                  Each pair consists of a bookmark URL (string) and its {@link BookmarkTagsAndMetadata}.
   * @param sourceTags The original tag name(s) to be renamed. Can be a single tag string or an array of tag strings.
   *                   These are the tags that will be looked for in the bookmarks.
   * @param targetTags The new tag name(s) to replace the source tags. Can be a single tag string or an array of tag strings.
   *                   These are the tags that will be added to the bookmarks after the source tags (if different) are removed.
   */
  constructor(
    bookmarks: BookmarkKeyValuePair[],
    sourceTags: string | string[],
    targetTags: string | string[]
  ) {
    super(bookmarks, sourceTags)
    this.targetTags = splitTags(targetTags) // Normalize targetTags to an array of strings
  }

  /**
   * Executes the rename tag operation.
   * It iterates through the provided bookmarks. For each bookmark, if it contains all of the `sourceTags`,
   * those `sourceTags` (that are not also `targetTags`) are removed, and all `targetTags` are added.
   * The original state of modified bookmarks (their tags before renaming) is stored for potential undo operations.
   * The command will not execute if `sourceTags` or `targetTags` are empty, or if they include the `DELETED_BOOKMARK_TAG`,
   * logging an error in such cases.
   * Sets `this.executionResult` with the count of affected bookmarks and their original states.
   */
  execute(): void {
    // Prevent execution if source or target tags are invalid or empty.
    // The DELETED_BOOKMARK_TAG is a reserved tag and should not be part of rename operations.
    if (
      this.sourceTags.length === 0 ||
      this.targetTags.length === 0 ||
      this.sourceTags.includes(DELETED_BOOKMARK_TAG) ||
      this.targetTags.includes(DELETED_BOOKMARK_TAG)
    ) {
      console.error(
        'Invalid tag names provided for rename operation. Source/Target tags cannot be empty or include DELETED_BOOKMARK_TAG.'
      )
      // Initialize executionResult to indicate no operation was performed or to prevent errors if undo is called.
      this.executionResult = {
        affectedCount: 0,
        deletedCount: 0,
        originalStates: new Map<string, OriginalBookmarkData>(),
      }
      return
    }

    const originalStates = new Map<string, OriginalBookmarkData>()
    let affectedCount = 0
    const deletedCount = 0 // Rename operation does not directly delete bookmarks, so deletedCount is always 0.

    // Determine which of the source tags need to be explicitly removed.
    // This logic is crucial for maintaining the original order of tags after renaming.
    // For example, if original tags are [A, B, C] and we rename [A, B] to [A, D],
    // the desired result is [A, C, D].
    // Without this specific filtering for `tagsToRemove`, simply removing all sourceTags
    // and then adding all targetTags might result in an incorrect order like [C, A, D].
    // By identifying only the tags that are truly being removed (i.e., in sourceTags but not in targetTags),
    // we can preserve the relative order of other tags and correctly place the new/renamed tags.
    // Tags present in both sourceTags and targetTags are effectively kept (removed then re-added),
    // and this process also handles cases where a tag is 'renamed' to itself (e.g., 'A' to 'A') without unnecessary processing.
    const tagsToRemove = new Set(
      this.sourceTags.filter((tag) => !this.targetTags.includes(tag))
    )

    for (const bookmark of this.bookmarks) {
      const bookmarkUrl = bookmark[0]
      const bookmarkData = bookmark[1]

      // A bookmark is only processed if it contains ALL of the specified source tags.
      const hasAllSourceTags = this.sourceTags.every((tag) =>
        bookmarkData.tags.includes(tag)
      )

      if (hasAllSourceTags) {
        // Save the original state (tags) of the bookmark before modification for undo purposes.
        originalStates.set(bookmarkUrl, {
          tags: [...bookmarkData.tags], // Create a shallow copy of the tags array
        })

        // Remove the source tags that are not part of the target tags.
        const remainingTags = removeTags(bookmarkData.tags, [...tagsToRemove])

        // Add all target tags. The addTags utility handles duplicates, ensuring tags are unique.
        bookmarkData.tags = addTags(remainingTags, this.targetTags)
        affectedCount++
      }
    }

    this.executionResult = { affectedCount, deletedCount, originalStates }
  }

  /**
   * Gets the type of this command.
   * @returns The command type, which is always 'rename' for this class.
   */
  getType(): 'rename' {
    return 'rename'
  }

  /**
   * Gets a copy of the target tags for this command.
   * @returns An array of strings representing the target tags.
   */
  override getTargetTags(): string[] {
    return [...this.targetTags] // Return a copy to prevent external modification
  }

  /**
   * Gets a human-readable description of the command.
   * This description can be used for display purposes, such as in an undo/redo history list.
   * @returns A string describing the rename operation.
   * @todo Consider localizing this string in the future.
   */
  getDescription(): string {
    // TODO: Localize this string
    return `Rename tags: ${this.sourceTags.join(', ')} -> ${this.targetTags.join(', ')}`
  }
}

/**
 * Composite Tag Command - Combines multiple commands into a single command
 */
export class CompositeTagCommand implements TagCommand {
  private readonly commands: TagCommand[]
  private readonly type: 'add' | 'remove' | 'rename'
  private readonly name: string
  private executionResult?: CommandExecutionResult
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
  execute(): void {
    const compositeOriginalStates = new Map<string, OriginalBookmarkData>()
    let totalAffectedCount = 0
    let totalDeletedCount = 0

    for (const command of this.commands) {
      command.execute()
      const result = command.getExecutionResult()
      if (!result) {
        console.error('Command execution result is missing.')
        continue
      }

      totalAffectedCount += result.affectedCount
      totalDeletedCount += result.deletedCount
      for (const [
        url,
        originalBookmarkData,
      ] of result.originalStates.entries()) {
        if (!compositeOriginalStates.has(url)) {
          compositeOriginalStates.set(url, originalBookmarkData)
        }
      }
    }

    this.executionResult = {
      affectedCount: totalAffectedCount,
      deletedCount: totalDeletedCount,
      originalStates: compositeOriginalStates,
    }
  }

  /**
   * Undo all commands in reverse sequence
   * @param originalStates Map of affected bookmark URLs and their original tags
   */
  undo(): void {
    // Undo commands in reverse order
    // Each sub-command will use its own stored executionResult for its undo logic
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo()
    }
  }

  getExecutionResult(): CommandExecutionResult | undefined {
    return this.executionResult
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
 * Manages a history of commands, allowing for undo and redo operations on bookmarks.
 * It supports executing single commands or batches of commands, persisting changes
 * via an optional callback, and limiting the size of the command history.
 */
export class CommandManager {
  private commandHistory: TagCommand[] = []
  private currentIndex = -1
  private readonly persistCallback?:
    | ((bookmarks: BookmarkKeyValuePair[]) => Promise<void>)
    | undefined

  private maxHistorySize = 100 // Default maximum history size

  /**
   * Creates an instance of CommandManager.
   * @param persistCallback - Optional. A function called after command execution, undo, or redo
   *                          to persist the changes to storage. It receives the array of all bookmarks.
   * @param maxHistorySize - Optional. The maximum number of commands to keep in the history. Defaults to 100.
   */
  constructor(
    persistCallback?: (bookmarks: BookmarkKeyValuePair[]) => Promise<void>,
    maxHistorySize = 100
  ) {
    this.persistCallback = persistCallback
    this.maxHistorySize = maxHistorySize
  }

  /**
   * Executes a single command, adds it to the history, and optionally persists the changes.
   * If new commands are executed after an undo operation, the previous redo history is cleared.
   * @param command - The command to execute.
   * @param bookmarks - Optional. The array of all bookmarks, passed to the persistCallback if provided.
   * @returns A promise that resolves when the command has been executed and changes (if any) have been persisted.
   */
  async executeCommand(
    command: TagCommand,
    bookmarks?: BookmarkKeyValuePair[]
  ): Promise<void> {
    // Execute single command
    await this.executeCommandsInternal([command], bookmarks)
  }

  /**
   * Executes multiple commands as a single batch transaction, adds them to the history,
   * and optionally persists the changes. This is treated as a single operation in the undo/redo stack.
   * If new commands are executed after an undo operation, the previous redo history is cleared.
   * @param commands - An array of commands to execute in sequence.
   * @param bookmarks - Optional. The array of all bookmarks, passed to the persistCallback if provided.
   * @returns A promise that resolves to true if commands were executed (i.e., the commands array was not empty),
   *          false otherwise. The promise also ensures commands are executed and changes (if any) are persisted.
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
   * Undoes the last executed command and optionally persists the changes.
   * @param bookmarks - Optional. The array of all bookmarks, passed to the persistCallback if provided.
   * @returns A promise that resolves to true if the undo operation was successful, false otherwise (e.g., if there's nothing to undo).
   *          The promise also ensures changes (if any) are persisted.
   */
  async undo(bookmarks?: BookmarkKeyValuePair[]): Promise<boolean> {
    if (this.currentIndex < 0) {
      return false
    }

    const command = this.commandHistory[this.currentIndex]

    command.undo()
    this.currentIndex--

    // If persistence callback and bookmarks array provided, save changes
    if (this.persistCallback && bookmarks) {
      await this.persistCallback(bookmarks)
    }

    return true
  }

  /**
   * Redoes the last undone command and optionally persists the changes.
   * @param bookmarks - Optional. The array of all bookmarks, passed to the persistCallback if provided.
   * @returns A promise that resolves to true if the redo operation was successful, false otherwise (e.g., if there's nothing to redo).
   *          The promise also ensures changes (if any) are persisted.
   */
  async redo(bookmarks?: BookmarkKeyValuePair[]): Promise<boolean> {
    if (this.currentIndex >= this.commandHistory.length - 1) {
      return false
    }

    this.currentIndex++
    const command = this.commandHistory[this.currentIndex]

    // Re-execute command and update affected bookmarks
    command.execute() // Command re-executes and stores its own result

    // If persistence callback and bookmarks array provided, save changes
    if (this.persistCallback && bookmarks) {
      await this.persistCallback(bookmarks)
    }

    return true
  }

  /**
   * Checks if an undo operation can be performed.
   * @returns True if there is at least one command in the history that can be undone, false otherwise.
   */
  canUndo(): boolean {
    return this.currentIndex >= 0
  }

  /**
   * Checks if a redo operation can be performed.
   * @returns True if there is at least one undone command in the history that can be redone, false otherwise.
   */
  canRedo(): boolean {
    return this.currentIndex < this.commandHistory.length - 1
  }

  /**
   * Gets a copy of the current command history.
   * @returns An array containing the executed commands.
   */
  getCommandHistory(): TagCommand[] {
    return [...this.commandHistory]
  }

  /**
   * Gets the current index in the command history.
   * This points to the last executed command. -1 means the history is empty or all commands have been undone.
   * @returns The current index.
   */
  getCurrentIndex(): number {
    return this.currentIndex
  }

  /**
   * Clears the entire command history and resets the current index.
   */
  clear(): void {
    this.commandHistory = []
    this.currentIndex = -1
  }

  /**
   * Sets the maximum number of commands to keep in the history.
   * If the new size is smaller than the current history size, the oldest commands are removed.
   * @param size - The new maximum history size. Must be greater than 0.
   * @throws Error if the provided size is less than 1.
   */
  setMaxHistorySize(size: number): void {
    if (size < 1) {
      // TODO: Consider localizing this error message if CommandManager is used in UI directly
      // or if error messages are meant to be user-facing.
      throw new Error('History size must be greater than 0')
    }

    this.maxHistorySize = size

    // Trim history if needed
    if (this.commandHistory.length > this.maxHistorySize) {
      const excess = this.commandHistory.length - this.maxHistorySize
      this.commandHistory = this.commandHistory.slice(excess)
      this.currentIndex -= excess
    }
  }

  /**
   * Internal helper method to execute a list of commands, update the command history,
   * manage history size, and trigger persistence.
   * @param commands - An array of commands to execute.
   * @param bookmarks - Optional. The array of all bookmarks, passed to the persistCallback if provided.
   * @private
   */
  private async executeCommandsInternal(
    commands: TagCommand[],
    bookmarks?: BookmarkKeyValuePair[]
  ): Promise<void> {
    // If not at the last command (i.e., some undos have happened),
    // clear commands after the current index, effectively removing the redo history.
    if (this.currentIndex < this.commandHistory.length - 1) {
      this.commandHistory = this.commandHistory.slice(0, this.currentIndex + 1)
    }

    // Execute all commands and add them to the history
    for (const command of commands) {
      command.execute()
      this.commandHistory.push(command)
      this.currentIndex++ // Increment index for each command added
    }

    // Limit history size by removing the oldest commands if necessary
    if (this.commandHistory.length > this.maxHistorySize) {
      const excess = this.commandHistory.length - this.maxHistorySize
      this.commandHistory = this.commandHistory.slice(excess)
      // Adjust currentIndex to reflect the removed items from the beginning of the array
      this.currentIndex -= excess
    }

    // If persistence callback and bookmarks array provided, save changes
    if (this.persistCallback && bookmarks) {
      await this.persistCallback(bookmarks)
    }
  }
}
