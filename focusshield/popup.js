// FocusShield Popup Controller

const CIRCUMFERENCE = 2 * Math.PI * 68;
let selectedMode = "focus";
let selectedMin = 25;
let tickInterval = null;

const els = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
  modeBtns: document.querySelectorAll(".mode-btn"),
  ring: document.getElementById("ring-progress"),
  timeDisplay: document.getElementById("time-display"),
  modeLabel: document.getElementById("mode-label"),
  btnToggle: document.getElementById("btn-toggle-timer"),
  todayStats: document.getElementById("today-stats"),
  sessionsCount: document.getElementById("sessions-count"),
  siteInput: document.getElementById("site-input"),
  btnAddSite: document.getElementById("btn-add-site"),
  sitesList: document.getElementById("sites-list")
};

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    els.panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

els.modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    els.modeBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMode = btn.dataset.mode;
    selectedMin = Number(btn.dataset.min);
    els.timeDisplay.textContent = `${String(selectedMin).padStart(2, "0")}:00`;
    els.ring.style.strokeDashoffset = "0";
    els.ring.style.stroke = selectedMode === "focus" ? "#10b981" : "#38bdf8";
  });
});

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function renderUI() {
  const { fsState } = await chrome.storage.local.get({ fsState: null });
  if (!fsState) return;

  els.todayStats.textContent = `${fsState.minutesToday || 0}m today`;
  els.sessionsCount.textContent = fsState.sessionsToday || 0;
  renderSites(fsState.blockedSites || []);

  if (fsState.running && fsState.endTime) {
    const remaining = fsState.endTime - Date.now();
    if (remaining > 0) {
      const totalMs = fsState.durationMin * 60000;
      const ratio = Math.max(0, Math.min(1, remaining / totalMs));
      els.timeDisplay.textContent = formatTime(remaining);
      els.ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - ratio));
      els.ring.style.stroke = fsState.mode === "focus" ? "#10b981" : "#38bdf8";
      els.modeLabel.textContent = fsState.mode === "focus" ? "Shield active" : "Break time";
      els.btnToggle.textContent = "Stop Session";
      els.btnToggle.classList.add("stop");
      return;
    }
  }

  els.timeDisplay.textContent = `${String(selectedMin).padStart(2, "0")}:00`;
  els.ring.style.strokeDashoffset = "0";
  els.modeLabel.textContent = "Ready to focus";
  els.btnToggle.textContent = selectedMode === "focus" ? "Start Focus" : "Start Break";
  els.btnToggle.classList.remove("stop");
}

function renderSites(sites) {
  els.sitesList.innerHTML = "";
  sites.forEach((site) => {
    const row = document.createElement("div");
    row.className = "site-row";
    row.innerHTML = `<span>${site}</span>`;

    const del = document.createElement("button");
    del.className = "site-del";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      const { fsState } = await chrome.storage.local.get({ fsState: null });
      if (!fsState) return;
      fsState.blockedSites = fsState.blockedSites.filter((s) => s !== site);
      await chrome.storage.local.set({ fsState });
      renderSites(fsState.blockedSites);
    });

    row.appendChild(del);
    els.sitesList.appendChild(row);
  });
}

els.btnToggle.addEventListener("click", async () => {
  const { fsState } = await chrome.storage.local.get({ fsState: null });
  if (fsState?.running) {
    await chrome.runtime.sendMessage({ type: "STOP_TIMER" });
  } else {
    await chrome.runtime.sendMessage({
      type: "START_TIMER",
      mode: selectedMode,
      minutes: selectedMin
    });
  }
  renderUI();
});

async function addSite() {
  const raw = els.siteInput.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!raw || !raw.includes(".")) return;
  const { fsState } = await chrome.storage.local.get({ fsState: null });
  if (!fsState) return;
  if (!fsState.blockedSites.includes(raw)) {
    fsState.blockedSites.push(raw);
    await chrome.storage.local.set({ fsState });
  }
  els.siteInput.value = "";
  renderSites(fsState.blockedSites);
}

els.btnAddSite.addEventListener("click", addSite);
els.siteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});

renderUI();
tickInterval = setInterval(renderUI, 1000);
window.addEventListener("unload", () => clearInterval(tickInterval));
