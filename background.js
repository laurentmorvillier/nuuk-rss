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
  const isFirstCheck = feed.lastChecked === null;

  let newCount = 0;
  const updatedKnownIds = [...(feed.knownPostIds || [])];

  for (const id of newPostIds) {
    if (!knownIds.has(id)) {
      // Only count as unread if this isn't the first check
      if (!isFirstCheck) {
        newCount++;
      }
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

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'checkFeeds') {
    checkAllFeeds().then(() => sendResponse({ done: true }));
    return true; // Keep channel open for async response
  }
});

// Initialize badge
Badge.refresh();
