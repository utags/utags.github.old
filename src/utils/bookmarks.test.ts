import { describe, it, expect } from 'vitest'
import type { BookmarkKeyValuePair } from '../types/bookmarks.js'
import {
  getTagCounts,
  getDomainCounts,
  normalizeHierachyPath,
  getHierachyTags,
} from './bookmarks.js'

const testMeta = {
  created: 0,
  updated: 0,
}

describe('getTagCounts', () => {
  it('should handle empty input', () => {
    const result = getTagCounts([])
    expect(result.size).toBe(0)
  })

  it('should count tags for single bookmark', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['tag1', 'tag2'], meta: testMeta }],
    ]
    const result = getTagCounts(bookmarks)
    expect(result.get('tag1')).toBe(1)
    expect(result.get('tag2')).toBe(1)
  })

  it('should count duplicate tags', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['tag1', 'tag1'], meta: testMeta }],
    ]
    const result = getTagCounts(bookmarks)
    expect(result.get('tag1')).toBe(2)
  })

  it('should handle tags from multiple bookmarks', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['tag1', 'tag2'], meta: testMeta }],
      ['url2', { tags: ['tag2', 'tag3'], meta: testMeta }],
    ]
    const result = getTagCounts(bookmarks)
    expect(result.get('tag1')).toBe(1)
    expect(result.get('tag2')).toBe(2)
    expect(result.get('tag3')).toBe(1)
  })

  it('should handle empty tags array', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: [], meta: testMeta }],
    ]
    const result = getTagCounts(bookmarks)
    expect(result.size).toBe(0)
  })

  it('should handle tags with slashes', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['parent/child'], meta: testMeta }],
    ]
    const result = getTagCounts(bookmarks)
    expect(result.get('parent/child')).toBe(1)
  })

  it('should handle tags with spaces', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: [' tag with spaces '], meta: testMeta }],
    ]
    const result = getTagCounts(bookmarks)
    expect(result.get(' tag with spaces ')).toBe(1)
  })

  it('should handle tags with special characters', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['tag-with-special-!@#$%^&*()'], meta: testMeta }],
    ]
    const result = getTagCounts(bookmarks)
    expect(result.get('tag-with-special-!@#$%^&*()')).toBe(1)
  })
})

describe('getDomainCounts', () => {
  it('should return empty map for empty input', () => {
    const result = getDomainCounts([])
    expect(result.size).toBe(0)
  })

  it('should count domains for single bookmark', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['https://example.com', { tags: [], meta: testMeta }],
    ]
    const result = getDomainCounts(bookmarks)
    expect(result.get('example.com')).toBe(1)
  })

  it('should count multiple bookmarks from same domain', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['https://example.com/page1', { tags: [], meta: testMeta }],
      ['https://example.com/page2', { tags: [], meta: testMeta }],
    ]
    const result = getDomainCounts(bookmarks)
    expect(result.get('example.com')).toBe(2)
  })

  it('should handle different domains', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['https://example.com', { tags: [], meta: testMeta }],
      ['https://test.org', { tags: [], meta: testMeta }],
    ]
    const result = getDomainCounts(bookmarks)
    expect(result.get('example.com')).toBe(1)
    expect(result.get('test.org')).toBe(1)
  })

  it('should handle URLs with subdomains', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['https://sub.example.com', { tags: [], meta: testMeta }],
    ]
    const result = getDomainCounts(bookmarks)
    expect(result.get('sub.example.com')).toBe(1)
  })

  it('should handle URLs with ports', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['https://example.com:8080', { tags: [], meta: testMeta }],
    ]
    const result = getDomainCounts(bookmarks)
    expect(result.get('example.com')).toBe(1)
  })

  it('should handle invalid URLs', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['invalid-url', { tags: [], meta: testMeta }],
    ]
    const result = getDomainCounts(bookmarks)
    expect(result.get('')).toBe(1)
  })
})

