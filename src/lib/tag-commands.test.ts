import { describe, it, expect, beforeEach } from 'vitest'
import type { BookmarkKeyValuePair } from '../types/bookmarks.js'
import { DELETED_BOOKMARK_TAG } from '../config/constants.js'
import {
  AddTagCommand,
  RemoveTagCommand,
  RenameTagCommand,
} from './tag-commands.js'

describe('AddTagCommand', () => {
  // Sample bookmarks for testing
  let testBookmarks: BookmarkKeyValuePair[]

  beforeEach(() => {
    // Reset test data before each test
    testBookmarks = [
      [
        'https://example.com',
        {
          tags: ['example', 'test'],
          meta: {
            title: 'Example Website',
            created: Date.now(),
            updated: Date.now(),
          },
        },
      ],
      [
        'https://test.org',
        {
          tags: ['test', 'organization'],
          meta: {
            title: 'Test Organization',
            created: Date.now(),
            updated: Date.now(),
          },
        },
      ],
    ]
  })

  it('should add a tag to bookmarks that do not have it', () => {
    // Create command
    const command = new AddTagCommand(testBookmarks, 'new-tag')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts
    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were added
    expect(testBookmarks[0][1].tags).toContain('new-tag')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'new-tag'])
    expect(testBookmarks[1][1].tags).toContain('new-tag')
    expect(testBookmarks[1][1].tags).toEqual([
      'test',
      'organization',
      'new-tag',
    ])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
    ])
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
    ])

    // Undo command
    command.undo()

    // Verify tags were removed after undo
    expect(testBookmarks[0][1].tags).not.toContain('new-tag')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test'])
    expect(testBookmarks[1][1].tags).not.toContain('new-tag')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization'])
  })

  it('should not add a tag if bookmark already has it', () => {
    // Add tag to first bookmark
    testBookmarks[0][1].tags.push('existing-tag')

    // Create command
    const command = new AddTagCommand(testBookmarks, 'existing-tag')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts
    expect(executionResult!.affectedCount).toBe(1) // Only the second bookmark is affected
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tag was only added to second bookmark
    expect(testBookmarks[0][1].tags).toContain('existing-tag')
    expect(
      testBookmarks[0][1].tags.filter((tag) => tag === 'existing-tag').length
    ).toBe(1) // No duplicates
    expect(testBookmarks[0][1].tags).toEqual([
      'example',
      'test',
      'existing-tag',
    ])
    expect(testBookmarks[1][1].tags).toContain('existing-tag')
    expect(testBookmarks[1][1].tags).toEqual([
      'test',
      'organization',
      'existing-tag',
    ])

    // Verify affected map only contains the second bookmark
    expect(originalStates.size).toBe(1)
    expect(originalStates.has('https://example.com')).toBe(false)
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
    ])

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('existing-tag') // First bookmark is not affected, still keeps the tag
    expect(testBookmarks[0][1].tags).toEqual([
      'example',
      'test',
      'existing-tag',
    ])
    expect(testBookmarks[1][1].tags).not.toContain('existing-tag') // Second bookmark's tag is removed
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization'])
  })

  it('should handle empty bookmarks array', () => {
    // Create command with empty bookmarks array
    const command = new AddTagCommand([], 'new-tag')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts
    expect(executionResult!.affectedCount).toBe(0)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify no errors and empty affected map
    expect(originalStates.size).toBe(0)

    // Undo command (should not throw errors)
    expect(() => {
      command.undo()
    }).not.toThrow()
  })

  it('should undo tag addition correctly', () => {
    // Create command
    const command = new AddTagCommand(testBookmarks, 'new-tag')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts before undo
    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were added
    expect(testBookmarks[0][1].tags).toContain('new-tag')
    expect(testBookmarks[1][1].tags).toContain('new-tag')

    // Undo command
    command.undo()

    // Verify tags were removed
    expect(testBookmarks[0][1].tags).not.toContain('new-tag')
    expect(testBookmarks[1][1].tags).not.toContain('new-tag')

    // Verify original tags are preserved
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization'])
  })

  it('should add deletedMeta when DELETED_BOOKMARK_TAG is added and remove it on undo', () => {
    const command = new AddTagCommand(
      testBookmarks, // Neither bookmark has DELETED_BOOKMARK_TAG initially
      [DELETED_BOOKMARK_TAG, 'another-tag'],
      'BATCH_DELETE_BOOKMARKS'
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts
    expect(executionResult!.affectedCount).toBe(2) // Both bookmarks get 'another-tag'
    expect(executionResult!.deletedCount).toBe(2) // Both bookmarks get DELETED_BOOKMARK_TAG

    // Verify deletedMeta is added to both bookmarks
    expect(testBookmarks[0][1].deletedMeta).toBeDefined()
    expect(testBookmarks[0][1].deletedMeta?.actionType).toBe(
      'BATCH_DELETE_BOOKMARKS'
    )
    expect(testBookmarks[0][1].deletedMeta?.deleted).toBeTypeOf('number')
    expect(testBookmarks[1][1].deletedMeta).toBeDefined()
    expect(testBookmarks[1][1].deletedMeta?.actionType).toBe(
      'BATCH_DELETE_BOOKMARKS'
    )
    expect(testBookmarks[1][1].deletedMeta?.deleted).toBeTypeOf('number')

    // Verify tags are added
    expect(testBookmarks[0][1].tags).toContain(DELETED_BOOKMARK_TAG)
    expect(testBookmarks[0][1].tags).toContain('another-tag')
    expect(testBookmarks[1][1].tags).toContain(DELETED_BOOKMARK_TAG)
    expect(testBookmarks[1][1].tags).toContain('another-tag')

    // Undo command
    command.undo()

    // Verify deletedMeta is removed after undo for both bookmarks
    expect(testBookmarks[0][1].deletedMeta).toBeUndefined()
    expect(testBookmarks[1][1].deletedMeta).toBeUndefined()

    // Verify tags were removed after undo
    expect(testBookmarks[0][1].tags).not.toContain(DELETED_BOOKMARK_TAG)
    expect(testBookmarks[0][1].tags).not.toContain('another-tag')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test'])
    expect(testBookmarks[1][1].tags).not.toContain(DELETED_BOOKMARK_TAG)
    expect(testBookmarks[1][1].tags).not.toContain('another-tag')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization'])
  })

  it('should preserve existing DELETED_BOOKMARK_TAG and its deletedMeta on undo if DELETED_BOOKMARK_TAG was already present', () => {
    // Pre-condition: First bookmark already has DELETED_BOOKMARK_TAG and deletedMeta
    const initialDeletedTime = Date.now() - 10_000 // A time in the past
    testBookmarks[0][1].tags.push(DELETED_BOOKMARK_TAG)
    testBookmarks[0][1].deletedMeta = {
      deleted: initialDeletedTime,
      actionType: 'LAST_TAG_REMOVED',
    }

    // Attempt to add DELETED_BOOKMARK_TAG (which is already there for the first bookmark)
    // and 'new-common-tag' to both bookmarks
    const command = new AddTagCommand(
      testBookmarks,
      [DELETED_BOOKMARK_TAG, 'new-common-tag'],
      'BATCH_DELETE_BOOKMARKS' // This actionType will be used for the second bookmark
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts
    // First bookmark: only 'new-common-tag' is new. DELETED_BOOKMARK_TAG was already there.
    // Second bookmark: both DELETED_BOOKMARK_TAG and 'new-common-tag' are new.
    expect(executionResult!.affectedCount).toBe(2) // Both bookmarks get 'new-common-tag'
    expect(executionResult!.deletedCount).toBe(1) // Only the second bookmark is newly marked as deleted

    // Verify the first bookmark's deletedMeta is NOT overwritten by the command's actionType or timestamp
    // because DELETED_BOOKMARK_TAG was already present.
    // Its deletedMeta should remain as it was.
    expect(testBookmarks[0][1].deletedMeta).toBeDefined()
    expect(testBookmarks[0][1].deletedMeta?.actionType).toBe('LAST_TAG_REMOVED')
    expect(testBookmarks[0][1].deletedMeta?.deleted).toBe(initialDeletedTime)
    expect(testBookmarks[0][1].tags).toContain(DELETED_BOOKMARK_TAG)
    expect(testBookmarks[0][1].tags).toContain('new-common-tag')

    // Verify the second bookmark gets DELETED_BOOKMARK_TAG and new deletedMeta
    expect(testBookmarks[1][1].deletedMeta).toBeDefined()
    expect(testBookmarks[1][1].deletedMeta?.actionType).toBe(
      'BATCH_DELETE_BOOKMARKS'
    )
    expect(testBookmarks[1][1].deletedMeta?.deleted).not.toBe(
      initialDeletedTime
    )
    expect(testBookmarks[1][1].tags).toContain(DELETED_BOOKMARK_TAG)
    expect(testBookmarks[1][1].tags).toContain('new-common-tag')

    // Undo command
    command.undo()

    // Verify the first bookmark still has DELETED_BOOKMARK_TAG and its original deletedMeta
    expect(testBookmarks[0][1].tags).toContain(DELETED_BOOKMARK_TAG)
    expect(testBookmarks[0][1].deletedMeta).toBeDefined()
    expect(testBookmarks[0][1].deletedMeta?.actionType).toBe('LAST_TAG_REMOVED')
    expect(testBookmarks[0][1].deletedMeta?.deleted).toBe(initialDeletedTime)
    expect(testBookmarks[0][1].tags).not.toContain('new-common-tag') // new-common-tag should be removed
    expect(testBookmarks[0][1].tags).toEqual([
      'example',
      'test',
      DELETED_BOOKMARK_TAG,
    ])

    // Verify the second bookmark has DELETED_BOOKMARK_TAG and deletedMeta removed
    expect(testBookmarks[1][1].tags).not.toContain(DELETED_BOOKMARK_TAG)
    expect(testBookmarks[1][1].deletedMeta).toBeUndefined()
    expect(testBookmarks[1][1].tags).not.toContain('new-common-tag')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization'])
  })

  it('should return correct command type', () => {
    const command = new AddTagCommand(testBookmarks, 'new-tag')
    expect(command.getType()).toBe('add')
  })

  it('should return correct source tag', () => {
    const command = new AddTagCommand(testBookmarks, 'new-tag')
    expect(command.getSourceTags()).toEqual(['new-tag'])
  })

  it('should return undefined for target tag', () => {
    const command = new AddTagCommand(testBookmarks, 'new-tag')
    expect(command.getTargetTags()).toBeUndefined()
  })

  it('should add multiple tags to bookmarks that do not have them', () => {
    // Create command with multiple tags
    const command = new AddTagCommand(testBookmarks, ['new-tag-1', 'new-tag-2'])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts
    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were added
    expect(testBookmarks[0][1].tags).toContain('new-tag-1')
    expect(testBookmarks[0][1].tags).toContain('new-tag-2')
    expect(testBookmarks[0][1].tags).toEqual([
      'example',
      'test',
      'new-tag-1',
      'new-tag-2',
    ])
    expect(testBookmarks[1][1].tags).toContain('new-tag-1')
    expect(testBookmarks[1][1].tags).toContain('new-tag-2')
    expect(testBookmarks[1][1].tags).toEqual([
      'test',
      'organization',
      'new-tag-1',
      'new-tag-2',
    ])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
    ])
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
    ])

    // Undo command
    command.undo()

    // Verify tags were removed after undo
    expect(testBookmarks[0][1].tags).not.toContain('new-tag-1')
    expect(testBookmarks[0][1].tags).not.toContain('new-tag-2')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test'])
    expect(testBookmarks[1][1].tags).not.toContain('new-tag-1')
    expect(testBookmarks[1][1].tags).not.toContain('new-tag-2')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization'])
  })

  it('should only add tags that do not already exist in bookmarks', () => {
    // Add one tag to first bookmark
    testBookmarks[0][1].tags.push('existing-tag-1')

    // Create command with a mix of existing and new tags
    const command = new AddTagCommand(testBookmarks, [
      'existing-tag-1',
      'new-tag-3',
    ])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts
    // First bookmark: only 'new-tag-3' is new.
    // Second bookmark: both 'existing-tag-1' and 'new-tag-3' are new.
    expect(executionResult!.affectedCount).toBe(2) // Both bookmarks have at least one new tag added
    expect(executionResult!.deletedCount).toBe(0)

    // Verify only new tags were added to first bookmark
    expect(testBookmarks[0][1].tags).toContain('existing-tag-1')
    expect(testBookmarks[0][1].tags).toContain('new-tag-3')
    expect(
      testBookmarks[0][1].tags.filter((tag) => tag === 'existing-tag-1').length
    ).toBe(1) // No duplicates
    expect(testBookmarks[0][1].tags).toEqual([
      'example',
      'test',
      'existing-tag-1',
      'new-tag-3',
    ])

    // Verify all tags were added to second bookmark
    expect(testBookmarks[1][1].tags).toContain('existing-tag-1')
    expect(testBookmarks[1][1].tags).toContain('new-tag-3')
    expect(testBookmarks[1][1].tags).toEqual([
      'test',
      'organization',
      'existing-tag-1',
      'new-tag-3',
    ])

    // Verify affected map contains correct bookmarks
    expect(originalStates.size).toBe(2)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
      'existing-tag-1',
    ])
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
    ])

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('existing-tag-1') // First bookmark keeps existing tag
    expect(testBookmarks[0][1].tags).not.toContain('new-tag-3')
    expect(testBookmarks[0][1].tags).toEqual([
      'example',
      'test',
      'existing-tag-1',
    ])
    expect(testBookmarks[1][1].tags).not.toContain('existing-tag-1')
    expect(testBookmarks[1][1].tags).not.toContain('new-tag-3')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization'])
  })

  it('should handle duplicate tags in the input array', () => {
    // Create command with duplicate tags
    const command = new AddTagCommand(testBookmarks, [
      'duplicate-tag',
      'duplicate-tag',
      'another-tag',
    ])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts - duplicates in input are effectively ignored if tag already exists or is added once
    expect(executionResult!.affectedCount).toBe(2) // Both bookmarks get 'new-tag-1' and 'new-tag-2'
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were added without duplicates
    expect(testBookmarks[0][1].tags).toContain('duplicate-tag')
    expect(testBookmarks[0][1].tags).toContain('another-tag')
    expect(
      testBookmarks[0][1].tags.filter((tag) => tag === 'duplicate-tag').length
    ).toBe(1) // No duplicates
    expect(testBookmarks[0][1].tags).toEqual([
      'example',
      'test',
      'duplicate-tag',
      'another-tag',
    ])

    expect(testBookmarks[1][1].tags).toContain('duplicate-tag')
    expect(testBookmarks[1][1].tags).toContain('another-tag')
    expect(
      testBookmarks[1][1].tags.filter((tag) => tag === 'duplicate-tag').length
    ).toBe(1) // No duplicates
    expect(testBookmarks[1][1].tags).toEqual([
      'test',
      'organization',
      'duplicate-tag',
      'another-tag',
    ])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
    ])
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
    ])

    // Undo command
    command.undo()

    // Verify tags were removed after undo
    expect(testBookmarks[0][1].tags).not.toContain('duplicate-tag')
    expect(testBookmarks[0][1].tags).not.toContain('another-tag')
    expect(testBookmarks[1][1].tags).not.toContain('duplicate-tag')
    expect(testBookmarks[1][1].tags).not.toContain('another-tag')
  })

  it('should handle string input with multiple tags', () => {
    // Create command with comma-separated string of tags
    const command = new AddTagCommand(testBookmarks, 'tag1,  , , tag2 ， tag3')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    // Verify counts
    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify all tags were added
    expect(testBookmarks[0][1].tags).toContain('tag1')
    expect(testBookmarks[0][1].tags).toContain('tag2')
    expect(testBookmarks[0][1].tags).toContain('tag3')
    expect(testBookmarks[0][1].tags).toEqual([
      'example',
      'test',
      'tag1',
      'tag2',
      'tag3',
    ])

    expect(testBookmarks[1][1].tags).toContain('tag1')
    expect(testBookmarks[1][1].tags).toContain('tag2')
    expect(testBookmarks[1][1].tags).toContain('tag3')
    expect(testBookmarks[1][1].tags).toEqual([
      'test',
      'organization',
      'tag1',
      'tag2',
      'tag3',
    ])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)

    // Undo command
    command.undo()

    // Verify tags were removed after undo
    expect(testBookmarks[0][1].tags).not.toContain('tag1')
    expect(testBookmarks[0][1].tags).not.toContain('tag2')
    expect(testBookmarks[0][1].tags).not.toContain('tag3')
    expect(testBookmarks[1][1].tags).not.toContain('tag1')
    expect(testBookmarks[1][1].tags).not.toContain('tag2')
    expect(testBookmarks[1][1].tags).not.toContain('tag3')
  })

  it('should correctly report source tags', () => {
    // Create command with multiple tags
    const command = new AddTagCommand(testBookmarks, [
      'tag-a',
      'tag-b',
      'tag-c',
    ])

    // Verify source tags are correctly reported
    expect(command.getSourceTags()).toEqual(['tag-a', 'tag-b', 'tag-c'])
    expect(command.getSourceTags()).not.toBe(command.getSourceTags()) // Should return a copy
  })
})

