const feedList = document.getElementById("feed-list");
const emptyState = document.getElementById("empty-state");
const addButton = document.getElementById("add-button");
const contextMenu = document.getElementById("context-menu");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalInput = document.getElementById("modal-input");
const modalFields = document.getElementById("modal-fields");
const modalName = document.getElementById("modal-name");
const modalFeedUrl = document.getElementById("modal-feed-url");
const modalSiteUrl = document.getElementById("modal-site-url");
const modalError = document.getElementById("modal-error");
const modalSave = document.getElementById("modal-save");
const modalCancel = document.getElementById("modal-cancel");

let feeds = [];
let selectedFeedId = null;
let editingFeed = null;
let draggedItem = null;

// Storage - direct access to browser.storage.local
const Storage = {
  async getFeeds() {
    const result = await browser.storage.local.get("feeds");
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
    const index = feeds.findIndex((f) => f.id === id);
    if (index !== -1) {
      feeds[index] = { ...feeds[index], ...updates };
      await this.saveFeeds(feeds);
    }
  },

  async deleteFeed(id) {
    const feeds = await this.getFeeds();
    const filtered = feeds.filter((f) => f.id !== id);
    await this.saveFeeds(filtered);
  },

  async reorderFeeds(orderedIds) {
    const feeds = await this.getFeeds();
    orderedIds.forEach((id, index) => {
      const feed = feeds.find((f) => f.id === id);
      if (feed) feed.order = index;
    });
    await this.saveFeeds(feeds);
  },
};

// Badge - update toolbar badge
const Badge = {
  update(count) {
    if (count === 0) {
      browser.browserAction.setBadgeText({ text: "" });
    } else {
      const text = count > 50 ? "50+" : count.toString();
      browser.browserAction.setBadgeText({ text });
    }
    browser.browserAction.setBadgeBackgroundColor({ color: "#555555" });
  },

  async refresh() {
    const feeds = await Storage.getFeeds();
    const total = feeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);
    this.update(total);
  },
};

async function loadFeeds() {
  feeds = await Storage.getFeeds();
  feeds.sort((a, b) => (a.order || 0) - (b.order || 0));
  renderFeeds();
}

function renderFeeds() {
  feedList.innerHTML = "";

  if (feeds.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  feeds.forEach((feed) => {
    const item = document.createElement("div");
    item.className = "feed-item" + (feed.unreadCount > 0 ? " unread" : "");
    item.dataset.id = feed.id;
    item.draggable = true;

    const favicon = document.createElement("img");
    favicon.className = "feed-favicon";
    try {
      const domain = new URL(feed.siteUrl).hostname;
      favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      favicon.src =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect fill="%23ddd" width="16" height="16" rx="2"/></svg>';
    }
    favicon.alt = "";
    item.appendChild(favicon);

    const name = document.createElement("span");
    name.className = "feed-name";
    name.textContent = feed.name;
    item.appendChild(name);

    if (feed.unreadCount > 0) {
      const badge = document.createElement("span");
      badge.className = "feed-badge";
      badge.textContent = feed.unreadCount > 50 ? "50+" : feed.unreadCount;
      item.appendChild(badge);
    }

    // Click to open site
    item.addEventListener("click", () => openFeed(feed));

    // Right-click for context menu
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu(e, feed.id);
    });

    // Drag events
    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("dragleave", handleDragLeave);
    item.addEventListener("drop", handleDrop);
    item.addEventListener("dragend", handleDragEnd);

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
    addItem.style.display = "none";
    editItem.style.display = "block";
    deleteItem.style.display = "block";
  } else {
    addItem.style.display = "block";
    editItem.style.display = "none";
    deleteItem.style.display = "none";
  }

  // Position menu, keeping it within popup bounds
  contextMenu.classList.remove("hidden");

  const menuWidth = contextMenu.offsetWidth;
  const menuHeight = contextMenu.offsetHeight;
  const popupWidth = document.body.offsetWidth;
  const popupHeight = document.body.offsetHeight;

  let x = e.clientX;
  let y = e.clientY;

  // Keep menu within horizontal bounds
  if (x + menuWidth > popupWidth - 10) {
    x = popupWidth - menuWidth - 10;
  }

  // Keep menu within vertical bounds
  if (y + menuHeight > popupHeight - 10) {
    y = popupHeight - menuHeight - 10;
  }

  contextMenu.style.left = Math.max(10, x) + "px";
  contextMenu.style.top = Math.max(10, y) + "px";
}

function hideContextMenu() {
  contextMenu.classList.add("hidden");
  selectedFeedId = null;
}

