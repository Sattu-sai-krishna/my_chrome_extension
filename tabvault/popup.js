// TabVault Popup Controller — Search, Dedupe, Native Tab Auto-Grouper & Workspaces

const GROUP_COLORS = ["blue", "purple", "cyan", "green", "pink", "orange", "yellow", "red"];

const els = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
  healthPill: document.getElementById("health-pill"),
  searchInput: document.getElementById("search-input"),
  clearSearch: document.getElementById("btn-clear-search"),
  openCount: document.getElementById("open-count"),
  wsCount: document.getElementById("ws-count"),
  dupeBadge: document.getElementById("dupe-badge"),
  btnAutoGroup: document.getElementById("btn-autogroup"),
  btnDedupe: document.getElementById("btn-dedupe"),
  btnCollapse: document.getElementById("btn-collapse"),
  toast: document.getElementById("toast"),
  tabsList: document.getElementById("tabs-list"),
  wsNameInput: document.getElementById("ws-name-input"),
  btnSaveWs: document.getElementById("btn-save-ws"),
  wsList: document.getElementById("ws-list")
};

let allTabs = [];

// Tab navigation
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    els.panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  setTimeout(() => els.toast.classList.add("hidden"), 2200);
}

function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") || u.protocol.replace(":", "");
  } catch {
    return "browser";
  }
}

function findDuplicates(tabs) {
  const seen = new Set();
  const dupes = [];
  for (const t of tabs) {
    if (!t.url) continue;
    if (seen.has(t.url)) dupes.push(t);
    else seen.add(t.url);
  }
  return dupes;
}

async function refreshTabs() {
  allTabs = await chrome.tabs.query({});
  const dupes = findDuplicates(allTabs);

  els.openCount.textContent = allTabs.length;
  els.healthPill.textContent = dupes.length
    ? `${allTabs.length} tabs · ${dupes.length} dupes`
    : `${allTabs.length} tabs`;
  els.healthPill.classList.toggle("busy", allTabs.length > 15 || dupes.length > 0);

  if (dupes.length > 0) {
    els.dupeBadge.textContent = dupes.length;
    els.dupeBadge.classList.remove("hidden");
  } else {
    els.dupeBadge.classList.add("hidden");
  }

  renderTabs(els.searchInput.value);
}

function renderTabs(filterText = "") {
  const q = filterText.trim().toLowerCase();
  const filtered = q
    ? allTabs.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(q) ||
          (t.url || "").toLowerCase().includes(q)
      )
    : allTabs;

  els.tabsList.innerHTML = "";
  if (filtered.length === 0) {
    els.tabsList.innerHTML = `<div class="empty-state">No tabs match "${filterText}".</div>`;
    return;
  }

  filtered.forEach((tab) => {
    const row = document.createElement("div");
    row.className = `tab-row${tab.active ? " current" : ""}`;

    const img = document.createElement("img");
    img.className = "tab-fav";
    img.src = tab.favIconUrl || "icons/icon16.png";
    img.onerror = () => {
      img.src = "icons/icon16.png";
    };

    const info = document.createElement("div");
    info.className = "tab-info";

    const title = document.createElement("div");
    title.className = "tab-title";
    title.textContent = tab.title || "Untitled Tab";

    const domain = document.createElement("div");
    domain.className = "tab-domain";
    domain.textContent = getDomain(tab.url);

    info.appendChild(title);
    info.appendChild(domain);

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "✕";
    closeBtn.title = "Close tab";
    closeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await chrome.tabs.remove(tab.id);
      refreshTabs();
    });

    row.addEventListener("click", async () => {
      await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.tabs.update(tab.id, { active: true });
      window.close();
    });

    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(closeBtn);
    els.tabsList.appendChild(row);
  });
}

// Search
els.searchInput.addEventListener("input", () => {
  const val = els.searchInput.value;
  els.clearSearch.classList.toggle("hidden", !val);
  renderTabs(val);
});

els.clearSearch.addEventListener("click", () => {
  els.searchInput.value = "";
  els.clearSearch.classList.add("hidden");
  renderTabs("");
  els.searchInput.focus();
});

