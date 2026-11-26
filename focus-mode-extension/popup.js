class FocusMode {
    constructor() {
        this.timeLeft = 25 * 60;
        this.timer = null;
        this.isRunning = false;
        this.focusDuration = 25;
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadStats();
        this.bindEvents();
        this.updateDisplay();
    }

    bindEvents() {
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('stopBtn').addEventListener('click', () => this.stop());
    }

    loadSettings() {
        const defaultSettings = {
            focusDuration: 25,
            breakDuration: 5,
            dailyGoal: 60
        };
        chrome.storage.sync.get(defaultSettings, (settings) => {
            this.focusDuration = settings.focusDuration;
            this.timeLeft = this.focusDuration * 60;
        });
    }

    loadStats() {
        chrome.storage.local.get({ sessionsToday: 0, totalMinutes: 0 }, (data) => {
            document.getElementById('stats').textContent = 
                `Sess. today: ${data.sessionsToday} | Total: ${Math.floor(data.totalMinutes/60)}h`;
        });
    }

    start() {
        if (this.timer) return;
        
        this.isRunning = true;
        this.recordSessionStart();
        
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: activateFocusMode
                });
            });
        });

        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            
            if (this.timeLeft <= 0) {
                this.stop();
            }
        }, 1000);
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;
        this.isRunning = false;
        this.timeLeft = this.focusDuration * 60;
        this.updateDisplay();
        
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: deactivateFocusMode
                });
            });
        });
        
        this.recordSessionEnd();
    }

    updateDisplay() {
        const mins = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
        const secs = (this.timeLeft % 60).toString().padStart(2, '0');
        document.getElementById('timer').textContent = `${mins}:${secs}`;
    }

    recordSessionStart() {
        chrome.storage.local.get({ sessionStart: null }, (data) => {
            chrome.storage.local.set({ sessionStart: Date.now() });
        });
    }

    recordSessionEnd() {
        chrome.storage.local.get({ sessionsToday: 0, totalMinutes: 0, sessionStart: null }, (data) => {
            if (data.sessionStart) {
                const duration = Math.floor((Date.now() - data.sessionStart) / 60000);
                const newTotal = data.totalMinutes + duration;
                const newCount = duration > 5 ? data.sessionsToday + 1 : data.sessionsToday;
                chrome.storage.local.set({ 
                    sessionsToday: newCount, 
                    totalMinutes: newTotal,
                    sessionStart: null
                });
                this.loadStats();
            }
        });
    }
}

function activateFocusMode() {
    const style = document.createElement('style');
    style.id = 'focus-mode-overlay';
    style.textContent = `
        body { 
            filter: blur(2px) !important; 
            overflow: hidden !important;
            background: #1a1a2e !important;
        }
        a, img, video { display: none !important; }
        .focus-mode-content { display: none !important; }
    `;
    document.head.appendChild(style);
    
    const overlay = document.createElement('div');
    overlay.id = 'focus-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(26, 26, 46, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        flex-direction: column;
        text-align: center;
        padding: 20px;
    `;
    overlay.innerHTML = `
        <h2 style="color: #fff; font-size: 24px; margin-bottom: 16px;">🎯 Focus Mode Active</h2>
        <p style="color: #888; margin-bottom: 24px;">You're in a distraction-free session.</p>
        <button id="close-focus" style="
            padding: 12px 24px;
            background: #4ade80;
            border: none;
            color: #000;
            font-weight: 500;
            border-radius: 8px;
            cursor: pointer;
        ">Continue Browsing</button>
    `;
    document.body.appendChild(overlay);
    
    document.body.style.pointerEvents = 'none';
    overlay.querySelector('button').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'deactivateFocus' });
    });
}

function deactivateFocusMode() {
    const overlay = document.getElementById('focus-overlay');
    const style = document.getElementById('focus-mode-overlay');
    
    if (overlay) overlay.remove();
    if (style) style.remove();
    document.body.style.filter = 'none';
    document.body.style.pointerEvents = '';
}

new FocusMode();

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'deactivateFocus') {
        deactivateFocusMode();
    }
});
