export const initialBookmarks = {
  'https://utags.link/': {
    meta: {
      title: 'UTags 书签管理器',
      description:
        'UTags 书签管理器是一个现代化的书签管理工具，旨在帮助开发者和资深用户摆脱书签杂乱无章的困扰。它不同于传统的书签管理方式，采用了灵活的标签系统和强大的筛选功能，让用户能够更高效地管理和查找网络资源。',
      note: `使用说明:
- 可以给书签添加备注
- 在设置里清空数据
- 支持导入 Chrome/Edge/Firefox/Safari 的书签 HTML 文件
      `,
      created: Date.now(),
      updated: Date.now(),
    },
    tags: [
      '开源项目',
      '书签',
      '书签管理器',
      '工具/免费',
      '稍后阅读',
      'Bookmarks',
    ],
  },
  'https://greasyfork.org/scripts/460718': {
    meta: {
      title: 'Userscript - 🏷️ 小鱼标签 (UTags) - 为链接添加用户标签',
      note: `这是个超实用的工具，能给用户、帖子、视频等链接添加自定义标签和备注信息。比如，可以给论坛的用户或帖子添加标签，易于识别他们或屏蔽他们的帖子和回复。支持 V2EX, X, Reddit, Greasy Fork, GitHub, B 站, 抖音, 小红书, 知乎, 掘金, 豆瓣, 吾爱破解, pixiv, LINUX DO, 小众软件, NGA, BOSS 直聘等网站。并可以使用特殊标签过滤帖子和回复。`,
      created: Date.now(),
      updated: Date.now(),
    },
    tags: ['开源项目', 'Tools', '用户脚本', 'userscript'],
  },
  'https://chromewebstore.google.com/detail/utags-add-usertags-to-lin/kofjcnaphffjoookgahgjidofbdplgig':
    {
      meta: {
        title: 'Chrome extension - UTags - Add usertags to links',
        created: Date.now() - 1000 - Math.floor(Math.random() * 3_600_000),
        updated: Date.now() - 1000,
      },
      tags: ['浏览器扩展/chrome', '浏览器扩展', 'Tools', '开源项目'],
    },
  'https://microsoftedge.microsoft.com/addons/detail/utags-add-usertags-to-l/bhlbflbehfoccjjenpekilgabbjjnphe':
    {
      meta: {
        title: 'Edge extension - UTags - Add usertags to links',
        created: Date.now() - 2000 - Math.floor(Math.random() * 3_600_000),
        updated: Date.now() - 2000,
      },
      tags: [
        '浏览器扩展/edge',
        '浏览器扩展',
        'Productivity',
        'Tools',
        '开源项目',
      ],
    },
  'https://addons.mozilla.org/firefox/addon/utags/': {
    meta: {
      title: 'Firefox extension - UTags - Add usertags to links',
      created: Date.now() - 3000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 3000,
    },
    tags: [
      '浏览器扩展/firefox',
      '浏览器扩展',
      '开源项目',
      'Tools',
      'Bookmarks',
    ],
  },
  'https://github.com/utags/utags': {
    meta: {
      title: 'GitHub - utags/utags: 🏷️ 小鱼标签 (UTags) - 为链接添加用户标签',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['开源项目', '浏览器扩展', '用户脚本', 'userscript'],
  },
  'https://utags.link/c/public/help-zh': {
    meta: {
      title: '帮助文档',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['help', 'public-collection', 'utags', '稍后阅读'],
  },
  'https://utags.link/c/public/release-notes-zh': {
    meta: {
      title: '更新日志',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['release-notes', 'public-collection', 'utags', 'Read Later'],
  },
  'https://github.com/orgs/utags/discussions': {
    meta: {
      title: '反馈与建议',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['discussions', '论坛', '社区', 'utags'],
  },
  'https://utags.link/ref/': {
    meta: {
      title: 'Quick Reference',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['速查表', '工具'],
  },
  'https://github.com/utags/utags-bookmarks': {
    meta: {
      title: 'UTags 书签管理器',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['开源项目', '书签', '书签管理器', '工具/免费', 'Bookmarks'],
  },

  'https://tapmeplus1.com/zh': {
    meta: {
      title: '《点我加 1》的网页版小游戏',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['🎮 游戏', '小游戏/网页版'],
  },
  'https://svelte.dev/': {
    meta: {
      title: 'Svelte',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['技术栈', 'JavaScript', 'TypeScript', '开源项目'],
  },
  'https://tailwindcss.com/': {
    meta: {
      title: 'Tailwind CSS',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['技术栈', 'CSS', '开源项目'],
  },
  'https://lucide.dev/': {
    meta: {
      title: 'Lucide',
      description: 'Beautiful & consistent icon toolkit made by the community.',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['技术栈', 'Icon', '开源项目'],
  },
  'https://www.typescriptlang.org/': {
    meta: {
      title: 'TypeScript',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['技术栈', 'TypeScript', '开源项目'],
  },
  'https://inlang.com/m/gerre34r/library-inlang-paraglideJs': {
    meta: {
      title: 'Paraglide JS',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['技术栈', 'i18n', '开源项目'],
  },
  'https://vite.dev/': {
    meta: {
      title: 'Vite | Next Generation Frontend Tooling',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['技术栈', 'TypeScript', 'JavaScript', 'tools/frontend', '开源项目'],
  },
  'https://vitest.dev/': {
    meta: {
      title: 'Vitest | Next Generation testing framework',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['技术栈', 'TypeScript', 'JavaScript', 'tools/frontend', '开源项目'],
  },
  'https://www.v2ex.com/': {
    meta: {
      title: 'V2EX - 创意工作者们的社区',
      description:
        '创意工作者的社区。讨论编程、设计、硬件、游戏等令人激动的话题。',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['论坛', '论坛/程序员', '💰 赞助商'],
  },
  'https://linux.do/': {
    meta: {
      title: 'LINUX DO',
      description: 'Where possible begins.',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['论坛', '论坛/程序员', '💰 赞助商'],
  },
  'https://github.com/helloxz/linksumm': {
    meta: {
      title: 'LinkSumm',
      description:
        'LinkSumm 是一款使用 AI 大模型驱动的智能摘要提取器，您可以输入一个 URL 地址，让 AI 为您总结内容。',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['工具/AI', '开源项目', '💰 赞助商'],
  },
  'https://greasyfork.org/': {
    meta: {
      title: 'Greasy Fork',
      description:
        'Greasy Fork is a free site providing user scripts to improve your web browsing experience.',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['userscript', '用户脚本', '💰 赞助商'],
  },
}
