import * as m from '../paraglide/messages.js'

export const sortOptions = [
  /* eslint-disable new-cap */
  { value: 'updatedDesc', label: m.SORT_OPTION_UPDATED_DESC() },
  { value: 'updatedAsc', label: m.SORT_OPTION_UPDATED_ASC() },
  { value: 'createdDesc', label: m.SORT_OPTION_CREATED_DESC() },
  { value: 'createdAsc', label: m.SORT_OPTION_CREATED_ASC() },
  { value: 'titleAsc', label: m.SORT_OPTION_TITLE_ASC() },
  { value: 'titleDesc', label: m.SORT_OPTION_TITLE_DESC() },
  /* eslint-enable new-cap */
  // sort by last opened(visited)
] as const

export type SortOption = (typeof sortOptions)[number]['value']
