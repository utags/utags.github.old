import Console from 'console-tagger'
import type { BookmarkKeyValuePair } from '../types/bookmarks.js'
import { defaultFilterRegistry } from './filter-registry.js'
import { createTimeCondition } from './filters/time-filter.js'
import { createNoteCondition } from './filters/note-filter.js'
import { createReadLaterCondition } from './filters/read-later-filter.js'
import { createTagFilterCondition } from './filters/tag-filter.js'
import { createDomainFilterCondition } from './filters/domain-filter.js'
import { createQueryFilterCondition } from './filters/query-filter.js'

const console = new Console({
  prefix: 'filter-bookmarks',
  color: { line: 'black', background: 'yellow' },
})

defaultFilterRegistry
  .register('time', createTimeCondition)
  .register('has_note', createNoteCondition)
  .register('filter', createReadLaterCondition)
  .register('t', createTagFilterCondition)
  .register('d', createDomainFilterCondition)
  .register('q', createQueryFilterCondition)

export function filterBookmarksByUrlParams(
  entries: BookmarkKeyValuePair[],
  searchParams: string | URLSearchParams
) {
  console.log(
    'filterBookmarksByUrlParams',
    decodeURIComponent(searchParams.toString())
  )
  return defaultFilterRegistry.apply(entries, searchParams)
}

/**
 * Filter bookmarks by URL parameters
 * @param entries - Array of bookmark key-value pairs
 * @param searchParams - URL search parameters string
 * @returns Filtered array of bookmarks
 */
export function filterBookmarksByUrlParamsOld(
  entries: BookmarkKeyValuePair[],
  searchParams: string
): BookmarkKeyValuePair[] {
  // Parse URL parameters
  const urlParams = new URLSearchParams(searchParams)
  const timeType = urlParams.get('time') // 'created' or 'updated'
  const period = urlParams.get('period') // e.g. '7d', '30d', '3m', '1y'
  const startDate = urlParams.get('start') // YYYY-MM-DD format
  const endDate = urlParams.get('end') // YYYY-MM-DD format

  if (!timeType) return entries

  // Calculate date range
  let minDate: Date | undefined
  let maxDate: Date | undefined
  const now = new Date()

  if (period) {
    const unit = period.slice(-1)
    const value = Number.parseInt(period, 10)
    const multiplier =
      {
        d: 1, // days
        m: 30, // months (approximate)
        y: 365, // years (approximate)
      }[unit] || 1

    const days = value * multiplier
    minDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  } else {
    if (startDate) {
      minDate = new Date(startDate)
    }

    if (endDate) {
      maxDate = new Date(endDate)
    }
  }

  // Filter bookmarks
  return entries.filter(([_, entry]) => {
    if (!entry?.meta) return false

    const timestamp =
      timeType === 'created' ? entry.meta.created : entry.meta.updated

    const date = new Date(timestamp)

    if (minDate && date < minDate) return false
    if (maxDate && date > maxDate) return false
    return true
  })
}

// /#sb/linux.do#block/linux.do
// /?time=created&period=1m#sb/linux.do#block/linux.do
// /?filter=has_note#sb/linux.do#block/linux.do
// /?filter=has_note&time=created&period=1m#sb/linux.do#block/linux.do
// /?filter=sb/linux.do&filter=block/linux.do#sb/linux.do#block/linux.do
// /?filter=has_note&filter=sb/linux.do&filter=block/linux.do#sb/linux.do#block/linux.do
// /?filter=has_note&filter=sb/linux.do&filter=block/linux.do&time=created&period=1m#sb/linux.do#block/linux.do
// time=created&period=1m
// filter=sb/linux.do
// filter=has_note
// filter=has_highlight
// filter=is_hidden
// filter=is_article
// filter=is_video
// filter=is_audio
// filter=is_image
// filter=is_file
// filter=is_folder
// filter=is_archived
// filter=is_deleted
// filter=is_synced
// filter=is_unsynced
// source=default
// source=shared/1234
// source=deleted
// source=imported
// source=synced
// filter=!tag1,tag2

// test cases
// ?q=ab&q=12&q=AB,ab,cc&cc,ab => ?q=ab&q=12&q=ab,cc
// ?q=ab&q=12&q=AB => ?q=ab&q=12
