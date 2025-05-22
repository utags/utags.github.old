import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BookmarkKeyValuePair } from '../types/bookmarks.js'
import {
  CommandManager,
  AddTagCommand,
  RemoveTagCommand,
  RenameTagCommand,
  CompositeTagCommand,
} from './tag-commands.js'

describe('CommandManager', () => {
  // 测试数据
  let testBookmarks: BookmarkKeyValuePair[]
  let commandManager: CommandManager
  let persistCallback: (bookmarks: BookmarkKeyValuePair[]) => Promise<void>

  beforeEach(() => {
    // 重置测试数据
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

    // 创建模拟的持久化回调
    persistCallback = vi.fn().mockResolvedValue(undefined)

    // 创建命令管理器实例
    commandManager = new CommandManager(persistCallback, 10)
  })

  /**
   * 基本功能测试
   */
  describe('基本功能', () => {
    it('应该能执行单个命令', async () => {
      // 创建添加标签命令
      const command = new AddTagCommand(testBookmarks, 'new-tag')

      // 执行命令
      await commandManager.executeCommand(command, testBookmarks)

      // 验证标签已添加
      expect(testBookmarks[0][1].tags).toContain('new-tag')
      expect(testBookmarks[1][1].tags).toContain('new-tag')

      // 验证持久化回调被调用
      expect(persistCallback).toHaveBeenCalledTimes(1)
      expect(persistCallback).toHaveBeenCalledWith(testBookmarks)

      // 验证命令历史记录
      expect(commandManager.getCommandHistory().length).toBe(1)
      expect(commandManager.getCurrentIndex()).toBe(0)
    })

    it('应该能批量执行命令', async () => {
      // 创建多个命令
      const addCommand = new AddTagCommand(testBookmarks, 'new-tag')
      const removeCommand = new RemoveTagCommand(testBookmarks, 'test')

      // 批量执行命令
      const result = await commandManager.executeBatch(
        [addCommand, removeCommand],
        testBookmarks
      )

      // 验证执行结果
      expect(result).toBe(true)

      // 验证标签变化
      expect(testBookmarks[0][1].tags).toContain('new-tag')
      expect(testBookmarks[0][1].tags).not.toContain('test')
      expect(testBookmarks[1][1].tags).toContain('new-tag')
      expect(testBookmarks[1][1].tags).not.toContain('test')

      // 验证持久化回调只被调用一次
      expect(persistCallback).toHaveBeenCalledTimes(1)
      expect(persistCallback).toHaveBeenCalledWith(testBookmarks)

      // 验证命令历史记录
      expect(commandManager.getCommandHistory().length).toBe(2)
      expect(commandManager.getCurrentIndex()).toBe(1)
    })

    it('应该能撤销命令', async () => {
      // 创建并执行命令
      const command = new AddTagCommand(testBookmarks, 'new-tag')
      await commandManager.executeCommand(command, testBookmarks)

      // 验证标签已添加
      expect(testBookmarks[0][1].tags).toContain('new-tag')

      // 撤销命令
      const undoResult = await commandManager.undo(testBookmarks)

      // 验证撤销结果
      expect(undoResult).toBe(true)

      // 验证标签已恢复
      expect(testBookmarks[0][1].tags).not.toContain('new-tag')
      expect(testBookmarks[0][1].tags).toEqual(['example', 'test'])

      // 验证持久化回调被再次调用
      expect(persistCallback).toHaveBeenCalledTimes(2)

      // 验证命令索引
      expect(commandManager.getCurrentIndex()).toBe(-1)
    })

    it('应该能重做命令', async () => {
      // 创建并执行命令
      const command = new AddTagCommand(testBookmarks, 'new-tag')
      await commandManager.executeCommand(command, testBookmarks)

      // 撤销命令
      await commandManager.undo(testBookmarks)

      // 重做命令
      const redoResult = await commandManager.redo(testBookmarks)

      // 验证重做结果
      expect(redoResult).toBe(true)

      // 验证标签已重新添加
      expect(testBookmarks[0][1].tags).toContain('new-tag')
      expect(testBookmarks[1][1].tags).toContain('new-tag')

      // 验证持久化回调被再次调用
      expect(persistCallback).toHaveBeenCalledTimes(3)

      // 验证命令索引
      expect(commandManager.getCurrentIndex()).toBe(0)
    })

    it('应该正确报告撤销/重做状态', async () => {
      // 初始状态
      expect(commandManager.canUndo()).toBe(false)
      expect(commandManager.canRedo()).toBe(false)

      // 执行命令后
      const command = new AddTagCommand(testBookmarks, 'new-tag')
      await commandManager.executeCommand(command, testBookmarks)
      expect(commandManager.canUndo()).toBe(true)
      expect(commandManager.canRedo()).toBe(false)

      // 撤销后
      await commandManager.undo(testBookmarks)
      expect(commandManager.canUndo()).toBe(false)
      expect(commandManager.canRedo()).toBe(true)

      // 重做后
      await commandManager.redo(testBookmarks)
      expect(commandManager.canUndo()).toBe(true)
      expect(commandManager.canRedo()).toBe(false)
    })

    it('执行新命令后应清除重做历史', async () => {
      // 创建并执行两个命令
      const addCommand = new AddTagCommand(testBookmarks, 'tag1')
      const removeCommand = new RemoveTagCommand(testBookmarks, 'test')

      await commandManager.executeCommand(addCommand, testBookmarks)
      await commandManager.executeCommand(removeCommand, testBookmarks)

      // 撤销一个命令
      await commandManager.undo(testBookmarks)

      // 验证可以重做
      expect(commandManager.canRedo()).toBe(true)

      // 执行新命令
      const newCommand = new AddTagCommand(testBookmarks, 'tag2')
      await commandManager.executeCommand(newCommand, testBookmarks)

      // 验证重做历史被清除
      expect(commandManager.canRedo()).toBe(false)
      expect(commandManager.getCommandHistory().length).toBe(2)
      expect(commandManager.getCurrentIndex()).toBe(1)
    })
  })

  /**
   * 边界情况测试
   */
  describe('边界情况', () => {
    it('应该处理空命令列表', async () => {
      // 尝试批量执行空命令列表
      const result = await commandManager.executeBatch([], testBookmarks)
      expect(result).toBe(false)

      // 验证没有变化
      expect(commandManager.getCommandHistory().length).toBe(0)
      expect(persistCallback).not.toHaveBeenCalled()
    })

    it('应该在没有命令时拒绝撤销', async () => {
      const result = await commandManager.undo(testBookmarks)
      expect(result).toBe(false)
      expect(persistCallback).not.toHaveBeenCalled()
    })

    it('应该在没有撤销历史时拒绝重做', async () => {
      const result = await commandManager.redo(testBookmarks)
      expect(result).toBe(false)
      expect(persistCallback).not.toHaveBeenCalled()
    })

    it('应该限制历史记录大小', async () => {
      // 设置较小的历史记录限制
      commandManager.setMaxHistorySize(3)

      // 创建多个命令并执行
      for (let i = 0; i < 5; i++) {
        const command = new AddTagCommand(testBookmarks, `tag-${i}`)
        // eslint-disable-next-line no-await-in-loop
        await commandManager.executeCommand(command, testBookmarks)
      }

      // 验证历史记录被限制
      expect(commandManager.getCommandHistory().length).toBeLessThanOrEqual(3)
    })

    it('应该拒绝无效的历史记录大小', () => {
      expect(() => {
        commandManager.setMaxHistorySize(0)
      }).toThrow()
      expect(() => {
        commandManager.setMaxHistorySize(-1)
      }).toThrow()
    })

    it('应该能清除历史记录', async () => {
      // 创建并执行命令
      const command = new AddTagCommand(testBookmarks, 'new-tag')
      await commandManager.executeCommand(command, testBookmarks)

      // 清除历史记录
      commandManager.clear()

      // 验证历史记录已清除
      expect(commandManager.getCommandHistory().length).toBe(0)
      expect(commandManager.getCurrentIndex()).toBe(-1)
      expect(commandManager.canUndo()).toBe(false)
      expect(commandManager.canRedo()).toBe(false)
    })
  })

  /**
   * 复杂命令测试
   */
  describe('复杂命令', () => {
    it('应该能处理复合命令', async () => {
      // 创建多个子命令
      const addCommand = new AddTagCommand(testBookmarks, 'new-tag')
      const renameCommand = new RenameTagCommand(
        testBookmarks,
        'test',
        'testing'
      )

      // 创建复合命令
      const compositeCommand = new CompositeTagCommand(
        [addCommand, renameCommand],
        'rename',
        '标签批处理'
      )

      // 执行复合命令
      await commandManager.executeCommand(compositeCommand, testBookmarks)

      // 验证所有子命令效果都已应用
      expect(testBookmarks[0][1].tags).toContain('new-tag')
      expect(testBookmarks[0][1].tags).not.toContain('test')
      expect(testBookmarks[0][1].tags).toContain('testing')

      // 撤销复合命令
      await commandManager.undo(testBookmarks)

      // 验证所有效果都已撤销
      expect(testBookmarks[0][1].tags).not.toContain('new-tag')
      expect(testBookmarks[0][1].tags).toContain('test')
      expect(testBookmarks[0][1].tags).not.toContain('testing')
    })
  })

  /**
   * 持久化回调测试
   */
  describe('持久化回调', () => {
    it('没有提供持久化回调时不应尝试持久化', async () => {
      // 创建没有持久化回调的命令管理器
      const managerWithoutCallback = new CommandManager()

      // 创建命令
      const command = new AddTagCommand(testBookmarks, 'new-tag')

      // 执行命令不应抛出错误
      await expect(
        managerWithoutCallback.executeCommand(command, testBookmarks)
      ).resolves.not.toThrow()

      // 撤销命令不应抛出错误
      await managerWithoutCallback.executeCommand(command, testBookmarks)
      await expect(
        managerWithoutCallback.undo(testBookmarks)
      ).resolves.not.toThrow()
    })

    it('没有提供书签数组时不应尝试持久化', async () => {
      // 创建命令
      const command = new AddTagCommand(testBookmarks, 'new-tag')

      // 执行命令但不提供书签数组
      await commandManager.executeCommand(command)

      // 验证持久化回调未被调用
      expect(persistCallback).not.toHaveBeenCalled()
    })

    it('批量执行命令时应只调用一次持久化回调', async () => {
      // 创建多个命令
      const commands = [
        new AddTagCommand(testBookmarks, 'tag1'),
        new AddTagCommand(testBookmarks, 'tag2'),
        new AddTagCommand(testBookmarks, 'tag3'),
      ]

      // 批量执行命令
      await commandManager.executeBatch(commands, testBookmarks)

      // 验证持久化回调只被调用一次
      expect(persistCallback).toHaveBeenCalledTimes(1)
    })
  })
})
