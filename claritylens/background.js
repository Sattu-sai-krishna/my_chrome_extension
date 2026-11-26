// ClarityLens Background Service Worker (Manifest V3)

const MENU_ID = "claritylens-clip-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save snippet to ClarityLens",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;

  const text = info.selectionText.trim();
  if (!text) return;

  const clip = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    title: tab?.title || "Untitled Page",
    url: tab?.url || "",
    createdAt: new Date().toISOString()
  };

  const data = await chrome.storage.local.get({ clarityClips: [] });
  const updated = [clip, ...data.clarityClips].slice(0, 200);
  await chrome.storage.local.set({ clarityClips: updated });

  // Brief visual confirmation on the extension badge
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#4F46E5" });
    await chrome.action.setBadgeText({ text: "+1" });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "" });
    }, 1800);
  } catch (_) {
    // Ignore badge errors on restricted contexts
  }
});
