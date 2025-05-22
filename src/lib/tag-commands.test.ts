import { describe, it, expect, beforeEach } from 'vitest'
import type { BookmarkKeyValuePair } from '../types/bookmarks.js'
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
    const affected = command.execute()

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
    expect(affected.size).toBe(2)
    expect(affected.get('https://example.com')).toEqual(['example', 'test'])
    expect(affected.get('https://test.org')).toEqual(['test', 'organization'])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(1)
    expect(affected.has('https://example.com')).toBe(false)
    expect(affected.get('https://test.org')).toEqual(['test', 'organization'])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify no errors and empty affected map
    expect(affected.size).toBe(0)

    // Undo command (should not throw errors)
    expect(() => {
      command.undo(affected)
    }).not.toThrow()
  })

  it('should undo tag addition correctly', () => {
    // Create command
    const command = new AddTagCommand(testBookmarks, 'new-tag')

    // Execute command
    const affected = command.execute()

    // Verify tags were added
    expect(testBookmarks[0][1].tags).toContain('new-tag')
    expect(testBookmarks[1][1].tags).toContain('new-tag')

    // Undo command
    command.undo(affected)

    // Verify tags were removed
    expect(testBookmarks[0][1].tags).not.toContain('new-tag')
    expect(testBookmarks[1][1].tags).not.toContain('new-tag')

    // Verify original tags are preserved
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test'])
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
    const affected = command.execute()

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
    expect(affected.size).toBe(2)
    expect(affected.get('https://example.com')).toEqual(['example', 'test'])
    expect(affected.get('https://test.org')).toEqual(['test', 'organization'])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(2)
    expect(affected.get('https://example.com')).toEqual([
      'example',
      'test',
      'existing-tag-1',
    ])
    expect(affected.get('https://test.org')).toEqual(['test', 'organization'])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(2)
    expect(affected.get('https://example.com')).toEqual(['example', 'test'])
    expect(affected.get('https://test.org')).toEqual(['test', 'organization'])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(2)

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify tags were removed
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'common'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).toEqual(['organization', 'common'])

    // Verify affected map contains original tags
    expect(affected.size).toBe(2)
    expect(affected.get('https://example.com')).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(affected.get('https://test.org')).toEqual([
      'test',
      'organization',
      'common',
    ])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify only second bookmark was affected
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).toEqual(['example', 'common'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).toEqual(['organization', 'common'])

    // Verify affected map only contains the second bookmark
    expect(affected.size).toBe(1)
    expect(affected.has('https://example.com')).toBe(false)
    expect(affected.get('https://test.org')).toEqual([
      'test',
      'organization',
      'common',
    ])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify no errors and empty affected map
    expect(affected.size).toBe(0)

    // Undo command (should not throw errors)
    expect(() => {
      command.undo(affected)
    }).not.toThrow()
  })

  it('should handle removing a tag that does not exist in any bookmark', () => {
    // Create command with non-existent tag
    const command = new RemoveTagCommand(testBookmarks, 'non-existent-tag')

    // Execute command
    const affected = command.execute()

    // Verify no bookmarks were affected
    expect(affected.size).toBe(0)
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])

    // Undo command (should not change anything)
    command.undo(affected)

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
    const affected = command.execute()

    // Verify tags were removed
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).toEqual(['example'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('common')
    expect(testBookmarks[1][1].tags).toEqual(['organization'])

    // Verify affected map contains original tags
    expect(affected.size).toBe(2)
    expect(affected.get('https://example.com')).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(affected.get('https://test.org')).toEqual([
      'test',
      'organization',
      'common',
    ])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify only first bookmark was affected (has both 'test' and 'example')
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('example')
    expect(testBookmarks[0][1].tags).toEqual(['common'])

    // Second bookmark should be unchanged (has 'test' but not 'example')
    expect(testBookmarks[1][1].tags).toContain('test')
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])

    // Verify affected map only contains the first bookmark
    expect(affected.size).toBe(1)
    expect(affected.get('https://example.com')).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(affected.has('https://test.org')).toBe(false)

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify tags were removed
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).toEqual(['example'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('common')
    expect(testBookmarks[1][1].tags).toEqual(['organization'])

    // Verify affected map contains original tags
    expect(affected.size).toBe(2)

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify tags were removed without issues
    expect(testBookmarks[0][1].tags).not.toContain('test')
    expect(testBookmarks[0][1].tags).not.toContain('common')
    expect(testBookmarks[0][1].tags).toEqual(['example'])
    expect(testBookmarks[1][1].tags).not.toContain('test')
    expect(testBookmarks[1][1].tags).not.toContain('common')
    expect(testBookmarks[1][1].tags).toEqual(['organization'])

    // Verify affected map contains original tags
    expect(affected.size).toBe(2)

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify no bookmarks were affected (since not all tags exist in any bookmark)
    expect(affected.size).toBe(0)
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])

    // Undo command (should not change anything)
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(2)
    expect(affected.get('https://example.com')).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(affected.get('https://test.org')).toEqual([
      'test',
      'organization',
      'common',
    ])
    expect(affected.has('https://other.net')).toBe(false)

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(1)
    expect(affected.has('https://example.com')).toBe(false)
    expect(affected.has('https://test.org')).toBe(false)
    expect(affected.get('https://other.net')).toEqual(['other', 'network'])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify no errors and empty affected map
    expect(affected.size).toBe(0)

    // Undo command (should not throw errors)
    expect(() => {
      command.undo(affected)
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
    const affected = command.execute()

    // Verify no bookmarks were affected
    expect(affected.size).toBe(0)
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])

    // Undo command (should not change anything)
    command.undo(affected)

    // Verify bookmarks remain unchanged
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])
  })

  it('should handle renaming to a tag that already exists', () => {
    // Create command to rename 'test' to 'common' (which already exists)
    const command = new RenameTagCommand(testBookmarks, 'test', 'common')

    // Execute command
    const affected = command.execute()

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
    expect(affected.size).toBe(2)
    expect(affected.get('https://example.com')).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(affected.get('https://test.org')).toEqual([
      'test',
      'organization',
      'common',
    ])

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(2)
    expect(affected.get('https://example.com')).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(affected.get('https://test.org')).toEqual([
      'test',
      'organization',
      'common',
    ])
    expect(affected.has('https://other.net')).toBe(false)

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(1)
    expect(affected.get('https://example.com')).toEqual([
      'example',
      'test',
      'common',
    ])
    expect(affected.has('https://test.org')).toBe(false)
    expect(affected.has('https://other.net')).toBe(false)

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(2)

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(2)

    // Undo command
    command.undo(affected)

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
    const affected = command.execute()

    // Verify no bookmarks were affected (since not all source tags exist in any bookmark)
    expect(affected.size).toBe(0)
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
    expect(testBookmarks[1][1].tags).toEqual(['test', 'organization', 'common'])
    expect(testBookmarks[2][1].tags).toEqual(['other', 'network'])

    // Undo command (should not change anything)
    command.undo(affected)

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
    const affected = command.execute()

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
    expect(affected.size).toBe(1)
    expect(affected.get('https://example.com')).toEqual([
      'example',
      'test',
      'common',
    ])

    // Undo command
    command.undo(affected)

    // Verify first bookmark was restored
    expect(testBookmarks[0][1].tags).toEqual(['example', 'test', 'common'])
  })
})
