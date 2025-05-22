import type {
  BookmarkKeyValuePair,
  TagHierarchyItem,
} from '../types/bookmarks.js'
import { getHostName } from './url-utils.js'

export function getTagCounts(
  bookmarkEntries: BookmarkKeyValuePair[]
): Map<string, number> {
  return new Map(
    bookmarkEntries
      .flatMap((entry) => entry[1].tags)
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce((acc, tag) => {
        acc.set(tag, (acc.get(tag) || 0) + 1)
        return acc
      }, new Map<string, number>())
  )
}

export function getDomainCounts(
  bookmarkEntries: BookmarkKeyValuePair[]
): Map<string, number> {
  return new Map(
    bookmarkEntries
      .map((entry) => getHostName(entry[0]))
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce((acc, domain) => {
        acc.set(domain, (acc.get(domain) || 0) + 1)
        return acc
      }, new Map<string, number>())
  )
}

export function normalizeHierachyPath(path: string) {
  // 注意：保留尾部的斜杠。因为浏览器收藏夹支持空文件夹，所以需要保留尾部的斜杠。
  return path
    .replaceAll(/^[/\s]+/g, '') // 移除开始的斜杠和空格
    .replaceAll(/\s*\/\s*/g, '/') // 移除斜杠两边的空格
    .trim() // 移除首尾的空格
}

function convertPathToQuery(path: string) {
  // 转义正则表达式特殊字符
  const escapedPath = path.slice(1).replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return `tag:/^\\/?${escapedPath.replaceAll('/', '\\s*\\/\\s*')}$/`
}

export function getHierachyTags(
  bookmarkEntries: BookmarkKeyValuePair[]
): TagHierarchyItem[] {
  // 首先获取所有标签及其计数
  const tagCounts = getTagCounts(bookmarkEntries)

  const tags = Array.from(
    new Set(
      [...tagCounts.keys()]
        .filter((tag) => tag.includes('/'))
        .map((tag) => normalizeHierachyPath(tag))
    )
  ).sort((a, b) => {
    return a.localeCompare(b, 'zh-CN', {
      sensitivity: 'base',
      ignorePunctuation: true,
      numeric: false,
    })
  })

  if (tags.length === 0) return []

  const root: TagHierarchyItem[] = []
  const pathMap = new Map<string, TagHierarchyItem>()

  for (const tag of tags) {
    const parts = tag.split('/')
    // .filter(Boolean)
    let currentPath = ''
    let parent: TagHierarchyItem | undefined

    for (const part of parts) {
      currentPath += `/${part.trim()}`
      if (!pathMap.has(currentPath)) {
        // 计算当前路径下精确匹配的书签个数，处理四种路径格式
        // 需包括 '/aaa/bbb', '/aaa/bbb/', 'aaa/bbb', 'aaa/bbb/' 四种情况
        // FIXME: 目前的统计有小问题。当一个书签有多个标签匹配相同 path 时，数量会比实际大。比如 '/aaa/bbb' 和 'aaa/bbb' 都匹配 'aaa/bbb。
        // 但除非刻意，不会添加这种标签
        const normalizedCurrentPath = normalizeHierachyPath(currentPath)
        const count = Array.from(tagCounts.entries())
          .filter(([t]) => normalizeHierachyPath(t) === normalizedCurrentPath)
          .reduce((sum, [, cnt]) => sum + cnt, 0)
        console.log('Current path:', currentPath, 'Exact match count:', count)

        const newItem = {
          name: part,
          path: currentPath,
          query: convertPathToQuery(currentPath),
          count,
          children: [],
          expanded: false,
        }

        if (parent) {
          parent.children.push(newItem)
        } else {
          root.push(newItem)
        }

        pathMap.set(currentPath, newItem)
      }

      parent = pathMap.get(currentPath)
    }
  }

  return root
}
