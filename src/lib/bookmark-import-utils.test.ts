import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { JSDOM } from 'jsdom'
import { htmlToBookmarks, validateBookmarks } from './bookmark-import-utils.js'

// 设置JSDOM环境
beforeAll(() => {
  const dom = new JSDOM()
  globalThis.DOMParser = dom.window.DOMParser
})

afterAll(() => {
  // 清理全局变量
  // @ts-expect-error 重置全局变量
  globalThis.DOMParser = undefined
})

describe('htmlToBookmarks', () => {
  it('应该处理空HTML', () => {
    const result = htmlToBookmarks('')
    expect(result.data).toEqual({})
    expect(result.meta.databaseVersion).toBe(3)
  })

  it('应该处理基本书签结构', () => {
    const html = `
      <dl>
        <dt><a href="https://example.com" add_date="1620000000">Example</a></dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(Object.keys(result.data)).toHaveLength(1)
    expect(result.data['https://example.com'].meta.title).toBe('Example')
    expect(result.data['https://example.com'].tags).toEqual([
      '/Other Bookmarks',
    ])
  })

  it('应该处理带标签的书签', () => {
    const html = `
      <dl>
        <dt><a href="https://example.com" add_date="1620000000" tags="tag1,tag2">Example</a></dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].tags).toEqual([
      '/Other Bookmarks',
      'tag1',
      'tag2',
    ])
  })

  it('应该处理文件夹结构', () => {
    const html = `
      <dl>
        <dt><h3>Folder</h3>
          <dl>
            <dt><a href="https://example.com" add_date="1620000000">Example</a></dt>
          </dl>
        </dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].tags).toEqual(['/Folder'])
  })

  it('应该处理嵌套文件夹结构', () => {
    const html = `
      <dl>
        <dt><h3>Parent</h3>
          <dl>
            <dt><h3>Child</h3>
              <dl>
                <dt><a href="https://example.com" add_date="1620000000">Example</a></dt>
              </dl>
            </dt>
          </dl>
        </dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].tags).toEqual(['/Parent/Child'])
  })

  it('应该忽略place:协议的书签', () => {
    const html = `
      <dl>
        <dt><a href="place:type=6">Recent Tags</a></dt>
        <dt><a href="https://example.com">Example</a></dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(Object.keys(result.data)).toHaveLength(1)
    expect(result.data['https://example.com']).toBeDefined()
  })

  it('应该合并重复书签', () => {
    const html = `
      <dl>
        <dt><a href="https://example.com" add_date="1620000000" tags="tag1">Example</a></dt>
        <dt><a href="https://example.com" add_date="1620000001" tags="tag2">Example 2</a></dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].tags).toEqual([
      '/Other Bookmarks',
      'tag1',
      'tag2',
    ])
    expect(result.data['https://example.com'].meta.title).toBe('Example 2')
  })

  it('应该处理Firefox导出的HTML格式', () => {
    const html = `
      <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
      <dl>
        <dt><a href="https://example.com" add_date="1620000000" last_modified="1620000001">Example</a></dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com']).toBeDefined()
  })

  it('应该处理Chrome导出的HTML格式', () => {
    const html = `
      <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <!-- This is an automatically generated file. -->
      <dl>
        <dt><a href="https://example.com" add_date="1620000000">Example</a></dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com']).toBeDefined()
  })

  it('应该处理Safari导出的HTML格式', () => {
    const html = `
      <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <HTML>
      <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
      <Title>Bookmarks</Title>
      <H1>Bookmarks</H1>
      <DT><H3 FOLDED>Favorites</H3>
      <DL><p>
          <DT><A HREF="https://www.google.com">Google</A>
          <DT><H3 FOLDED>News</H3>
          <DL><p>
              <DT><A HREF="https://news.example.com">Example News</A>
          </DL><p>
      </DL><p>
    `
    const result = htmlToBookmarks(html)
    expect(Object.keys(result.data)).toHaveLength(2)
    expect(result.data['https://www.google.com']).toBeDefined()
    expect(result.data['https://news.example.com']).toBeDefined()
    expect(result.data['https://news.example.com'].tags).toEqual([
      '/Favorites/News',
    ])
  })

  it('应该处理没有add_date的书签', () => {
    const html = `
      <dl>
        <dt><a href="https://example.com">Example</a></dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].meta.created).toBeGreaterThan(
      9_999_999_999_999
    )
  })

  it('应该处理add_date为0的书签', () => {
    const html = `
      <dl>
        <dt><a href="https://example.com" add_date="0">Example</a></dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].meta.created).toBeGreaterThan(
      9_999_999_999_999
    )
  })

  it('应该处理last_modified为0的书签', () => {
    const html = `
      <dl>
        <dt><a href="https://example.com" add_date="1620000000" last_modified="0">Example</a></dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].meta.updated).toBe(0)
  })

  it('应该处理带空格的文件夹名', () => {
    const html = `
      <dl>
        <dt><h3>Bookmarks Bar</h3>
          <dl>
            <dt><h3>   test </h3>
              <dl>
                <dt><a href="https://example.com">Example</a></dt>
              </dl>
            </dt>
          </dl>
        </dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].tags).toEqual([
      '/Bookmarks Bar/test',
    ])
  })

  it('应该处理空文件夹名', () => {
    const html = `
      <dl>
        <dt><h3>Bookmarks Bar</h3>
          <dl>
            <dt><h3></h3>
              <dl>
                <dt><a href="https://example.com">Example</a></dt>
              </dl>
            </dt>
            <dt><h3> </h3>
              <dl>
                <dt><a href="https://example2.com">Example2</a></dt>
              </dl>
            </dt>
          </dl>
        </dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].tags).toEqual(['/Bookmarks Bar/'])
    expect(result.data['https://example2.com'].tags).toEqual([
      '/Bookmarks Bar/',
    ])
  })

  it('应该处理多层空文件夹名', () => {
    const html = `
      <dl>
        <dt><h3>Bookmarks Bar</h3>
          <dl>
            <dt><h3>test</h3>
              <dl>
                <dt><h3></h3>
                  <dl>
                    <dt><a href="https://example.com">Example</a></dt>
                  </dl>
                </dt>
                <dt><h3> </h3>
                  <dl>
                    <dt><a href="https://example2.com">Example2</a></dt>
                  </dl>
                </dt>
              </dl>
            </dt>
          </dl>
        </dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].tags).toEqual([
      '/Bookmarks Bar/test/',
    ])
    expect(result.data['https://example2.com'].tags).toEqual([
      '/Bookmarks Bar/test/',
    ])
  })

  it('应该处理包含多个斜杠和空格的文件夹名', () => {
    const html = `
      <dl>
        <dt><h3>Bookmarks Bar</h3>
          <dl>
            <dt><h3>test</h3>
              <dl>
                <dt><h3> </h3>
                  <dl>
                    <dt><h3>/ /</h3>
                      <dl>
                        <dt><h3> </h3>
                          <dl>
                            <dt><a href="https://example.com">Example</a></dt>
                          </dl>
                        </dt>
                      </dl>
                    </dt>
                  </dl>
                </dt>
              </dl>
            </dt>
          </dl>
        </dt>
      </dl>
    `
    const result = htmlToBookmarks(html)
    expect(result.data['https://example.com'].tags).toEqual([
      '/Bookmarks Bar/test/////',
    ])
  })
})

