# Firefox RSS Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Firefox toolbar extension that tracks unread RSS post counts and opens sites for reading.

**Architecture:** Background script handles feed checking, storage, and badge updates. Popup displays feed list with drag-drop reordering and context menu management. Feed parser utility handles RSS/Atom parsing and auto-discovery.

**Tech Stack:** Firefox WebExtension API (Manifest V2), vanilla JavaScript, browser.storage.local, browser.alarms

---

## Task 1: Extension Foundation - Manifest and Icons

**Files:**
- Create: `manifest.json`
- Create: `icons/rss-16.svg`
- Create: `icons/rss-32.svg`
- Create: `icons/rss-48.svg`
- Create: `icons/rss-96.svg`

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 2,
  "name": "RSS Reader",
  "version": "1.0.0",
  "description": "Lightweight RSS feed tracker with unread counts",
  "icons": {
    "16": "icons/rss-16.svg",
    "32": "icons/rss-32.svg",
    "48": "icons/rss-48.svg",
    "96": "icons/rss-96.svg"
  },
  "permissions": [
    "storage",
    "alarms",
    "<all_urls>"
  ],
  "background": {
    "scripts": ["utils/feed-parser.js", "background.js"]
  },
  "browser_action": {
    "default_icon": {
      "16": "icons/rss-16.svg",
      "32": "icons/rss-32.svg"
    },
    "default_title": "RSS Reader",
    "default_popup": "popup/popup.html"
  }
}
```

**Step 2: Create RSS icon SVGs**

All icons use the same SVG content, just referenced at different sizes. Create `icons/rss-16.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <circle cx="3" cy="13" r="2" fill="#ee802f"/>
  <path d="M1 1v2a12 12 0 0 1 12 12h2A14 14 0 0 0 1 1z" fill="#ee802f"/>
  <path d="M1 5v2a8 8 0 0 1 8 8h2A10 10 0 0 0 1 5z" fill="#ee802f"/>
</svg>
```

Create `icons/rss-32.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <circle cx="6" cy="26" r="4" fill="#ee802f"/>
  <path d="M2 2v4a24 24 0 0 1 24 24h4A28 28 0 0 0 2 2z" fill="#ee802f"/>
  <path d="M2 10v4a16 16 0 0 1 16 16h4A20 20 0 0 0 2 10z" fill="#ee802f"/>
</svg>
```

Create `icons/rss-48.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <circle cx="9" cy="39" r="6" fill="#ee802f"/>
  <path d="M3 3v6a36 36 0 0 1 36 36h6A42 42 0 0 0 3 3z" fill="#ee802f"/>
  <path d="M3 15v6a24 24 0 0 1 24 24h6A30 30 0 0 0 3 15z" fill="#ee802f"/>
</svg>
```

Create `icons/rss-96.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <circle cx="18" cy="78" r="12" fill="#ee802f"/>
  <path d="M6 6v12a72 72 0 0 1 72 72h12A84 84 0 0 0 6 6z" fill="#ee802f"/>
  <path d="M6 30v12a48 48 0 0 1 48 48h12A60 60 0 0 0 6 30z" fill="#ee802f"/>