describe('RemoveTagCommand', () => {
  // Sample bookmarks for testing
  let testBookmarks: BookmarkKeyValuePair[]

  beforeEach(() => {
    // Reset test data before each test
    testBookmarks = [
      [
        'https://example.com',
        {
          tags: ['example', 'test', 'common'],
          meta: {
            title: 'Example Website',
            created: Date.now(),
            updated: Date.now(),
          },
        },
      ],
      [
        'https://test.org',
        {
          tags: ['test', 'organization', 'common'],
          meta: {
            title: 'Test Organization',
            created: Date.now(),
            updated: Date.now(),
          },
        },
      ],
    ]
  })

  it('should remove a tag from bookmarks that have it', () => {
    // Create command
    const command = new RemoveTagCommand(testBookmarks, 'test')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were removed
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'common'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).toEqual(['organization', 'common'])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
      'common',
    ])

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
  })

  it('should not affect bookmarks that do not have the tag', () => {
    // Remove tag from first bookmark
    testBookmarks[0][1].tags = testBookmarks[0][1].tags.filter(
      (tag) => tag !== 'test'
    )

    // Create command
    const command = new RemoveTagCommand(testBookmarks, 'test')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify only second bookmark was affected
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'common'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).toEqual(['organization', 'common'])

    // Verify affected map only contains the second bookmark
    expect(originalStates.size).toBe(1)
    expect(originalStates.has('https://example.com')).toBe(false)
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
      'common',
    ])

    // Undo command
    command.undo()

    // Verify only second bookmark was restored
    expect(testBookmarks[0][1].tags).not.toContain('test') // First bookmark is not affected
    expect(testBookmarks[0][1].tags).toEqual(['example', 'common'])
    expect(testBookmarks[1][1].tags).toContain('test') // Second bookmark's tag is restored
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
  })

  it('should handle empty bookmarks array', () => {
    // Create command with empty bookmarks array
    const command = new RemoveTagCommand([], 'test')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(0)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify no errors and empty affected map
    expect(originalStates.size).toBe(0)

    // Undo command (should not throw errors)
    expect(() => {
      command.undo()
    }).not.toThrow()
  })

  it('should handle removing a tag that does not exist in any bookmark', () => {
    // Create command with non-existent tag
    const command = new RemoveTagCommand(testBookmarks, 'non-existent-tag')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(0)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify no bookmarks were affected
    expect(originalStates.size).toBe(0)
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])

    // Undo command (should not change anything)
    command.undo()

    // Verify bookmarks remain unchanged
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
  })

  it('should return correct command type', () => {
    const command = new RemoveTagCommand(testBookmarks, 'test')
    expect(command.getType()).toBe('remove')
  })

  it('should return correct source tag', () => {
    const command = new RemoveTagCommand(testBookmarks, 'test')
    expect(command.getSourceTags()).toEqual(['test'])
  })

  it('should return undefined for target tag', () => {
    const command = new RemoveTagCommand(testBookmarks, 'test')
    expect(command.getTargetTags()).toBeUndefined()
  })

  it('should remove multiple tags from bookmarks that have them', () => {
    // Create command with multiple tags
    const command = new RemoveTagCommand(testBookmarks, ['test', 'common'])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were removed
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).toEqual(['example'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('common')
    expect(testBookmarks[1][1].tags).toEqual(['organization'])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
      'common',
    ])

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).toContain('common')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).toContain('common')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
  })

  it('should only remove tags if bookmark contains ALL specified tags', () => {
    // Create command with multiple tags where one bookmark has all tags and one doesn't
    const command = new RemoveTagCommand(testBookmarks, ['test', 'example'])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify only first bookmark was affected (has both 'test' and 'example')
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('example')
    expect(testBookmarks[0][1].tags).toEqual(['common'])

    // Second bookmark should be unchanged (has 'test' but not 'example')
    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])

    // Verify affected map only contains the first bookmark
    expect(originalStates.size).toBe(1)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(originalStates.has('https://test.org')).toBe(false)

    // Undo command
    command.undo()

    // Verify only first bookmark was restored
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).toContain('example')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
  })

  it('should handle string input with multiple tags', () => {
    // Create command with comma-separated string of tags
    const command = new RemoveTagCommand(testBookmarks, 'test,common')

    // Verify source tags are correctly reported
    expect(command.getSourceTags()).toEqual(['test', 'common'])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were removed
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).toEqual(['example'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('common')
    expect(testBookmarks[1][1].tags).toEqual(['organization'])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).toContain('common')
    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).toContain('common')
  })

  it('should handle duplicate tags in the input array', () => {
    // Create command with duplicate tags
    const command = new RemoveTagCommand(testBookmarks, [
      'test',
      'test',
      'common',
    ])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were removed without issues
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).toEqual(['example'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('common')
    expect(testBookmarks[1][1].tags).toEqual(['organization'])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).toContain('common')
    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).toContain('common')
  })

  it('should handle mix of existing and non-existing tags', () => {
    // Create command with mix of existing and non-existing tags
    const command = new RemoveTagCommand(testBookmarks, [
      'test',
      'non-existent-tag',
    ])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(0)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify no bookmarks were affected (since not all tags exist in any bookmark)
    expect(originalStates.size).toBe(0)
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])

    // Undo command (should not change anything)
    command.undo()

    // Verify bookmarks remain unchanged
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
  })

  it('should correctly report source tags for multiple tags', () => {
    // Create command with multiple tags
    const command = new RemoveTagCommand(testBookmarks, [
      'tag-a',
      'tag-b',
      'tag-c',
    ])

    // Verify source tags are correctly reported
    expect(command.getSourceTags()).toEqual(['tag-a', 'tag-b', 'tag-c'])
    expect(command.getSourceTags()).not.toBe(command.getSourceTags()) // Should return a copy
  })

  it('should mark bookmark as deleted if all tags are removed', () => {
    // Setup a bookmark with only one tag
    testBookmarks = [
      [
        'https://example.com/single-tag',
        {
          tags: ['only-tag'],
          meta: {
            title: 'Single Tag Bookmark',
            created: Date.now(),
            updated: Date.now(),
          },
        },
      ],
    ]

    // Create command to remove the last tag
    const command = new RemoveTagCommand(
      testBookmarks,
      'only-tag',
      'LAST_TAG_REMOVED' // Provide an actionType
    )
    const deletionTimestamp = Date.now() // Capture timestamp before execution for comparison

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(1)

    // Verify bookmark is marked as deleted
    expect(testBookmarks[0][1].tags).toEqual(['only-tag', DELETED_BOOKMARK_TAG])
    expect(testBookmarks[0][1].deletedMeta).toBeDefined()
    expect(testBookmarks[0][1].deletedMeta?.actionType).toBe('LAST_TAG_REMOVED')
    // Check if the deletion timestamp is close to the captured one
    expect(testBookmarks[0][1].deletedMeta?.deleted).toBeGreaterThanOrEqual(
      deletionTimestamp
    )
    expect(testBookmarks[0][1].deletedMeta?.deleted).toBeLessThanOrEqual(
      Date.now() + 100 // Allow a small buffer for execution time
    )

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(1)
    expect(originalStates.get('https://example.com/single-tag')!.tags).toEqual([
      'only-tag',
    ])

    // Undo command
    command.undo()

    // Verify bookmark is restored
    expect(testBookmarks[0][1].tags).toEqual(['only-tag'])
    expect(testBookmarks[0][1].deletedMeta).toBeUndefined()
  })

  it('should remove DELETED_BOOKMARK_TAG and its deletedMeta when other tags exist, and restore on undo', () => {
    const initialDeletedTime = Date.now() - 5000
    testBookmarks[0][1].tags = ['tagA', DELETED_BOOKMARK_TAG, 'tagB']
    testBookmarks[0][1].deletedMeta = {
      deleted: initialDeletedTime,
      actionType: 'BATCH_DELETE_BOOKMARKS',
    }
    // Ensure the second bookmark is not affected by this specific test logic
    testBookmarks[1][1].tags = ['tagC']
    delete testBookmarks[1][1].deletedMeta

    const command = new RemoveTagCommand(
      [testBookmarks[0]], // Only operate on the first bookmark
      DELETED_BOOKMARK_TAG
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify DELETED_BOOKMARK_TAG and deletedMeta are removed
    expect(testBookmarks[0][1].tags).toEqual(['tagA', 'tagB'])
    expect(testBookmarks[0][1].deletedMeta).toBeUndefined()
    expect(originalStates.get(testBookmarks[0][0])).toBeDefined()
    expect(originalStates.get(testBookmarks[0][0])!.deletedMeta).toBeDefined()
    expect(
      originalStates.get(testBookmarks[0][0])!.deletedMeta!.actionType
    ).toEqual('BATCH_DELETE_BOOKMARKS')
    expect(
      originalStates.get(testBookmarks[0][0])!.deletedMeta!.deleted
    ).toEqual(initialDeletedTime)

    // Verify affected map
    expect(originalStates.size).toBe(1)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'tagA',
      DELETED_BOOKMARK_TAG,
      'tagB',
    ])

    command.undo()

    // Verify DELETED_BOOKMARK_TAG and deletedMeta are restored
    expect(testBookmarks[0][1].tags).toContain(DELETED_BOOKMARK_TAG)
    expect(testBookmarks[0][1].tags).toEqual([
      'tagA',
      DELETED_BOOKMARK_TAG,
      'tagB',
    ])
    expect(testBookmarks[0][1].deletedMeta).toBeDefined()
    expect(testBookmarks[0][1].deletedMeta?.actionType).toBe(
      'BATCH_DELETE_BOOKMARKS'
    )
    expect(testBookmarks[0][1].deletedMeta?.deleted).toBe(initialDeletedTime)
    expect((testBookmarks[0][1] as any)._deletedMeta).toBeUndefined()
  })

  it('should remove DELETED_BOOKMARK_TAG, another tag, and deletedMeta simultaneously, and restore on undo', () => {
    const initialDeletedTime = Date.now() - 6000
    testBookmarks[0][1].tags = ['tagA', DELETED_BOOKMARK_TAG, 'tagB']
    testBookmarks[0][1].deletedMeta = {
      deleted: initialDeletedTime,
      actionType: 'LAST_TAG_REMOVED',
    }
    testBookmarks[1][1].tags = ['tagC'] // Not involved
    delete testBookmarks[1][1].deletedMeta

    const command = new RemoveTagCommand(
      [testBookmarks[0]],
      [DELETED_BOOKMARK_TAG, 'tagA']
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags and deletedMeta are removed
    expect(testBookmarks[0][1].tags).toEqual(['tagB'])
    expect(testBookmarks[0][1].deletedMeta).toBeUndefined()
    expect(originalStates.get(testBookmarks[0][0])).toBeDefined()
    expect(originalStates.get(testBookmarks[0][0])!.deletedMeta).toBeDefined()
    expect(
      originalStates.get(testBookmarks[0][0])!.deletedMeta!.actionType
    ).toEqual('LAST_TAG_REMOVED')

    command.undo()

    // Verify tags and deletedMeta are restored
    expect(testBookmarks[0][1].tags).toEqual([
      'tagA',
      DELETED_BOOKMARK_TAG,
      'tagB',
    ])
    expect(testBookmarks[0][1].deletedMeta).toBeDefined()
    expect(testBookmarks[0][1].deletedMeta?.actionType).toBe('LAST_TAG_REMOVED')
    expect(testBookmarks[0][1].deletedMeta?.deleted).toBe(initialDeletedTime)
    expect((testBookmarks[0][1] as any)._deletedMeta).toBeUndefined()
  })

  it('should correctly handle removing DELETED_BOOKMARK_TAG when it is the only tag and deletedMeta exists', () => {
    // This test verifies the behavior when removing DELETED_BOOKMARK_TAG results in an empty tag list,
    // and the bookmark already has deletedMeta. This triggers the 'else' branch in RemoveTagCommand.execute().
    const initialDeletedTime = Date.now() - 7000
    const originalActionType = 'SOME_PREVIOUS_DELETE_ACTION'
    testBookmarks[0][1].tags = [DELETED_BOOKMARK_TAG]
    testBookmarks[0][1].deletedMeta = {
      deleted: initialDeletedTime,
      // @ts-expect-error - This is for testing purposes
      actionType: originalActionType,
    }

    const command = new RemoveTagCommand(
      [testBookmarks[0]],
      DELETED_BOOKMARK_TAG,
      // @ts-expect-error - This is for testing purposes
      'EXPLICIT_UNDELETE_ATTEMPT' // This actionType would be used if new deletedMeta was created
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    // Based on the updated RemoveTagCommand logic (as of the last review):
    // 1. Removing DELETED_BOOKMARK_TAG makes newTags empty.
    // 2. The 'else' block in execute() runs.
    // 3. DELETED_BOOKMARK_TAG is added back to bookmark[1].tags.
    // 4. Crucially, the condition `if (isRemoveDeletedBookmarkTag && bookmark[1].deletedMeta)` is true.
    //    This means the existing `deletedMeta` (with `originalActionType`) is *kept*, and no new `deletedMeta` is created.
    //    The console.log confirms this branch is taken.
    // 5. `_deletedMeta` is NOT set in this path because the `if (newTags.length > 0)` branch (where `_deletedMeta` is set) is skipped.
    expect(testBookmarks[0][1].tags).toEqual([DELETED_BOOKMARK_TAG])
    expect(testBookmarks[0][1].deletedMeta).toBeDefined()
    // The original deletedMeta should be preserved
    expect(testBookmarks[0][1].deletedMeta?.actionType).toBe(originalActionType)
    expect(testBookmarks[0][1].deletedMeta?.deleted).toBe(initialDeletedTime)
    expect((testBookmarks[0][1] as any)._deletedMeta).toBeUndefined()

    expect(originalStates.size).toBe(1)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      DELETED_BOOKMARK_TAG,
    ])

    command.undo()

    // Undo should restore the original tags and the original deletedMeta state.
    // 1. `bookmark[1].tags` is restored to `[DELETED_BOOKMARK_TAG]` from `affected`.
    // 2. The `deletedMeta` handling in `undo` runs:
    //    - First `if` condition: `!bookmark[1].deletedMeta` (false, it's defined) -> skipped.
    //    - Second `else if` condition: `bookmark[1].deletedMeta` (true) `&& !originalTags.includes(DELETED_BOOKMARK_TAG)` (false, originalTags is `[DELETED_BOOKMARK_TAG]`) -> skipped.
    //    - The `else` block is reached, meaning no changes to `deletedMeta` are made by the undo logic itself in this specific path.
    // This is correct because the `execute` method preserved the original `deletedMeta`.
    expect(testBookmarks[0][1].tags).toEqual([DELETED_BOOKMARK_TAG])
    expect(testBookmarks[0][1].deletedMeta).toBeDefined()
    expect(testBookmarks[0][1].deletedMeta?.actionType).toBe(originalActionType)
    expect(testBookmarks[0][1].deletedMeta?.deleted).toBe(initialDeletedTime)
    expect((testBookmarks[0][1] as any)._deletedMeta).toBeUndefined()
  })
})

