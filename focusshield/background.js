// FocusShield Background Service Worker — Timer Alarms & Mindful Site Shield

const DEFAULT_BLOCKED = ["youtube.com", "instagram.com", "reddit.com", "x.com", "facebook.com"];

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get({ fsState: null });
  if (!data.fsState) {
    await chrome.storage.local.set({
      fsState: {
        running: false,
        mode: "focus", // "focus" | "break"
        endTime: null,
        durationMin: 25,
        blockedSites: DEFAULT_BLOCKED,
        sessionsToday: 0,
        minutesToday: 0,
        lastDate: new Date().toISOString().slice(0, 10),
        snoozeUntil: 0
      }
    });
  }
});

async function getState() {
  const { fsState } = await chrome.storage.local.get({ fsState: null });
  const today = new Date().toISOString().slice(0, 10);
  if (fsState && fsState.lastDate !== today) {
    fsState.sessionsToday = 0;
    fsState.minutesToday = 0;
    fsState.lastDate = today;
    await chrome.storage.local.set({ fsState });
  }
  return fsState;
}

async function updateBadge() {
  const state = await getState();
  if (!state || !state.running || !state.endTime) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const remainingMs = state.endTime - Date.now();
  if (remainingMs <= 0) {
    await completeSession(state);
    return;
  }

  const mins = Math.ceil(remainingMs / 60000);
  await chrome.action.setBadgeBackgroundColor({
    color: state.mode === "focus" ? "#10b981" : "#38bdf8"
  });
  await chrome.action.setBadgeText({ text: `${mins}m` });
}

async function completeSession(state) {
  if (state.mode === "focus") {
    state.sessionsToday += 1;
    state.minutesToday += state.durationMin;
  }
  state.running = false;
  state.endTime = null;
  await chrome.storage.local.set({ fsState: state });
  await chrome.alarms.clear("focusTick");
  await chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
  await chrome.action.setBadgeText({ text: "✓" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "focusTick") {
    await updateBadge();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const state = await getState();
    if (!state) return sendResponse({ ok: false });

    if (msg.type === "START_TIMER") {
      state.mode = msg.mode || "focus";
      state.durationMin = msg.minutes || 25;
      state.endTime = Date.now() + state.durationMin * 60000;
      state.running = true;
      await chrome.storage.local.set({ fsState: state });
      chrome.alarms.create("focusTick", { periodInMinutes: 0.5 });
      await updateBadge();
      sendResponse({ ok: true, state });
    } else if (msg.type === "STOP_TIMER") {
      state.running = false;
      state.endTime = null;
      await chrome.storage.local.set({ fsState: state });
      await chrome.alarms.clear("focusTick");
      await updateBadge();
      sendResponse({ ok: true, state });
    } else if (msg.type === "SNOOZE_BLOCK") {
      state.snoozeUntil = Date.now() + 2 * 60000;
      await chrome.storage.local.set({ fsState: state });
      sendResponse({ ok: true });
    }
  })();
  return true;
});

function matchesBlockedSite(url, blockedSites) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return blockedSites.some((site) => {
      const clean = site.replace(/^www\./, "").toLowerCase();
      return host === clean || host.endsWith(`.${clean}`);
    });
  } catch {
    return false;
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (!url || !url.startsWith("http")) return;

  const state = await getState();
  if (!state || !state.running || state.mode !== "focus") return;
  if (Date.now() < (state.snoozeUntil || 0)) return;

  if (matchesBlockedSite(url, state.blockedSites || [])) {
    const target = `${chrome.runtime.getURL("blocked.html")}?site=${encodeURIComponent(new URL(url).hostname)}&return=${encodeURIComponent(url)}`;
    chrome.tabs.update(tabId, { url: target });
  }
});