</svg>
```

**Step 3: Test extension loads**

1. Open Firefox, go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select `manifest.json`
4. Verify: RSS icon appears in toolbar

**Step 4: Commit**

```bash
git add manifest.json icons/
git commit -m "feat: add extension manifest and RSS icons"
```

---

## Task 2: Feed Parser Utility

**Files:**
- Create: `utils/feed-parser.js`

**Step 1: Create feed-parser.js with parsing and discovery functions**

```javascript
const FeedParser = {
  /**
   * Parse RSS or Atom feed XML into normalized format
   * @param {string} xml - Raw XML string
   * @returns {Object|null} - {title, posts: [{id, title, link}]} or null if invalid
   */
  parse(xml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      if (doc.querySelector('parsererror')) {
        return null;
      }

      // Try RSS 2.0
      const channel = doc.querySelector('channel');
      if (channel) {
        return this._parseRSS(channel);
      }

      // Try Atom
      const feed = doc.querySelector('feed');
      if (feed) {
        return this._parseAtom(feed);
      }

      return null;
    } catch (e) {
      return null;
    }
  },

  _parseRSS(channel) {
    const title = channel.querySelector('title')?.textContent || 'Untitled Feed';
    const items = channel.querySelectorAll('item');
    const posts = [];

    items.forEach(item => {
      const guid = item.querySelector('guid')?.textContent;
      const link = item.querySelector('link')?.textContent;
      const postTitle = item.querySelector('title')?.textContent || '';

      posts.push({
        id: guid || link || postTitle,
        title: postTitle,
        link: link || ''
      });
    });

    return { title, posts };
  },

  _parseAtom(feed) {
    const title = feed.querySelector('title')?.textContent || 'Untitled Feed';
    const entries = feed.querySelectorAll('entry');
    const posts = [];

    entries.forEach(entry => {
      const id = entry.querySelector('id')?.textContent;
      const link = entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
                   entry.querySelector('link')?.getAttribute('href');
      const postTitle = entry.querySelector('title')?.textContent || '';

      posts.push({
        id: id || link || postTitle,
        title: postTitle,
        link: link || ''
      });
    });

    return { title, posts };
  },

  /**
   * Fetch and parse a feed URL
   * @param {string} url - Feed URL
   * @returns {Promise<Object|null>} - Parsed feed or null
   */
  async fetch(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const text = await response.text();
      return this.parse(text);
    } catch (e) {
      return null;
    }
  },

  /**
   * Discover RSS feed from a webpage URL
   * @param {string} url - Webpage URL
   * @returns {Promise<{feedUrl: string, siteUrl: string, title: string}|null>}
   */
  async discover(url) {
    // First, try the URL directly as a feed
    const directFeed = await this.fetch(url);
    if (directFeed) {
      return {
        feedUrl: url,
        siteUrl: url,
        title: directFeed.title
      };
    }

    // Try to fetch the page and look for feed links
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Look for RSS/Atom link tags
      const feedLink = doc.querySelector(
        'link[type="application/rss+xml"], link[type="application/atom+xml"]'
      );

      if (feedLink) {
        let feedUrl = feedLink.getAttribute('href');

        // Handle relative URLs
        if (feedUrl && !feedUrl.startsWith('http')) {
          const base = new URL(url);
          feedUrl = new URL(feedUrl, base).href;
        }

        if (feedUrl) {
          const feed = await this.fetch(feedUrl);
          if (feed) {
            return {
              feedUrl: feedUrl,
              siteUrl: url,
              title: feed.title
            };
          }
        }
      }

      // Try common feed paths
      const base = new URL(url);
      const commonPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'];

      for (const path of commonPaths) {
        const tryUrl = base.origin + path;
        const feed = await this.fetch(tryUrl);
        if (feed) {
          return {
            feedUrl: tryUrl,
            siteUrl: url,
            title: feed.title
          };
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }
};
```

**Step 2: Test in browser console**

1. Reload extension in `about:debugging`
2. Click "Inspect" on the extension
3. In console, test:
```javascript
FeedParser.fetch('https://feeds.bbci.co.uk/news/rss.xml').then(console.log)
```
4. Verify: Should log an object with title and posts array

**Step 3: Commit**

```bash
git add utils/feed-parser.js
git commit -m "feat: add RSS/Atom feed parser with auto-discovery"
```

---

## Task 3: Background Script - Storage and Badge

**Files:**
- Create: `background.js`

**Step 1: Create background.js with storage utilities**

```javascript
const Storage = {
  async getFeeds() {
    const result = await browser.storage.local.get('feeds');
    return result.feeds || [];
  },

  async saveFeeds(feeds) {
    await browser.storage.local.set({ feeds });
  },

  async addFeed(feed) {
    const feeds = await this.getFeeds();
    const maxOrder = feeds.reduce((max, f) => Math.max(max, f.order || 0), 0);
    feed.id = Date.now().toString();
    feed.order = maxOrder + 1;
    feed.knownPostIds = [];
    feed.unreadCount = 0;
    feed.lastChecked = null;
    feeds.push(feed);
    await this.saveFeeds(feeds);
    return feed;
  },

  async updateFeed(id, updates) {
    const feeds = await this.getFeeds();
    const index = feeds.findIndex(f => f.id === id);
    if (index !== -1) {
      feeds[index] = { ...feeds[index], ...updates };
      await this.saveFeeds(feeds);
    }
  },

  async deleteFeed(id) {
    const feeds = await this.getFeeds();
    const filtered = feeds.filter(f => f.id !== id);
    await this.saveFeeds(filtered);
  },

  async reorderFeeds(orderedIds) {
    const feeds = await this.getFeeds();
    orderedIds.forEach((id, index) => {
      const feed = feeds.find(f => f.id === id);
      if (feed) feed.order = index;
    });
    await this.saveFeeds(feeds);
  }
};

const Badge = {
  update(count) {
    if (count === 0) {
      browser.browserAction.setBadgeText({ text: '' });
    } else {
      const text = count > 50 ? '50+' : count.toString();
      browser.browserAction.setBadgeText({ text });
    }
    browser.browserAction.setBadgeBackgroundColor({ color: '#666666' });
  },

  async refresh() {
    const feeds = await Storage.getFeeds();
    const total = feeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);
    this.update(total);
  }
};

