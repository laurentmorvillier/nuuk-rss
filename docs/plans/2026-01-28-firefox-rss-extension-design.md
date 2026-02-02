# Firefox RSS Extension Design

## Overview

A Firefox extension that acts as a lightweight RSS reader, displaying in the toolbar with unread post counts. Users visit the actual sites to read content - the extension simply tracks what's new.

## Core Behavior

- **Toolbar icon**: Classic orange RSS icon with muted gray badge showing total unread count
- **Badge**: Hidden when zero unread; shows "50+" for large counts
- **Popup**: Dropdown list of RSS feeds, styled like Firefox bookmarks
- **Feed display**: Bold with badge count if unread; normal text if no new posts
- **Click action**: Opens site homepage in new tab, marks all posts as read
- **Feed order**: Custom order via drag-and-drop (entire row draggable)

## Feed Management

All via right-click context menus:

- **Add feed**: Right-click empty area → "Add new feed..." → modal with URL input
- **Edit feed**: Right-click feed → "Edit feed..." → modal with name/URLs
- **Delete feed**: Right-click feed → "Delete feed" → immediate deletion (no confirmation)

### Adding Feeds

When adding a URL:
1. Try auto-discovery of RSS/Atom feed from the page
2. If found: save with discovered name and URLs
3. If URL is a direct feed: save directly
4. If neither: show error "No RSS feed found at this URL"

## Background Processing

- **Check frequency**: Every 60 minutes via `browser.alarms`
- **Startup check**: Also runs once when browser starts
- **Parallel fetching**: All feeds checked simultaneously
- **Error handling**: Failed feeds skip silently, keep previous count

### Post Tracking

Each feed stores:
- List of known post IDs (or URLs as fallback)
- Unread count = new posts since last click

New posts are identified by comparing fetched IDs against stored known IDs.

## Data Model

```javascript
Feed {
  id: string,           // unique identifier
  name: string,         // display name (editable)
  feedUrl: string,      // RSS/Atom feed URL
  siteUrl: string,      // homepage URL (opened on click)
  order: number,        // custom sort order
  lastChecked: number,  // timestamp
  knownPostIds: array,  // post IDs already seen
  unreadCount: number   // new posts since last click
}
```

## Storage

- **Method**: `browser.storage.local`
- **Sync**: None (local only)
- **Data**: Feed list with known post IDs and read states

## File Structure

```
firefox_rss/
├── manifest.json          # Extension config, permissions
├── background.js          # Feed checking, storage, badge updates
├── popup/
│   ├── popup.html         # Dropdown structure
│   ├── popup.css          # Styling (Firefox-native look)
│   └── popup.js           # List rendering, drag-drop, context menus
├── icons/
│   ├── rss-16.svg
│   ├── rss-32.svg
│   ├── rss-48.svg
│   └── rss-96.svg
└── utils/
    └── feed-parser.js     # RSS/Atom parsing, auto-discovery
```

## Permissions

- `storage` - Save feeds and read states locally
- `alarms` - Schedule hourly checks
- `<all_urls>` - Fetch RSS feeds from any site

## Browser Compatibility

- Firefox 57+
- Manifest V2

## Future Considerations (Not in Scope)

- Firefox Sync integration
- Bookmark folder import
- Individual post viewing
- Notifications