describe('RemoveTagCommand', () => {
  // Sample bookmarks for testing
  let testBookmarks: BookmarkKeyValuePair[]

  beforeEach(() => {
    // Reset test data before each test
    testBookmarks = [
      [
        'https://example.com',
        {
          tags: ['example', 'test', 'common'],
          meta: {
            title: 'Example Website',
            created: Date.now(),
            updated: Date.now(),
          },
        },
      ],
      [
        'https://test.org',
        {
          tags: ['test', 'organization', 'common', DELETED_BOOKMARK_TAG],
          meta: {
            title: 'Test Organization (Deleted)',
            created: Date.now(),
            updated: Date.now(),
          },
          // Simulating a previously deleted bookmark
          deletedMeta: {
            deleted: Date.now() - 100_000,
            // @ts-expect-error - This is for testing purposes
            actionType: 'MANUAL_DELETE',
          },
        },
      ],
      [
        'https://another.net',
        {
          tags: [DELETED_BOOKMARK_TAG, 'unique'],
          meta: {
            title: 'Another Net (Deleted & Unique)',
            created: Date.now(),
            updated: Date.now(),
          },
          deletedMeta: {
            deleted: Date.now() - 50_000,
            actionType: 'BATCH_DELETE_BOOKMARKS',
          },
        },
      ],
      [
        'https://only-deleted.com',
        {
          tags: [DELETED_BOOKMARK_TAG],
          meta: {
            title: 'Only Deleted Tag',
            created: Date.now(),
            updated: Date.now(),
          },
          deletedMeta: {
            deleted: Date.now() - 20_000,
            actionType: 'LAST_TAG_REMOVED',
          },
        },
      ],
    ]
  })

  it('should remove DELETED_BOOKMARK_TAG and clear deletedMeta if it is the only tag being removed', () => {
    const bookmarkToTest = testBookmarks[1] // https://test.org (has DELETED_BOOKMARK_TAG and other tags)
    const initialDeletedMeta = { ...bookmarkToTest[1].deletedMeta! }

    const command = new RemoveTagCommand(
      [bookmarkToTest],
      DELETED_BOOKMARK_TAG,
      // @ts-expect-error - This is for testing purposes
      'UNDELETE' // Explicitly undeleting
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    expect(bookmarkToTest[1].tags).not.toContain(DELETED_BOOKMARK_TAG)
    expect(bookmarkToTest[1].tags).toEqual(['test', 'organization', 'common'])
    expect(bookmarkToTest[1].deletedMeta).toBeUndefined()
    expect(originalStates.get(bookmarkToTest[0])).toBeDefined()
    expect(originalStates.get(bookmarkToTest[0])!.deletedMeta).toEqual(
      initialDeletedMeta
    )

    command.undo()

    expect(bookmarkToTest[1].tags).toContain(DELETED_BOOKMARK_TAG)
    expect(bookmarkToTest[1].tags).toEqual([
      'test',
      'organization',
      'common',
      DELETED_BOOKMARK_TAG,
    ])
    expect(bookmarkToTest[1].deletedMeta).toEqual(initialDeletedMeta)
  })

  it('should remove DELETED_BOOKMARK_TAG along with other tags, and clear deletedMeta', () => {
    const bookmarkToTest = testBookmarks[1] // https://test.org
    const initialDeletedMeta = { ...bookmarkToTest[1].deletedMeta! }

    const command = new RemoveTagCommand(
      [bookmarkToTest],
      [DELETED_BOOKMARK_TAG, 'common'],
      // @ts-expect-error - This is for testing purposes
      'UNDELETE_AND_CLEANUP'
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    expect(bookmarkToTest[1].tags).not.toContain(DELETED_BOOKMARK_TAG)
    expect(bookmarkToTest[1].tags).not.toContain('common')
    expect(bookmarkToTest[1].tags).toEqual(['test', 'organization'])
    expect(bookmarkToTest[1].deletedMeta).toBeUndefined()
    expect(originalStates.get(bookmarkToTest[0])).toBeDefined()
    expect(originalStates.get(bookmarkToTest[0])!.deletedMeta).toEqual(
      initialDeletedMeta
    )

    command.undo()

    expect(bookmarkToTest[1].tags).toContain(DELETED_BOOKMARK_TAG)
    expect(bookmarkToTest[1].tags).toContain('common')
    expect(bookmarkToTest[1].tags).toEqual([
      'test',
      'organization',
      'common',
      DELETED_BOOKMARK_TAG,
    ])
    expect(bookmarkToTest[1].deletedMeta).toEqual(initialDeletedMeta)
  })

  it('should NOT remove DELETED_BOOKMARK_TAG if other tags are removed but DELETED_BOOKMARK_TAG is not specified for removal', () => {
    const bookmarkToTest = testBookmarks[1] // https://test.org
    const initialDeletedMeta = { ...bookmarkToTest[1].deletedMeta! }

    const command = new RemoveTagCommand(
      [bookmarkToTest],
      ['common', 'test'] // DELETED_BOOKMARK_TAG is not in this list
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    expect(bookmarkToTest[1].tags).toContain(DELETED_BOOKMARK_TAG) // Should still be there
    expect(bookmarkToTest[1].tags).not.toContain('common')
    expect(bookmarkToTest[1].tags).not.toContain('test')
    expect(bookmarkToTest[1].tags).toEqual([
      'organization',
      DELETED_BOOKMARK_TAG,
    ])
    expect(bookmarkToTest[1].deletedMeta).toEqual(initialDeletedMeta) // Should be unchanged

    command.undo()

    expect(bookmarkToTest[1].tags).toContain(DELETED_BOOKMARK_TAG)
    expect(bookmarkToTest[1].tags).toContain('common')
    expect(bookmarkToTest[1].tags).toContain('test')
    expect(bookmarkToTest[1].tags).toEqual([
      'test',
      'organization',
      'common',
      DELETED_BOOKMARK_TAG,
    ])
    expect(bookmarkToTest[1].deletedMeta).toEqual(initialDeletedMeta)
  })

  it('should preserve deletedMeta if DELETED_BOOKMARK_TAG is removed but other tags cause it to remain deleted (edge case, depends on strict sourceTags match)', () => {
    const bookmarkToTest = testBookmarks[2] // Has [DELETED_BOOKMARK_TAG, 'unique']
    const initialDeletedMeta = { ...bookmarkToTest[1].deletedMeta! }

    const command = new RemoveTagCommand(
      [bookmarkToTest],
      [DELETED_BOOKMARK_TAG, 'foo']
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(0)
    expect(executionResult!.deletedCount).toBe(0)

    expect(originalStates.size).toBe(0) // No bookmarks should be affected
    expect(bookmarkToTest[1].tags).toEqual([DELETED_BOOKMARK_TAG, 'unique'])
    expect(bookmarkToTest[1].deletedMeta).toEqual(initialDeletedMeta)

    command.undo()
    expect(bookmarkToTest[1].tags).toEqual([DELETED_BOOKMARK_TAG, 'unique'])
    expect(bookmarkToTest[1].deletedMeta).toEqual(initialDeletedMeta)
  })

  it('should correctly remove DELETED_BOOKMARK_TAG when it is the only tag on a bookmark, effectively undeleting it', () => {
    const bookmarkToTest = testBookmarks[3] // https://only-deleted.com, tags: [DELETED_BOOKMARK_TAG]
    const initialDeletedMeta = { ...bookmarkToTest[1].deletedMeta! }

    const command = new RemoveTagCommand(
      [bookmarkToTest],
      DELETED_BOOKMARK_TAG,
      // @ts-expect-error - This is for testing purposes
      'UNDELETE_SINGLE'
    )
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    expect(bookmarkToTest[1].tags).toEqual([DELETED_BOOKMARK_TAG]) // All tags removed except DELETED_BOOKMARK_TAG
    expect(bookmarkToTest[1].deletedMeta).toEqual(initialDeletedMeta)
    // Check _deletedMeta backup
    // @ts-expect-error eslint/no-unsafe-assignment
    expect(bookmarkToTest[1]?._deletedMeta).toBeUndefined()

    command.undo()

    expect(bookmarkToTest[1].tags).toEqual([DELETED_BOOKMARK_TAG])
    expect(bookmarkToTest[1].deletedMeta).toEqual(initialDeletedMeta)
  })

  it('should add DELETED_BOOKMARK_TAG if all other specified tags are removed and no other tags remain', () => {
    const bookmark = [
      'https://example.com/toBeDeleted',
      {
        tags: ['tag1', 'tag2'],
        meta: {
          title: 'To Be Deleted',
          created: Date.now(),
          updated: Date.now(),
        },
      },
    ] as BookmarkKeyValuePair
    testBookmarks.push(bookmark)

    const command = new RemoveTagCommand(
      [bookmark],
      ['tag1', 'tag2'],
      // @ts-expect-error - This is for testing purposes
      'ALL_SPECIFIED_REMOVED'
    )
    const deletionTimestamp = Date.now()
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(1)

    expect(bookmark[1].tags).toEqual(['tag1', 'tag2', DELETED_BOOKMARK_TAG]) // Should keep original tags
    expect(bookmark[1].deletedMeta).toBeDefined()
    expect(bookmark[1].deletedMeta?.actionType).toBe('ALL_SPECIFIED_REMOVED')
    expect(bookmark[1].deletedMeta?.deleted).toBeGreaterThanOrEqual(
      deletionTimestamp
    )
    expect(originalStates.get(bookmark[0])!.tags).toEqual(['tag1', 'tag2'])

    command.undo()

    expect(bookmark[1].tags).toEqual(['tag1', 'tag2'])
    expect(bookmark[1].deletedMeta).toBeUndefined()
  })

  it('should add DELETED_BOOKMARK_TAG with default actionType if all tags removed and no actionType provided', () => {
    const bookmark = [
      'https://example.com/toBeDeletedImplicitly',
      {
        tags: ['sole-tag'],
        meta: {
          title: 'To Be Deleted Implicitly',
          created: Date.now(),
          updated: Date.now(),
        },
      },
    ] as BookmarkKeyValuePair
    testBookmarks.push(bookmark)

    const command = new RemoveTagCommand([bookmark], 'sole-tag') // No actionType
    const deletionTimestamp = Date.now()
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(1)

    expect(bookmark[1].tags).toEqual(['sole-tag', DELETED_BOOKMARK_TAG]) // Should keep original tags
    expect(bookmark[1].deletedMeta).toBeDefined()
    expect(bookmark[1].deletedMeta?.actionType).toBe('BATCH_REMOVE_TAGS') // Default actionType
    expect(bookmark[1].deletedMeta?.deleted).toBeGreaterThanOrEqual(
      deletionTimestamp
    )
    expect(originalStates.get(bookmark[0])!.tags).toEqual(['sole-tag'])

    command.undo()
    expect(bookmark[1].tags).toEqual(['sole-tag'])
    expect(bookmark[1].deletedMeta).toBeUndefined()
  })
})

describe('RenameTagCommand', () => {
  // Sample bookmarks for testing
  let testBookmarks: BookmarkKeyValuePair[]

  beforeEach(() => {
    // Reset test data before each test
    testBookmarks = [
      [
        'https://example.com',
        {
          tags: ['example', 'test', 'common'],
          meta: {
            title: 'Example Website',
            created: Date.now(),
            updated: Date.now(),
          },
        },
      ],
      [
        'https://test.org',
        {
          tags: ['test', 'organization', 'common'],
          meta: {
            title: 'Test Organization',
            created: Date.now(),
            updated: Date.now(),
          },
        },
      ],
      [
        'https://other.net',
        {
          tags: ['other', 'network'],
          meta: {
            title: 'Other Network',
            created: Date.now(),
            updated: Date.now(),
          },
        },
      ],
    ]
  })

  it('should rename a tag in bookmarks that have it', () => {
    // Create command
    const command = new RenameTagCommand(testBookmarks, 'test', 'testing')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were renamed
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).toContain('testing')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'common', 'testing'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).toContain('testing')
    expect(testBookmarks[1][1].tags).toEqual([
      'organization',
      'common',
      'testing',
    ])
    expect(testBookmarks[2][1].tags).not.toContain('testing')
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
      'common',
    ])
    expect(originalStates.has('https://other.net')).toBe(false)

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('testing')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('testing')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])
  })

  it('should not affect bookmarks that do not have the source tag', () => {
    // Create command
    const command = new RenameTagCommand(testBookmarks, 'other', 'alternative')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify only third bookmark was affected
    expect(testBookmarks[0][1].tags).not.toContain('other')
    expect(testBookmarks[0][1].tags).not.toContain('alternative')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).not.toContain('other')
    expect(testBookmarks[1][1].tags).not.toContain('alternative')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).not.toContain('other')
    expect(testBookmarks[2][1].tags).toContain('alternative')
    expect(testBookmarks[2][1].tags).toEqual(['network', 'alternative'])

    // Verify affected map only contains the third bookmark
    expect(originalStates.size).toBe(1)
    expect(originalStates.has('https://example.com')).toBe(false)
    expect(originalStates.has('https://test.org')).toBe(false)
    expect(originalStates.get('https://other.net')!.tags).toEqual([
      'other',
      'network',
    ])

    // Undo command
    command.undo()

    // Verify only third bookmark was restored
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toContain('other')
    expect(testBookmarks[2][1].tags).not.toContain('alternative')
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])
  })

  it('should handle empty bookmarks array', () => {
    // Create command with empty bookmarks array
    const command = new RenameTagCommand([], 'test', 'testing')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(0)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify no errors and empty affected map
    expect(originalStates.size).toBe(0)

    // Undo command (should not throw errors)
    expect(() => {
      command.undo()
    }).not.toThrow()
  })

  it('should handle renaming a tag that does not exist in any bookmark', () => {
    // Create command with non-existent tag
    const command = new RenameTagCommand(
      testBookmarks,
      'non-existent-tag',
      'new-tag'
    )

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(0)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify no bookmarks were affected
    expect(originalStates.size).toBe(0)
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])

    // Undo command (should not change anything)
    command.undo()

    // Verify bookmarks remain unchanged
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])
  })

  it('should handle renaming to a tag that already exists', () => {
    // Create command to rename 'test' to 'common' (which already exists)
    const command = new RenameTagCommand(testBookmarks, 'test', 'common')

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were renamed (but no duplicates created)
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).toContain('common')
    expect(
      testBookmarks[0][1].tags.filter((tag) => tag === 'common').length
    ).toBe(1) // No duplicates
    expect(testBookmarks[0][1].tags).toEqual(['example', 'common'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).toContain('common')
    expect(
      testBookmarks[1][1].tags.filter((tag) => tag === 'common').length
    ).toBe(1) // No duplicates
    expect(testBookmarks[1][1].tags).toEqual(['organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
      'common',
    ])

    // Undo command
    command.undo()

    // Verify tags were restored
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])
  })

  it('should return correct command type', () => {
    const command = new RenameTagCommand(testBookmarks, 'test', 'testing')
    expect(command.getType()).toBe('rename')
  })

  it('should return correct source tag', () => {
    const command = new RenameTagCommand(testBookmarks, 'test', 'testing')
    expect(command.getSourceTags()).toEqual(['test'])
  })

  it('should return correct target tag', () => {
    const command = new RenameTagCommand(testBookmarks, 'test', 'testing')
    expect(command.getTargetTags()).toEqual(['testing'])
  })

  it('should rename multiple tags to multiple new tags', () => {
    // Create command with multiple source and target tags
    const command = new RenameTagCommand(
      testBookmarks,
      ['test', 'common'],
      ['testing', 'shared']
    )

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were renamed
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).toContain('testing')
    expect(testBookmarks[0][1].tags).toContain('shared')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'testing', 'shared'])

    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('common')
    expect(testBookmarks[1][1].tags).toContain('testing')
    expect(testBookmarks[1][1].tags).toContain('shared')
    expect(testBookmarks[1][1].tags).toEqual([
      'organization',
      'testing',
      'shared',
    ])

    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(originalStates.get('https://test.org')!.tags).toEqual([
      'test',
      'organization',
      'common',
    ])
    expect(originalStates.has('https://other.net')).toBe(false)

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).toContain('common')
    expect(testBookmarks[0][1].tags).not.toContain('testing')
    expect(testBookmarks[0][1].tags).not.toContain('shared')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])

    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).toContain('common')
    expect(testBookmarks[1][1].tags).not.toContain('testing')
    expect(testBookmarks[1][1].tags).not.toContain('shared')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])

    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])
  })

  it('should only rename tags if bookmark contains ALL specified source tags', () => {
    // Create command with multiple source tags where only some bookmarks have all tags
    const command = new RenameTagCommand(
      testBookmarks,
      ['test', 'example'],
      ['testing', 'sample']
    )

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify only first bookmark was affected (has both 'test' and 'example')
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('example')
    expect(testBookmarks[0][1].tags).toContain('testing')
    expect(testBookmarks[0][1].tags).toContain('sample')
    expect(testBookmarks[0][1].tags).toEqual(['common', 'testing', 'sample'])

    // Second bookmark should be unchanged (has 'test' but not 'example')
    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('testing')
    expect(testBookmarks[1][1].tags).not.toContain('sample')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])

    // Third bookmark should be unchanged
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])

    // Verify affected map only contains the first bookmark
    expect(originalStates.size).toBe(1)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(originalStates.has('https://test.org')).toBe(false)
    expect(originalStates.has('https://other.net')).toBe(false)

    // Undo command
    command.undo()

    // Verify only first bookmark was restored
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).toContain('example')
    expect(testBookmarks[0][1].tags).not.toContain('testing')
    expect(testBookmarks[0][1].tags).not.toContain('sample')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])

    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])
  })

  it('should handle string input with multiple tags', () => {
    // Create command with comma-separated strings of tags
    const command = new RenameTagCommand(
      testBookmarks,
      'test,common',
      'testing,shared'
    )

    expect(command.getSourceTags()).toEqual(['test', 'common'])
    expect(command.getTargetTags()).toEqual(['testing', 'shared'])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were renamed
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).toContain('testing')
    expect(testBookmarks[0][1].tags).toContain('shared')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'testing', 'shared'])

    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('common')
    expect(testBookmarks[1][1].tags).toContain('testing')
    expect(testBookmarks[1][1].tags).toContain('shared')
    expect(testBookmarks[1][1].tags).toEqual([
      'organization',
      'testing',
      'shared',
    ])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).toContain('common')
    expect(testBookmarks[0][1].tags).not.toContain('testing')
    expect(testBookmarks[0][1].tags).not.toContain('shared')

    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).toContain('common')
    expect(testBookmarks[1][1].tags).not.toContain('testing')
    expect(testBookmarks[1][1].tags).not.toContain('shared')
  })

  it('should handle duplicate tags in the input arrays', () => {
    // Create command with duplicate tags
    const command = new RenameTagCommand(
      testBookmarks,
      ['test', 'test', 'common'],
      ['testing', 'testing', 'shared']
    )

    expect(command.getSourceTags()).toEqual(['test', 'common'])
    expect(command.getTargetTags()).toEqual(['testing', 'shared'])

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(2)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify tags were renamed without issues
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).toContain('testing')
    expect(testBookmarks[0][1].tags).toContain('shared')
    expect(
      testBookmarks[0][1].tags.filter((tag) => tag === 'testing').length
    ).toBe(1) // No duplicates
    expect(testBookmarks[0][1].tags).toEqual(['example', 'testing', 'shared'])

    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('common')
    expect(testBookmarks[1][1].tags).toContain('testing')
    expect(testBookmarks[1][1].tags).toContain('shared')
    expect(
      testBookmarks[1][1].tags.filter((tag) => tag === 'testing').length
    ).toBe(1) // No duplicates
    expect(testBookmarks[1][1].tags).toEqual([
      'organization',
      'testing',
      'shared',
    ])

    // Verify affected map contains original tags
    expect(originalStates.size).toBe(2)

    // Undo command
    command.undo()

    // Verify tags were restored after undo
    expect(testBookmarks[0][1].tags).toContain('test')
    expect(testBookmarks[0][1].tags).toContain('common')
    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).toContain('common')
  })

  it('should handle mix of existing and non-existing source tags', () => {
    // Create command with mix of existing and non-existing tags
    const command = new RenameTagCommand(
      testBookmarks,
      ['test', 'non-existent-tag'],
      ['testing', 'new-tag']
    )

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(0)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify no bookmarks were affected (since not all source tags exist in any bookmark)
    expect(originalStates.size).toBe(0)
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])

    // Undo command (should not change anything)
    command.undo()

    // Verify bookmarks remain unchanged
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])
  })

  it('should correctly report source and target tags for multiple tags', () => {
    // Create command with multiple tags
    const command = new RenameTagCommand(
      testBookmarks,
      ['tag-a', 'tag-b', 'tag-c'],
      ['new-a', 'new-b', 'new-c']
    )

    // Verify source and target tags are correctly reported
    expect(command.getSourceTags()).toEqual(['tag-a', 'tag-b', 'tag-c'])
    expect(command.getTargetTags()).toEqual(['new-a', 'new-b', 'new-c'])
    expect(command.getSourceTags()).not.toBe(command.getSourceTags()) // Should return a copy
    expect(command.getTargetTags()).not.toBe(command.getTargetTags()) // Should return a copy
  })

  it('should handle different number of source and target tags', () => {
    // Create command with more source tags than target tags
    const command = new RenameTagCommand(
      testBookmarks,
      ['test', 'common', 'example'],
      ['testing', 'shared']
    )

    // Execute command
    command.execute()
    const executionResult = command.getExecutionResult()
    expect(executionResult).toBeDefined()
    const originalStates = executionResult!.originalStates
    expect(originalStates).toBeDefined()

    expect(executionResult!.affectedCount).toBe(1)
    expect(executionResult!.deletedCount).toBe(0)

    // Verify only first bookmark was affected (has all source tags)
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).not.toContain('example')
    expect(testBookmarks[0][1].tags).toContain('testing')
    expect(testBookmarks[0][1].tags).toContain('shared')
    expect(testBookmarks[0][1].tags).toEqual(['testing', 'shared'])

    // Second bookmark should be unchanged (doesn't have 'example')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])

    // Verify affected map only contains the first bookmark
    expect(originalStates.size).toBe(1)
    expect(originalStates.get('https://example.com')!.tags).toEqual([
      'example',
      'test',
      'common',
    ])

    // Undo command
    command.undo()

    // Verify first bookmark was restored
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
  })
})
