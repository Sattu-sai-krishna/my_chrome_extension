class TabOrganizer {
    constructor() {
        this.tabs = [];
        this.filteredTabs = [];
        this.categories = {};
        this.init();
    }

    init() {
        this.loadData();
        this.bindEvents();
        this.updateStats();
        this.renderTabs();
    }

    loadData() {
        const defaultSettings = {
            focusDuration: 25,
            breakDuration: 5,
            dailyGoal: 60,
            sessionsToday: 0,
            totalMinutes: 0
        };
        chrome.storage.sync.get(defaultSettings, (settings) => {
            this.settings = settings;
        });
    }

    bindEvents() {
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterTabs(e.target.value);
        });
        document.getElementById('closeInactive').addEventListener('click', () => this.closeInactiveTabs());
        document.getElementById('saveSession').addEventListener('click', () => this.saveSession());
    }

    updateStats() {
        // Load tabs from storage (simulated)
        chrome.storage.local.get(['tabData'], (data) => {
            this.tabs = data.tabData || [];
            this.filteredTabs = [...this.tabs];
            this.categorizeTabs();
            
            // Update stats
            document.getElementById('tabCount').textContent = this.tabs.length;
            document.getElementById('sessionsToday').textContent = this.settings.sessionsToday || 0;
            
            // Calculate memory estimate
            const memoryEstimate = Math.min(100, this.tabs.length * 2 + Math.floor(Math.random() * 20));
            document.getElementById('memoryUsage').textContent = memoryEstimate + '%';
        });
    }

    categorizeTabs() {
        this.categories = {};
        
        const categories = [
            { name: 'Work Tools', keywords: ['docs', 'slack', 'teams', 'trello', 'asana', 'notion', 'github', 'gitlab', 'jira'] },
            { name: 'Research', keywords: ['wikipedia', 'scholar', 'research', 'papers', 'academia', 'jstor', 'arxiv', 'google scholar'] },
            { name: 'News & Info', keywords: ['news', 'cnn', 'bbc', 'nytimes', 'reuters', 'bloomberg'] },
            { name: 'Social Media', keywords: ['facebook', 'twitter', 'instagram', 'linkedin', 'reddit', 'tiktok', 'youtube', 'twitch'] },
            { name: 'Shopping', keywords: ['amazon', 'ebay', 'shop', 'buy', 'walmart', 'target', 'shopping'] },
            { name: 'Entertainment', keywords: ['netflix', 'spotify', 'hulu', 'disney', 'coursera', 'edx', 'udemy'] },
            { name: 'Travel', keywords: ['airbnb', 'booking', 'hotels', 'expedia', 'airline', 'tripadvisor'] },
            { name: 'Finance', keywords: ['bank', 'finance', 'investment', 'trading', 'chase', 'bofa', 'wells fargo'] }
        ];

        this.tabs.forEach(tab => {
            if (!tab.url) return;
            
            const url = tab.url.toLowerCase();
            let matchedCategory = 'Other';
            
            for (const cat of categories) {
                if (cat.keywords.some(kw => url.includes(kw))) {
                    matchedCategory = cat.name;
                    break;
                }
            }
            
            if (!this.categories[matchedCategory]) {
                this.categories[matchedCategory] = [];
            }
            this.categories[matchedCategory].push(tab);
        });
    }

    filterTabs(query) {
        if (!query) {
            this.filteredTabs = [...this.tabs];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredTabs = this.tabs.filter(tab => 
                (tab.title && tab.title.toLowerCase().includes(lowerQuery)) ||
                (tab.url && tab.url.toLowerCase().includes(lowerQuery))
            );
        }
        this.renderTabs();
    }

    renderTabs() {
        const container = document.getElementById('tabsContainer');
        container.innerHTML = '';

        // Get categorized tabs
        const categorized = {};
        this.filteredTabs.forEach(tab => {
            if (!tab.url) return;
            
            const url = tab.url.toLowerCase();
            let category = 'Other';
            
            // Simple categorization
            if (url.includes('docs') || url.includes('slack') || url.includes('trello')) category = 'Work Tools';
            else if (url.includes('wikipedia') || url.includes('scholar')) category = 'Research';
            else if (url.includes('news') || url.includes('cnn')) category = 'News';
            else if (url.includes('facebook') || url.includes('twitter')) category = 'Social';
            else if (url.includes('amazon') || url.includes('shop')) category = 'Shopping';
            else if (url.includes('netflix') || url.includes('youtube')) category = 'Entertainment';
            else if (url.includes('airbnb') || url.includes('booking')) category = 'Travel';
            else if (url.includes('bank') || url.includes('finance')) category = 'Finance';
            
            if (!categorized[category]) categorized[category] = [];
            categorized[category].push(tab);
        });

        // Render each category
        Object.entries(categorized).forEach(([categoryName, tabs]) => {
            if (tabs.length === 0) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'tab-group';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'group-header';
            
            const colorIndicator = document.createElement('div');
            colorIndicator.className = 'group-color';
            colorIndicator.style.backgroundColor = this.getCategoryColor(categoryName);
            
            const label = document.createElement('span');
            label.textContent = `${categoryName} (${tabs.length})`;
            
            headerDiv.appendChild(colorIndicator);
            headerDiv.appendChild(label);
            groupDiv.appendChild(headerDiv);

            tabs.forEach(tab => {
                const tabDiv = document.createElement('div');
                tabDiv.className = 'tab-item';
                tabDiv.addEventListener('click', () => {
                    chrome.tabs.update(tab.id, { active: true });
                });

                const favicon = document.createElement('img');
                favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=16`;
                favicon.className = 'favicon';
                favicon.onerror = () => { favicon.src = 'icons/icon-16.png'; };

                const title = document.createElement('span');
                title.className = 'tab-title';
                title.textContent = tab.title || new URL(tab.url).hostname;

                const closeBtn = document.createElement('button');
                closeBtn.className = 'tab-close';
                closeBtn.innerHTML = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    chrome.tabs.remove(tab.id);
                    this.removeTabFromStorage(tab.id);
                    setTimeout(() => this.updateStats(), 100);
                });

                tabDiv.appendChild(favicon);
                tabDiv.appendChild(title);
                tabDiv.appendChild(closeBtn);
                groupDiv.appendChild(tabDiv);
            });

            container.appendChild(groupDiv);
        });

        if (this.filteredTabs.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><p>No tabs found</p></div>';
        }
    }

    getCategoryColor(category) {
        const colors = {
            'Work Tools': '#4285f4',
            'Research': '#34a853',
            'News': '#fbbc05',
            'Social': '#ea4335',
            'Shopping': '#673ab7',
            'Entertainment': '#ff9800',
            'Travel': '#00bcd4',
            'Finance': '#9c27b0',
            'Other': '#9e9e9e'
        };
        return colors[category] || '#4285f4';
    }

    removeTabFromStorage(tabId) {
        chrome.storage.local.get(['tabData'], (data) => {
            const tabs = data.tabData || [];
            const filtered = tabs.filter(t => t.id !== tabId);
            chrome.storage.local.set({ tabData: filtered });
        });
    }

    closeInactiveTabs() {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (Date.now() - (tab.lastAccessed || 0) > 30 * 60 * 1000) { // 30 min
                    chrome.tabs.remove(tab.id);
                }
            });
            this.updateStats();
        });
    }

    saveSession() {
        chrome.storage.local.get(['savedSessions'], (data) => {
            const sessions = data.savedSessions || [];
            sessions.push({
                name: `Session ${new Date().toLocaleTimeString()}`,
                tabs: this.tabs,
                timestamp: Date.now()
            });
            chrome.storage.local.set({ savedSessions: sessions });
            alert('Session saved!');
        });
    }

    refresh() {
        this.updateStats();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.tabOrganizer = new TabOrganizer();
    });
} else {
    window.tabOrganizer = new TabOrganizer();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'refresh') {
        if (window.tabOrganizer) window.tabOrganizer.refresh();
    }
});