// Right-click on empty area
document.body.addEventListener("contextmenu", (e) => {
  if (
    e.target === document.body ||
    e.target === feedList ||
    e.target === emptyState
  ) {
    e.preventDefault();
    showContextMenu(e, null);
  }
});

document.addEventListener("click", (e) => {
  // Only hide if context menu is visible and click is outside it
  if (
    !contextMenu.classList.contains("hidden") &&
    !contextMenu.contains(e.target)
  ) {
    hideContextMenu();
  }
});

contextMenu.addEventListener("click", async (e) => {
  const action = e.target.dataset.action;

  if (action === "add") {
    showModal("add");
  } else if (action === "edit") {
    const feed = feeds.find((f) => f.id === selectedFeedId);
    if (feed) showModal("edit", feed);
  } else if (action === "delete") {
    await Storage.deleteFeed(selectedFeedId);
    await Badge.refresh();
    await loadFeeds();
  }

  hideContextMenu();
});

// Modal
function showModal(mode, feed = null) {
  editingFeed = feed;
  modalError.classList.add("hidden");

  if (mode === "add") {
    modalTitle.textContent = "Add Feed";
    modalInput.value = "";
    modalInput.style.display = "block";
    modalFields.classList.add("hidden");
    modalInput.placeholder = "Site or feed URL";
  } else {
    modalTitle.textContent = "Edit Feed";
    modalInput.style.display = "none";
    modalFields.classList.remove("hidden");
    modalName.value = feed.name;
    modalFeedUrl.value = feed.feedUrl;
    modalSiteUrl.value = feed.siteUrl;
  }

  modalOverlay.classList.remove("hidden");

  if (mode === "add") {
    modalInput.focus();
  } else {
    modalName.focus();
  }
}

function hideModal() {
  modalOverlay.classList.add("hidden");
  editingFeed = null;
}

modalCancel.addEventListener("click", hideModal);

addButton.addEventListener("click", () => showModal("add"));

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) hideModal();
});

// Trigger save on Enter key
modalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    modalSave.click();
  }
});

modalSave.addEventListener("click", async () => {
  if (editingFeed) {
    // Edit mode
    await Storage.updateFeed(editingFeed.id, {
      name: modalName.value.trim(),
      feedUrl: modalFeedUrl.value.trim(),
      siteUrl: modalSiteUrl.value.trim(),
    });
    hideModal();
    await loadFeeds();
  } else {
    // Add mode
    const url = modalInput.value.trim();
    if (!url) return;

    // Show loading state
    const originalText = modalSave.textContent;
    modalSave.textContent = "Adding...";
    modalSave.disabled = true;
    modalError.classList.add("hidden");

    try {
      const discovered = await FeedParser.discover(url);

      if (discovered) {
        await Storage.addFeed({
          name: discovered.title,
          feedUrl: discovered.feedUrl,
          siteUrl: discovered.siteUrl,
        });
        hideModal();
        await loadFeeds();
      } else {
        modalError.textContent = "No RSS feed found at this URL";
        modalError.classList.remove("hidden");
      }
    } catch (err) {
      modalError.textContent =
        "Error: " + (err.message || "Could not add feed");
      modalError.classList.remove("hidden");
    }

    modalSave.textContent = originalText;
    modalSave.disabled = false;
  }
});

// Drag and Drop
function handleDragStart(e) {
  draggedItem = e.target;
  e.target.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  const item = e.target.closest(".feed-item");
  if (item && item !== draggedItem) {
    item.classList.add("drag-over");
  }
}

function handleDragLeave(e) {
  const item = e.target.closest(".feed-item");
  if (item) {
    item.classList.remove("drag-over");
  }
}

async function handleDrop(e) {
  e.preventDefault();

  const targetItem = e.target.closest(".feed-item");
  if (!targetItem || targetItem === draggedItem) return;

  targetItem.classList.remove("drag-over");

  const draggedId = draggedItem.dataset.id;
  const targetId = targetItem.dataset.id;

  // Reorder in array
  const draggedIndex = feeds.findIndex((f) => f.id === draggedId);
  const targetIndex = feeds.findIndex((f) => f.id === targetId);

  const [removed] = feeds.splice(draggedIndex, 1);
  feeds.splice(targetIndex, 0, removed);

  // Save new order
  const orderedIds = feeds.map((f) => f.id);
  await Storage.reorderFeeds(orderedIds);

  renderFeeds();
}

function handleDragEnd(e) {
  e.target.classList.remove("dragging");
  document.querySelectorAll(".drag-over").forEach((el) => {
    el.classList.remove("drag-over");
  });
  draggedItem = null;
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadFeeds();
  } catch (e) {
    console.error("Failed to load feeds:", e);
  }
});