describe('validateBookmarks', () => {
  const validBookmarks = {
    data: {
      'https://example.com': {
        tags: ['tag1'],
        meta: {
          title: 'Example',
          created: 1_620_000_000_000,
          updated: 1_620_000_001_000,
        },
      },
    },
    meta: {
      databaseVersion: 3,
      created: 1_620_000_000_000,
      exported: 1_620_000_000_000,
    },
  }

  it('应该验证有效的书签数据', () => {
    const result = validateBookmarks(validBookmarks)
    expect(result.total).toBe(1)
    expect(result.noCreated).toBe(0)
  })

  it('应该拒绝非对象输入', () => {
    // @ts-expect-error 测试无效输入类型
    expect(() => validateBookmarks(null)).toThrow('无效的JSON格式')
    // @ts-expect-error 测试无效输入类型
    expect(() => validateBookmarks(undefined)).toThrow('无效的JSON格式')
    // @ts-expect-error 测试无效输入类型
    expect(() => validateBookmarks('string')).toThrow('无效的JSON格式')
  })

  it('应该拒绝缺少data字段', () => {
    const invalid = { ...validBookmarks, data: undefined }
    // @ts-expect-error 测试缺少data字段
    expect(() => validateBookmarks(invalid)).toThrow('缺少data字段或格式不正确')
  })

  it('应该拒绝缺少meta字段', () => {
    const invalid = { ...validBookmarks, meta: undefined }
    // @ts-expect-error 测试缺少meta字段
    expect(() => validateBookmarks(invalid)).toThrow('缺少meta字段或格式不正确')
  })

  it('应该拒绝无效的meta字段', () => {
    const invalidMeta = {
      ...validBookmarks,
      meta: { databaseVersion: '3' },
    }
    // @ts-expect-error 测试无效meta字段类型
    expect(() => validateBookmarks(invalidMeta)).toThrow(
      '数据文件版本不支持，请联系开发者'
    )
  })

  it('应该拒绝无效的databaseVersion值', () => {
    const invalidVersion = {
      ...validBookmarks,
      meta: { ...validBookmarks.meta, databaseVersion: 2 },
    }
    expect(() => validateBookmarks(invalidVersion)).toThrow(
      '数据文件版本不支持，请联系开发者'
    )
  })

  it('应该拒绝无效的meta字段', () => {
    const invalidMeta = {
      ...validBookmarks,
      meta: { databaseVersion: 3, created: '1620000000000' },
    }
    // @ts-expect-error 测试无效meta字段类型
    expect(() => validateBookmarks(invalidMeta)).toThrow(
      'meta 字段里的属性类型错误'
    )
  })

  it('应该拒绝无效的meta字段', () => {
    const invalidMeta = {
      ...validBookmarks,
      meta: { databaseVersion: 3, exported: '1620000000000' },
    }
    // @ts-expect-error 测试无效meta字段类型
    expect(() => validateBookmarks(invalidMeta)).toThrow(
      'meta 字段里的属性类型错误'
    )
  })

  it('应该拒绝无效的书签tags字段', () => {
    const invalidData = {
      ...validBookmarks,
      data: {
        'https://example.com': {
          tags: 'not-an-array',
          meta: validBookmarks.data['https://example.com'].meta,
        },
      },
    }
    // @ts-expect-error 测试无效tags字段类型
    expect(() => validateBookmarks(invalidData)).toThrow(
      '书签 https://example.com 缺少有效的tags字段'
    )
  })

  it('应该拒绝无效的书签meta字段', () => {
    const invalidData = {
      ...validBookmarks,
      data: {
        'https://example.com': {
          tags: ['tag1'],
          meta: { created: '1620000000000', updated: 1_620_000_001_000 },
        },
      },
    }
    // @ts-expect-error 测试无效meta字段类型
    expect(() => validateBookmarks(invalidData)).toThrow(
      '书签 https://example.com 的meta字段缺少必要属性'
    )
  })

  it('应该统计没有创建时间的书签', () => {
    const noCreatedData = {
      ...validBookmarks,
      data: {
        'https://example.com': {
          tags: ['tag1'],
          meta: {
            title: 'Example',
            created: 99_999_999_999_999, // 无效的创建时间
            updated: 1_620_000_001_000,
          },
        },
      },
    }
    const result = validateBookmarks(noCreatedData)
    expect(result.noCreated).toBe(1)
  })

  it('应该处理多个书签', () => {
    const multipleBookmarks = {
      ...validBookmarks,
      data: {
        ...validBookmarks.data,

        'https://example2.com': {
          tags: ['tag2'],
          meta: {
            title: 'Example 2',
            created: 1_620_000_002_000,
            updated: 1_620_000_003_000,
          },
        },
      },
    }
    const result = validateBookmarks(multipleBookmarks)
    expect(result.total).toBe(2)
  })
})