describe('normalizeHierachyPath', () => {
  it('should remove leading slashes', () => {
    expect(normalizeHierachyPath('/test/path')).toBe('test/path')
    expect(normalizeHierachyPath('////test/path')).toBe('test/path')
    expect(normalizeHierachyPath('/// / test/path')).toBe('test/path')
    expect(normalizeHierachyPath(' / / / /test/path')).toBe('test/path')
  })

  it('should preserve trailing slashes', () => {
    expect(normalizeHierachyPath('test/path/')).toBe('test/path/')
    expect(normalizeHierachyPath('test/path////')).toBe('test/path////')
  })

  it('should normalize spaces around slashes', () => {
    expect(normalizeHierachyPath('test / path')).toBe('test/path')
    expect(normalizeHierachyPath('test   /   path')).toBe('test/path')
  })

  it('should trim whitespace from path segments', () => {
    expect(normalizeHierachyPath(' test / path ')).toBe('test/path')
    expect(normalizeHierachyPath('  test  /  path  ')).toBe('test/path')
  })

  it('should handle empty path segments', () => {
    expect(normalizeHierachyPath('test//path')).toBe('test//path')
    expect(normalizeHierachyPath('test///path')).toBe('test///path')
  })

  it('should handle paths with special characters', () => {
    expect(normalizeHierachyPath('test@name/path#1')).toBe('test@name/path#1')
    expect(normalizeHierachyPath('test.name/path-1')).toBe('test.name/path-1')
  })

  it('should handle Chinese characters in paths', () => {
    expect(normalizeHierachyPath('测试/路径')).toBe('测试/路径')
    expect(normalizeHierachyPath(' 测试 / 路径 ')).toBe('测试/路径')
  })

  it('should handle mixed cases', () => {
    expect(normalizeHierachyPath(' / test / path / ')).toBe('test/path/')
    expect(normalizeHierachyPath('  //  test  /  path  //  ')).toBe(
      'test/path//'
    )
  })
})

describe('getHierachyTags', () => {
  const testMeta = { created: 0, updated: 0 }

  it('should return empty array for empty input', () => {
    const result = getHierachyTags([])
    expect(result).toEqual([])
  })

  it('should build hierarchy from flat tags', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['parent/child'], meta: testMeta }],
      ['url2', { tags: ['parent/child2'], meta: testMeta }],
    ]
    const result = getHierachyTags(bookmarks)
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('parent')
    expect(result[0].children.length).toBe(2)
  })

  it('should handle multiple levels of nesting', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['grandparent/parent/child'], meta: testMeta }],
    ]
    const result = getHierachyTags(bookmarks)
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('grandparent')
    expect(result[0].children[0].name).toBe('parent')
    expect(result[0].children[0].children[0].name).toBe('child')
  })

  it('should merge duplicate paths', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['parent/child'], meta: testMeta }],
      ['url2', { tags: ['parent/child'], meta: testMeta }],
    ]
    const result = getHierachyTags(bookmarks)
    expect(result.length).toBe(1)
    expect(result[0].children.length).toBe(1)
    expect(result[0].children[0].count).toBe(2)
  })

  it('should handle tags with leading/trailing spaces', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: [' parent / child '], meta: testMeta }],
    ]
    const result = getHierachyTags(bookmarks)
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('parent')
    expect(result[0].children[0].name).toBe('child')
  })

  it('should sort tags alphabetically', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['b/a'], meta: testMeta }],
      ['url2', { tags: ['a/b'], meta: testMeta }],
    ]
    const result = getHierachyTags(bookmarks)
    expect(result[0].name).toBe('a')
    expect(result[1].name).toBe('b')
  })

  it('should ignore tags without slashes', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['simple'], meta: testMeta }],
    ]
    const result = getHierachyTags(bookmarks)
    expect(result.length).toBe(0)
  })

  it('should handle Chinese characters in tags', () => {
    const bookmarks: BookmarkKeyValuePair[] = [
      ['url1', { tags: ['父级/子级'], meta: testMeta }],
    ]
    const result = getHierachyTags(bookmarks)
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('父级')
    expect(result[0].children[0].name).toBe('子级')
  })
})