async function checkFeed(feed) {
  const parsed = await FeedParser.fetch(feed.feedUrl);
  if (!parsed) return feed;

  const newPostIds = parsed.posts.map(p => p.id);
  const knownIds = new Set(feed.knownPostIds || []);

  let newCount = 0;
  const updatedKnownIds = [...feed.knownPostIds];

  for (const id of newPostIds) {
    if (!knownIds.has(id)) {
      newCount++;
      updatedKnownIds.push(id);
    }
  }

  return {
    ...feed,
    knownPostIds: updatedKnownIds,
    unreadCount: feed.unreadCount + newCount,
    lastChecked: Date.now()
  };
}

async function checkAllFeeds() {
  const feeds = await Storage.getFeeds();
  if (feeds.length === 0) return;

  const updatedFeeds = await Promise.all(feeds.map(checkFeed));
  await Storage.saveFeeds(updatedFeeds);
  await Badge.refresh();
}

// Set up hourly alarm
browser.alarms.create('checkFeeds', { periodInMinutes: 60 });

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkFeeds') {
    checkAllFeeds();
  }
});

// Check on startup
browser.runtime.onStartup.addListener(checkAllFeeds);

// Also check when extension is installed/updated
browser.runtime.onInstalled.addListener(checkAllFeeds);

