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
    // Get the site link (direct child of channel, not inside item)
    const siteLink = channel.querySelector(':scope > link')?.textContent || '';
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

    return { title, siteLink, posts };
  },

  _parseAtom(feed) {
    const title = feed.querySelector('title')?.textContent || 'Untitled Feed';
    // Get the site link (alternate link at feed level)
    const siteLinkEl = feed.querySelector(':scope > link[rel="alternate"]') ||
                       feed.querySelector(':scope > link:not([rel="self"])');
    const siteLink = siteLinkEl?.getAttribute('href') || '';
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

    return { title, siteLink, posts };
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
      // Use the site link from the feed, or fall back to the feed's origin
      let siteUrl = directFeed.siteLink;
      if (!siteUrl) {
        try {
          siteUrl = new URL(url).origin;
        } catch (e) {
          siteUrl = url;
        }
      }
      return {
        feedUrl: url,
        siteUrl: siteUrl,
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
