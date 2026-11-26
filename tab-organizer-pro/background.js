// Background service worker for Tab Organizer Pro

let tabData = [];

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ tabData: [] });
    chrome.storage.local.set({ savedSessions: [] });
});

// Track all tab events
chrome.tabs.onCreated.addListener((tab) => {
    addTabToData(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.title || changeInfo.url) {
        updateTabInData(tab);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    removeTabFromData(tabId);
});

// Add tab to storage
function addTabToData(tab) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) return;
    
    tabData = [...tabData.filter(t => t.id !== tab.id)];
    tabData.push({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        lastAccessed: tab.lastAccessed || Date.now(),
        active: tab.active
    });
    
    chrome.storage.local.set({ tabData: tabData });
    chrome.runtime.sendMessage({ action: 'refresh' });
}

// Update tab in storage
function updateTabInData(tab) {
    if (!tab.url || tab.url.startsWith('chrome://')) return;
    
    const index = tabData.findIndex(t => t.id === tab.id);
    if (index >= 0) {
        tabData[index] = {
            ...tabData[index],
            title: tab.title,
            url: tab.url,
            lastAccessed: tab.lastAccessed || Date.now(),
            active: tab.active
        };
    } else {
        tabData.push({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            lastAccessed: tab.lastAccessed || Date.now(),
            active: tab.active
        });
    }
    
    chrome.storage.local.set({ tabData: tabData });
}

// Remove tab from storage
function removeTabFromData(tabId) {
    tabData = tabData.filter(t => t.id !== tabId);
    chrome.storage.local.set({ tabData: tabData });
    chrome.runtime.sendMessage({ action: 'refresh' });
}

// Load existing tabs on startup
chrome.tabs.query({}, (tabs) => {
    tabData = tabs
        .filter(t => t.url && !t.url.startsWith('chrome://'))
        .map(t => ({
            id: t.id,
            title: t.title,
            url: t.url,
            lastAccessed: t.lastAccessed || Date.now(),
            active: t.active
        }));
    chrome.storage.local.set({ tabData: tabData });
});

// Periodic optimization check
chrome.alarms.create('memoryCheck', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'memoryCheck') {
        optimizeTabs();
    }
});

function optimizeTabs() {
    chrome.tabs.query({}, (tabs) => {
        const activeTabId = tabs.find(t => t.active)?.id;
        
        tabs.forEach(tab => {
            // Unload inactive tabs to save memory
            if (!tab.active && Date.now() - (tab.lastAccessed || 0) > 30 * 60 * 1000) {
                chrome.tabs.discard(tab.id);
            }
        });
    });
}