// Initialize badge
Badge.refresh();
```

**Step 2: Test storage and badge**

1. Reload extension in `about:debugging`
2. Click "Inspect" on the extension
3. In console, test:
```javascript
await Storage.addFeed({name: 'Test', feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml', siteUrl: 'https://bbc.com'})
await Storage.getFeeds()
```
4. Verify: Feed is stored and returned

**Step 3: Commit**

```bash
git add background.js
git commit -m "feat: add background script with storage, badge, and feed checking"
```

---

## Task 4: Popup HTML Structure

**Files:**
- Create: `popup/popup.html`

**Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="feed-list"></div>
  <div id="empty-state">No feeds yet. Right-click to add one.</div>

  <div id="context-menu" class="context-menu hidden">
    <div class="context-menu-item" data-action="add">Add new feed...</div>
    <div class="context-menu-item" data-action="edit">Edit feed...</div>
    <div class="context-menu-item" data-action="delete">Delete feed</div>
  </div>

  <div id="modal-overlay" class="hidden">
    <div id="modal">
      <div id="modal-title">Add Feed</div>
      <input type="text" id="modal-input" placeholder="Site or feed URL">
      <div id="modal-fields" class="hidden">
        <input type="text" id="modal-name" placeholder="Name">
        <input type="text" id="modal-feed-url" placeholder="Feed URL">
        <input type="text" id="modal-site-url" placeholder="Site URL">
      </div>
      <div id="modal-error" class="hidden"></div>
      <div id="modal-buttons">
        <button id="modal-cancel">Cancel</button>
        <button id="modal-save">Save</button>
      </div>
    </div>
  </div>

  <script src="../utils/feed-parser.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Test popup opens**

1. Reload extension in `about:debugging`
2. Click the RSS icon in toolbar
3. Verify: Popup opens (may be unstyled)

**Step 3: Commit**

```bash
git add popup/popup.html
git commit -m "feat: add popup HTML structure"
```

---

## Task 5: Popup CSS Styling

**Files:**
- Create: `popup/popup.css`

**Step 1: Create popup.css with Firefox-native styling**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 300px;
  max-height: 400px;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #0c0c0d;
  background: #fff;
}

#feed-list {
  display: flex;
  flex-direction: column;
}

#empty-state {
  padding: 20px;
  text-align: center;
  color: #737373;
}

.feed-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
}

.feed-item:hover {
  background: #ededf0;
}

.feed-item.dragging {
  opacity: 0.5;
  background: #d7d7db;
}

.feed-item.drag-over {
  border-top: 2px solid #0060df;
}

.feed-item.unread .feed-name {
  font-weight: 600;
}

.feed-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-badge {
  background: #666666;
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 8px;
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: #fff;
  border: 1px solid #cfcfd8;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 150px;
}

.context-menu.hidden {
  display: none;
}

.context-menu-item {
  padding: 8px 12px;
  cursor: pointer;
}

.context-menu-item:hover {
  background: #ededf0;
}

.context-menu-item:first-child {
  border-radius: 4px 4px 0 0;
}

.context-menu-item:last-child {
  border-radius: 0 0 4px 4px;
}

/* Modal */
#modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

#modal-overlay.hidden {
  display: none;
}

#modal {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  width: 260px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

#modal-title {
  font-weight: 600;
  margin-bottom: 12px;
}

#modal input {
  width: 100%;
  padding: 8px;
  border: 1px solid #cfcfd8;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 8px;
}

#modal input:focus {
  outline: none;
  border-color: #0060df;
}

#modal-fields.hidden {
  display: none;
}

#modal-error {
  color: #d70022;
  font-size: 12px;
  margin-bottom: 8px;
}

#modal-error.hidden {
  display: none;
}

#modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

#modal button {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}

#modal-cancel {
  background: #ededf0;
  border: none;
  color: #0c0c0d;
}

#modal-cancel:hover {
  background: #d7d7db;
}

#modal-save {
  background: #0060df;
  border: none;
  color: #fff;
}

#modal-save:hover {
  background: #003eaa;
}

#modal-save:disabled {
  background: #b1b1b3;
  cursor: not-allowed;
}
```

**Step 2: Test styling**

1. Reload extension in `about:debugging`
2. Click the RSS icon
3. Verify: Popup shows "No feeds yet" message with clean styling

**Step 3: Commit**

```bash
git add popup/popup.css
git commit -m "feat: add popup CSS with Firefox-native styling"
```

---

## Task 6: Popup JavaScript - Core Functionality

**Files:**
- Create: `popup/popup.js`

**Step 1: Create popup.js with feed rendering and interactions**

```javascript
const feedList = document.getElementById('feed-list');
const emptyState = document.getElementById('empty-state');
const contextMenu = document.getElementById('context-menu');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalInput = document.getElementById('modal-input');
const modalFields = document.getElementById('modal-fields');
const modalName = document.getElementById('modal-name');
const modalFeedUrl = document.getElementById('modal-feed-url');
const modalSiteUrl = document.getElementById('modal-site-url');
const modalError = document.getElementById('modal-error');
const modalSave = document.getElementById('modal-save');
const modalCancel = document.getElementById('modal-cancel');

let feeds = [];
let selectedFeedId = null;
let editingFeed = null;
let draggedItem = null;

// Storage access via background page
const backgroundPage = browser.extension.getBackgroundPage();
const Storage = backgroundPage.Storage;
const Badge = backgroundPage.Badge;

async function loadFeeds() {
  feeds = await Storage.getFeeds();
  feeds.sort((a, b) => (a.order || 0) - (b.order || 0));
  renderFeeds();
}

function renderFeeds() {
  feedList.innerHTML = '';

  if (feeds.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  feeds.forEach(feed => {
    const item = document.createElement('div');
    item.className = 'feed-item' + (feed.unreadCount > 0 ? ' unread' : '');
    item.dataset.id = feed.id;
    item.draggable = true;

    const name = document.createElement('span');
    name.className = 'feed-name';
    name.textContent = feed.name;
    item.appendChild(name);

    if (feed.unreadCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'feed-badge';
      badge.textContent = feed.unreadCount > 50 ? '50+' : feed.unreadCount;
      item.appendChild(badge);
    }

    // Click to open site
    item.addEventListener('click', () => openFeed(feed));

    // Right-click for context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e, feed.id);
    });

    // Drag events
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);

    feedList.appendChild(item);
  });
}

async function openFeed(feed) {
  // Open site in new tab
  browser.tabs.create({ url: feed.siteUrl });

  // Mark as read
  await Storage.updateFeed(feed.id, { unreadCount: 0 });
  await Badge.refresh();

  // Close popup
  window.close();
}

// Context Menu
function showContextMenu(e, feedId) {
  selectedFeedId = feedId;

  const addItem = contextMenu.querySelector('[data-action="add"]');
  const editItem = contextMenu.querySelector('[data-action="edit"]');
  const deleteItem = contextMenu.querySelector('[data-action="delete"]');

  if (feedId) {
    addItem.style.display = 'none';
    editItem.style.display = 'block';
    deleteItem.style.display = 'block';
  } else {
    addItem.style.display = 'block';
    editItem.style.display = 'none';
    deleteItem.style.display = 'none';
  }

  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
  contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
  contextMenu.classList.add('hidden');
  selectedFeedId = null;
}

// Right-click on empty area
document.body.addEventListener('contextmenu', (e) => {
  if (e.target === document.body || e.target === feedList || e.target === emptyState) {
    e.preventDefault();
    showContextMenu(e, null);
  }
});

document.addEventListener('click', hideContextMenu);

contextMenu.addEventListener('click', async (e) => {
  const action = e.target.dataset.action;

  if (action === 'add') {
    showModal('add');
  } else if (action === 'edit') {
    const feed = feeds.find(f => f.id === selectedFeedId);
    if (feed) showModal('edit', feed);
  } else if (action === 'delete') {
    await Storage.deleteFeed(selectedFeedId);
    await Badge.refresh();
    await loadFeeds();
  }

  hideContextMenu();
});

// Modal
function showModal(mode, feed = null) {
  editingFeed = feed;
  modalError.classList.add('hidden');

  if (mode === 'add') {
    modalTitle.textContent = 'Add Feed';
    modalInput.value = '';
    modalInput.style.display = 'block';
    modalFields.classList.add('hidden');
    modalInput.placeholder = 'Site or feed URL';
  } else {
    modalTitle.textContent = 'Edit Feed';
    modalInput.style.display = 'none';
    modalFields.classList.remove('hidden');
    modalName.value = feed.name;
    modalFeedUrl.value = feed.feedUrl;
    modalSiteUrl.value = feed.siteUrl;
  }

  modalOverlay.classList.remove('hidden');

  if (mode === 'add') {
    modalInput.focus();
  } else {
    modalName.focus();
  }
}

function hideModal() {
  modalOverlay.classList.add('hidden');
  editingFeed = null;
}

modalCancel.addEventListener('click', hideModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) hideModal();
});

modalSave.addEventListener('click', async () => {
  if (editingFeed) {
    // Edit mode
    await Storage.updateFeed(editingFeed.id, {
      name: modalName.value.trim(),
      feedUrl: modalFeedUrl.value.trim(),
      siteUrl: modalSiteUrl.value.trim()
    });
    hideModal();
    await loadFeeds();
  } else {
    // Add mode
    const url = modalInput.value.trim();
    if (!url) return;

    modalSave.disabled = true;
    modalError.classList.add('hidden');

    const discovered = await FeedParser.discover(url);

    if (discovered) {
      await Storage.addFeed({
        name: discovered.title,
        feedUrl: discovered.feedUrl,
        siteUrl: discovered.siteUrl
      });
      hideModal();
      await loadFeeds();

      // Check the new feed immediately
      const bgPage = browser.extension.getBackgroundPage();
      bgPage.checkAllFeeds();
    } else {
      modalError.textContent = 'No RSS feed found at this URL';
      modalError.classList.remove('hidden');
    }

    modalSave.disabled = false;
  }
});

// Drag and Drop
function handleDragStart(e) {
  draggedItem = e.target;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const item = e.target.closest('.feed-item');
  if (item && item !== draggedItem) {
    item.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  const item = e.target.closest('.feed-item');
  if (item) {
    item.classList.remove('drag-over');
  }
}

async function handleDrop(e) {
  e.preventDefault();

  const targetItem = e.target.closest('.feed-item');
  if (!targetItem || targetItem === draggedItem) return;

  targetItem.classList.remove('drag-over');

  const draggedId = draggedItem.dataset.id;
  const targetId = targetItem.dataset.id;

  // Reorder in array
  const draggedIndex = feeds.findIndex(f => f.id === draggedId);
  const targetIndex = feeds.findIndex(f => f.id === targetId);

  const [removed] = feeds.splice(draggedIndex, 1);
  feeds.splice(targetIndex, 0, removed);

  // Save new order
  const orderedIds = feeds.map(f => f.id);
  await Storage.reorderFeeds(orderedIds);

  renderFeeds();
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });
  draggedItem = null;
}

// Initialize
loadFeeds();
```

**Step 2: Test full functionality**

1. Reload extension in `about:debugging`
2. Click RSS icon → should show empty state
3. Right-click → "Add new feed..." → enter `https://bbc.com`
4. Verify: Feed is added with name "BBC"
5. Right-click feed → "Edit feed..." → change name → Save
6. Verify: Name is updated
7. Click feed → should open BBC in new tab
8. Right-click feed → "Delete feed"
9. Verify: Feed is removed

**Step 3: Test drag and drop**

1. Add 2-3 feeds
2. Drag one feed to a new position
3. Verify: Order is preserved after reloading popup

**Step 4: Commit**

```bash
git add popup/popup.js
git commit -m "feat: add popup JavaScript with feed management and drag-drop"
```

---

## Task 7: Final Testing and Polish

**Step 1: Full integration test**

1. Reload extension in `about:debugging`
2. Add 3 feeds (e.g., BBC, Hacker News, a blog)
3. Wait for feeds to be checked (or trigger via console: `checkAllFeeds()`)
4. Verify: Badge shows total unread count
5. Click a feed with unread posts
6. Verify: Opens site, unread count resets, badge updates
7. Reorder feeds via drag-drop
8. Close and reopen popup
9. Verify: Order is preserved

**Step 2: Test edge cases**

1. Add invalid URL → should show error
2. Add URL with no RSS → should show error
3. Delete all feeds → should show empty state
4. Add feed with very long name → should truncate with ellipsis

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Firefox RSS extension v1.0"
```

---

## Summary

The implementation is broken into 7 tasks:

1. **Manifest and Icons** - Extension foundation
2. **Feed Parser** - RSS/Atom parsing and auto-discovery
3. **Background Script** - Storage, badge, hourly checking
4. **Popup HTML** - Structure for feed list and modals
5. **Popup CSS** - Firefox-native styling
6. **Popup JavaScript** - Feed rendering, interactions, drag-drop
7. **Final Testing** - Integration and edge cases

Each task can be committed independently. The extension will be functional after Task 6.