// Auto-group tabs in current window by domain
els.btnAutoGroup.addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const byDomain = new Map();

  for (const t of tabs) {
    if (!t.url || !t.url.startsWith("http")) continue;
    const dom = getDomain(t.url);
    if (!byDomain.has(dom)) byDomain.set(dom, []);
    byDomain.get(dom).push(t.id);
  }

  let groupedCount = 0;
  let colorIdx = 0;
  for (const [domain, tabIds] of byDomain.entries()) {
    if (tabIds.length < 2) continue;
    try {
      const groupId = await chrome.tabs.group({ tabIds });
      const shortName = domain.split(".")[0];
      await chrome.tabGroups.update(groupId, {
        title: shortName.charAt(0).toUpperCase() + shortName.slice(1),
        color: GROUP_COLORS[colorIdx % GROUP_COLORS.length]
      });
      colorIdx++;
      groupedCount++;
    } catch (_) {
      // Ignore if tabGroups unsupported
    }
  }

  showToast(
    groupedCount > 0
      ? `Grouped ${groupedCount} site clusters!`
      : "Need 2+ tabs from the same site to group."
  );
  refreshTabs();
});

// Close duplicate tabs
els.btnDedupe.addEventListener("click", async () => {
  const dupes = findDuplicates(allTabs);
  if (dupes.length === 0) {
    showToast("No duplicate tabs found!");
    return;
  }
  await chrome.tabs.remove(dupes.map((d) => d.id));
  showToast(`Closed ${dupes.length} duplicate tab${dupes.length > 1 ? "s" : ""}!`);
  refreshTabs();
});

// Collapse all tab groups
els.btnCollapse.addEventListener("click", async () => {
  try {
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    for (const g of groups) {
      await chrome.tabGroups.update(g.id, { collapsed: true });
    }
    showToast(groups.length ? `Collapsed ${groups.length} groups` : "No tab groups to collapse");
  } catch {
    showToast("Tab groups unavailable");
  }
});

// Workspaces
async function renderWorkspaces() {
  const { tabVaultWorkspaces = [] } = await chrome.storage.local.get({ tabVaultWorkspaces: [] });
  els.wsCount.textContent = tabVaultWorkspaces.length;
  els.wsList.innerHTML = "";

  if (tabVaultWorkspaces.length === 0) {
    els.wsList.innerHTML = `<div class="empty-state">No saved workspaces yet. Save your current tabs above to free up memory and restore them anytime.</div>`;
    return;
  }

  tabVaultWorkspaces.forEach((ws) => {
    const card = document.createElement("div");
    card.className = "ws-card";

    card.innerHTML = `
      <div class="ws-top">
        <span class="ws-name">${ws.name}</span>
        <span class="ws-meta">${ws.urls.length} tabs · ${ws.date}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "ws-actions";

    const openBtn = document.createElement("button");
    openBtn.className = "ws-btn open";
    openBtn.textContent = "Open Window";
    openBtn.addEventListener("click", async () => {
      await chrome.windows.create({ url: ws.urls });
    });

    const delBtn = document.createElement("button");
    delBtn.className = "ws-btn del";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      const updated = tabVaultWorkspaces.filter((w) => w.id !== ws.id);
      await chrome.storage.local.set({ tabVaultWorkspaces: updated });
      renderWorkspaces();
    });

    actions.appendChild(openBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);
    els.wsList.appendChild(card);
  });
}

els.btnSaveWs.addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const urls = tabs.map((t) => t.url).filter((u) => u && u.startsWith("http"));
  if (urls.length === 0) return;

  const name = els.wsNameInput.value.trim() || `Session ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const { tabVaultWorkspaces = [] } = await chrome.storage.local.get({ tabVaultWorkspaces: [] });

  const ws = {
    id: `${Date.now()}`,
    name,
    urls,
    date: new Date().toLocaleDateString()
  };

  await chrome.storage.local.set({ tabVaultWorkspaces: [ws, ...tabVaultWorkspaces].slice(0, 30) });
  els.wsNameInput.value = "";
  renderWorkspaces();
});

// Init
refreshTabs();
renderWorkspaces();
