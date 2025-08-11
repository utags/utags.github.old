# UTags Bookmark Manager

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/utags/utags-bookmarks/ci.yml?branch=main)](https://github.com/utags/utags-bookmarks/actions)
[![UTags Official Site](https://img.shields.io/badge/UTags-Official_Site-brightgreen)](https://utags.link)

## 🚀 Project Overview

**UTags Bookmark Manager** empowers developers and power users to conquer bookmark chaos. This modern solution moves beyond simple lists, employing a **flexible tagging system** to bring order to your expanding collection of web resources. Unleash **powerful filtering capabilities** to instantly pinpoint the information you need, exactly when you need it.

Visit our [official website (https://utags.link)](https://utags.link/) to explore comprehensive features.

## ✨ Core Features

- **Multi-dimensional tag management system**: Support adding multiple tags to bookmarks for multi-dimensional classification
- **Hierarchical tag support**: Support hierarchical tag structure like `tag/subtag/grandchild-tag` for organizing complex tag systems
- **Advanced filtering system** supporting:
  - AND/OR/NOT logical combinations
  - Regular expression matching
  - Progressive filtering: Filter within results to gradually narrow down scope with real-time matching results
- **Local data persistence** via LocalStorage
- **Progressive Web App (PWA)** support
- **Seamless integration** with [UTags browser extension/userscript](https://github.com/utags/utags)

### Other Features

- Fully open source and free to use
- Easy self-hosting deployment
- Saved filter presets
- Create smart collections
- Data import/export capabilities
- Multi-device synchronization (TODO) (Paid service)
- Progressive Web App capabilities:
  - Add to Home Screen (A2HS)
  - Offline mode with Service Worker caching
  - Web App Manifest for native-like experience
- Visual data statistics dashboard
- Light/dark theme support
- Responsive layout with multiple view modes
- Cross-browser compatibility
- Browser bookmark import (Chrome/Edge/Firefox/Safari)

## ⚡ Quick Start

1. **Install Browser Extension (Optional)**
   Install the [UTags Extension](https://github.com/utags/utags) for immersive bookmarking

2. **Access Management Interface**
   Open the [UTags Web Interface](https://utags.link) to manage bookmarks

3. **Basic Operations**
   - Add bookmarks: Click the extension icon or manually enter
   - Filter bookmarks: Use compound filter conditions
   - Import bookmarks: Support importing bookmark HTML files from Chrome/Edge/Firefox/Safari

## Usages

### How to add a bookmark

- Add bookmarks on bookmark manager page
- Add bookmarks via [UTags extension/userscript](https://github.com/utags/utags)
- Make your own extension or userscript through our open API

### How to use filters

- Filter by keywords, tags, domains, and other metadata
- Multi-level filtering system supporting AND/OR/NOT logic combinations
- Regular expression matching
- Save filter presets for quick access in future sessions

## 🛣 Development Roadmap

- V1.0 TODO

  - Batch tag modification
  - Merge processing during bookmark import
  - Integration with UTags extension/script
  - [x] Internationalization

- **Bookmark Management Enhancements**

  - Batch modify/delete tags
  - Batch add tags
  - Bulk delete bookmarks
  - Bulk open all bookmarks
  - Global search functionality. Launch search function through shortcuts on any website to search all bookmarks, tags, and notes

- **Bookmark Collection Solutions**

  - Add bookmarks via [UTags extension/userscript](https://github.com/utags/utags)
  - Automatic title and webpage summary retrieval
  - AI smart tag recommendations

- **Interface Styles**

  - Custom styling options
  - Navigation website style view
  - Card view
  - Note viewing interface
  - Advanced note editing/viewing interface

- **Data Interoperability**
  - Gist/GitHub import/export support
  - WebDAV import/export support
  - Multi-device sync solution
  - Cloud sync capability
  - Bookmark export/import enhancements
  - Use IndexedDB storage when the bookmark volume is extremely large

## 🛠 Development

Wiki: [Development Guide](https://deepwiki.com/utags/utags-bookmarks)

## 📦 Installation & Usage

### Development

```bash
npm install
npm run dev
```

Access the application at `http://localhost:5173`

### Production Deployment

#### Method 1: Build from Source

```bash
# Clone the repository
git clone https://github.com/utags/utags-bookmarks.git
cd utags-bookmarks

# Install dependencies
npm install

# Build for production
npm run build

# Option 1: Deploy the dist folder to your web server
# The built files will be in the 'dist' directory

# Option 2: Start a local preview server
npm run preview
# This will serve the built files at http://localhost:4173
```

#### Method 2: Deploy Pre-built Version

```bash
# Clone the gh-pages branch (contains pre-built files)
git clone -b gh-pages --single-branch https://github.com/utags/utags-bookmarks.git utags-bookmarks-dist
cd utags-bookmarks-dist

# Deploy the files to your web server
# All files in this directory are ready for deployment
```

**To update to the latest version:**

```bash
cd utags-bookmarks-dist

# Fetch and reset to the latest version
# Note: gh-pages branch history is overwritten with each update
git fetch origin gh-pages
git reset --hard origin/gh-pages

# Re-deploy the updated files to your web server
```

> **Note**: For production deployment, ensure your web server is configured to serve static files and handle client-side routing for the single-page application.

## 🤝 Contributing

Contributions through:

- 🐛 [GitHub Issues](https://github.com/utags/utags-bookmarks/issues) - for bug reports
- 💡 [Pull Requests](https://github.com/utags/utags-bookmarks/pulls) - for feature additions
- 💬 [GitHub Discussions](https://github.com/orgs/utags/discussions) - get help and share tips

Please follow our [contribution guidelines](CONTRIBUTING.md).

## Instances

- [https://utags.link](https://utags.link/)
- [https://utags.top](https://utags.top/)
- [https://utags-bookmarks.pages.dev](https://utags-bookmarks.pages.dev/)
- [https://utags.github.io](https://utags.github.io/)

## 📄 License

Copyright (c) 2025 [Pipecraft](https://www.pipecraft.net). Licensed under the [MIT License](LICENSE).

---

[![Pipecraft Projects](https://img.shields.io/badge/Pipecraft-Projects-2EAADC)](https://www.pipecraft.net)
[![UTags Offcial Site](https://img.shields.io/badge/UTags-Offcial_Site-brightgreen)](https://utags.link)
