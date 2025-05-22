export const initialBookmarks = {
  'https://greasyfork.org/scripts/460718': {
    meta: {
      title: 'Userscript - 🏷️ UTags - Add user tags to links',
      created: Date.now(),
      updated: Date.now(),
    },
    tags: ['Open Source', 'Tools', 'Userscript'],
  },
  'https://chromewebstore.google.com/detail/utags-add-usertags-to-lin/kofjcnaphffjoookgahgjidofbdplgig':
    {
      meta: {
        title: 'Chrome extension - UTags - Add usertags to links',
        created: Date.now() - 1000 - Math.floor(Math.random() * 3_600_000),
        updated: Date.now() - 1000,
      },
      tags: [
        'Browser Extension/Chrome',
        'Browser Extension',
        'Tools',
        'Open Source',
      ],
    },
  'https://microsoftedge.microsoft.com/addons/detail/utags-add-usertags-to-l/bhlbflbehfoccjjenpekilgabbjjnphe':
    {
      meta: {
        title: 'Edge extension - UTags - Add usertags to links',
        created: Date.now() - 2000 - Math.floor(Math.random() * 3_600_000),
        updated: Date.now() - 2000,
      },
      tags: [
        'Browser Extension/Edge',
        'Browser Extension',
        'Productivity',
        'Tools',
        'Open Source',
      ],
    },
  'https://addons.mozilla.org/firefox/addon/utags/': {
    meta: {
      title: 'Firefox extension - UTags - Add usertags to links',
      created: Date.now() - 3000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 3000,
    },
    tags: [
      'Browser Extension/Firefox',
      'Browser Extension',
      'Open Source',
      'Tools',
      'Bookmarks',
    ],
  },
  'https://github.com/utags/utags': {
    meta: {
      title: 'GitHub - utags/utags: 🏷️ UTags - Add user tags to links',
      created: Date.now() - 4000 - Math.floor(Math.random() * 3_600_000),
      updated: Date.now() - 4000,
    },
    tags: ['Open Source', 'Browser Extension', 'Userscript'],
  },
}

// 文档链接
// - docs.utags.link docs-zh.utags.link
// - utags.link/docs
// - utags.link/docs-zh
// - utags.link/faq
// - utags.link/faq-zh
// - discussions url
