export function importData(data, fileType, strategy) {
  // 根据策略处理数据
  const processedData = processData(data, strategy)

  // 更新存储
  bookmarksStore.update((store) => {
    return mergeBookmarks(store, processedData, strategy)
  })
}

function processData(data, strategy) {
  // 处理标题策略
  if (strategy.title === 'local') {
    // 保留本地标题逻辑
  } else if (strategy.title === 'import') {
    // 使用导入标题逻辑
  } else {
    // 默认使用最新标题
  }

  // 处理标签策略
  switch (strategy.tags) {
    case 'local': {
      // 保留本地标签

      break
    }

    case 'import': {
      // 使用导入标签

      break
    }

    case 'merge': {
      // 合并标签

      break
    }

    default:
    // 默认使用最新标签
  }

  // 处理无创建日期的书签
  if (strategy.defaultDate) {
    // 应用默认创建日期
  }

  return processedData
}
