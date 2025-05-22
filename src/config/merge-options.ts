export const mergeTitleOptions = [
  { value: 'local', label: '本地标题' },
  { value: 'import', label: '导入标题' },
  { value: 'newer', label: '最新标题' },
] as const

export const mergeTagsOptions = [
  { value: 'local', label: '保留本地' },
  { value: 'import', label: '使用导入' },
  { value: 'newer', label: '最新标签' },
  { value: 'merge', label: '合并所有' },
] as const

export type MergeTitleStrategy = (typeof mergeTitleOptions)[number]['value']
export type MergeTagsStrategy = (typeof mergeTagsOptions)[number]['value']
