import type { BookmarkMetadata } from '../../types/bookmarks.js'
import { settings } from '../../stores/stores.js'

/**
 * Creates a read-later filter condition
 * @param params - URL search parameters
 * @returns Filter condition function or undefined if not a read-later filter
 */
export function createReadLaterCondition(params: URLSearchParams) {
  if (params.get('filter') !== 'read-later') return undefined

  // 获取用户配置的稍后阅读标签
  const readLaterTags = /* $settings.readLaterTags || */ new Set([
    'read-later',
    '稍后阅读',
    'toread',
  ])

  return (href: string, tags: string[], meta: BookmarkMetadata) => {
    // 检查书签是否有匹配的标签
    return tags.some((tag) => readLaterTags.has(tag))
  }
}
