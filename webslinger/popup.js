// WebSlinger Popup Controller & Web-Swinger Rooftop Mini-Game

const QUOTES = [
  "\"With great power, there must also come great responsibility.\"",
  "\"Anyone can win a fight when the odds are easy. It's when the going's tough that there seems to be no chance.\"",
  "\"No matter how buried it gets, or lost you feel, you must promise me that you will hold on to hope.\"",
  "\"It's a leap of faith. That's all it is—a leap of faith.\""
];

const els = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
  suitBtns: document.querySelectorAll(".suit-btn"),
  websCount: document.getElementById("webs-count"),
  btnWebShooter: document.getElementById("btn-web-shooter"),
  btnSpideySense: document.getElementById("btn-spidey-sense"),
  quote: document.getElementById("spidey-quote"),
  canvas: document.getElementById("swing-canvas"),
  btnStartSwing: document.getElementById("btn-start-swing"),
  gameScore: document.getElementById("game-score"),
  gameBest: document.getElementById("game-best")
};

let bestScore = 0;
let gameRunning = false;
let animId = null;

// Tabs
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    els.panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

// Suit selector
els.suitBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const suit = btn.dataset.suit;
    document.body.dataset.suit = suit;
    els.suitBtns.forEach((b) => b.classList.toggle("active", b === btn));
    await chrome.storage.local.set({ wsSuit: suit });
  });
});

async function sendToActiveTab(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || /^(chrome|edge|about|chrome-extension):/.test(tab.url)) {
    return null;
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return await chrome.tabs.sendMessage(tab.id, msg);
  }
}

function updatePowerButtons(webOn, senseOn) {
  els.btnWebShooter.dataset.active = String(Boolean(webOn));
  els.btnWebShooter.textContent = webOn ? "Active" : "Activate";
  els.btnSpideySense.dataset.active = String(Boolean(senseOn));
  els.btnSpideySense.textContent = senseOn ? "Active" : "Activate";
}

els.btnWebShooter.addEventListener("click", async () => {
  const res = await sendToActiveTab({ type: "TOGGLE_WEB_SHOOTER" });
  if (res) {
    els.btnWebShooter.dataset.active = String(res.webShooterOn);
    els.btnWebShooter.textContent = res.webShooterOn ? "Active" : "Activate";
  }
});

els.btnSpideySense.addEventListener("click", async () => {
  const res = await sendToActiveTab({ type: "TOGGLE_SPIDEY_SENSE" });
  if (res) {
    els.btnSpideySense.dataset.active = String(res.spideySenseOn);
    els.btnSpideySense.textContent = res.spideySenseOn ? "Active" : "Activate";
  }
});

// Web-Swinger Mini-Game
function startSwingGame() {
  if (gameRunning) return;
  gameRunning = true;
  els.btnStartSwing.disabled = true;
  els.btnStartSwing.textContent = "Swinging…";

  const ctx = els.canvas.getContext("2d");
  const W = els.canvas.width;
  const H = els.canvas.height;

  let py = H / 2;
  let vy = 0;
  let score = 0;
  let frame = 0;
  let webLineTimer = 0;
  const towers = [];

  const jump = () => {
    if (!gameRunning) return;
    vy = -5.4;
    webLineTimer = 10;
  };

  const onKey = (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      jump();
    }
  };
  els.canvas.addEventListener("mousedown", jump);
  window.addEventListener("keydown", onKey);

  function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animId);
    els.canvas.removeEventListener("mousedown", jump);
    window.removeEventListener("keydown", onKey);

    if (score > bestScore) {
      bestScore = score;
      els.gameBest.textContent = bestScore;
      chrome.storage.local.set({ wsBest: bestScore });
    }

    ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Wiped Out! Score: ${score}`, W / 2, H / 2);

    els.btnStartSwing.disabled = false;
    els.btnStartSwing.textContent = "Swing Again";
  }

  function loop() {
    frame++;
    vy += 0.28;
    py += vy;

    if (frame % 75 === 0) {
      const gap = 82;
      const topH = 26 + Math.random() * (H - gap - 56);
      towers.push({ x: W, topH, gap, passed: false });
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, W, H);

    // Web strand when jumping
    if (webLineTimer > 0) {
      webLineTimer--;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(64, py);
      ctx.lineTo(105, 0);
      ctx.stroke();
    }

    // Spidey dot
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(64, py, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = towers.length - 1; i >= 0; i--) {
      const t = towers[i];
      t.x -= 2.5;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(t.x, 0, 34, t.topH);
      ctx.fillRect(t.x, t.topH + t.gap, 34, H - (t.topH + t.gap));

      if (!t.passed && t.x + 34 < 64) {
        t.passed = true;
        score++;
        els.gameScore.textContent = score;
      }

      if (64 + 9 > t.x && 64 - 9 < t.x + 34) {
        if (py - 9 < t.topH || py + 9 > t.topH + t.gap) return gameOver();
      }
      if (t.x + 34 < 0) towers.splice(i, 1);
    }

    if (py < 0 || py > H) return gameOver();
    if (gameRunning) animId = requestAnimationFrame(loop);
  }

  els.gameScore.textContent = "0";
  loop();
}

els.btnStartSwing.addEventListener("click", startSwingGame);

// Init
(async () => {
  const data = await chrome.storage.local.get({ wsSuit: "classic", wsWebsCount: 0, wsBest: 0 });
  document.body.dataset.suit = data.wsSuit;
  els.suitBtns.forEach((b) => b.classList.toggle("active", b.dataset.suit === data.wsSuit));
  els.websCount.textContent = data.wsWebsCount;
  bestScore = data.wsBest;
  els.gameBest.textContent = bestScore;
  els.quote.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  const state = await sendToActiveTab({ type: "GET_STATE" });
  if (state) updatePowerButtons(state.webShooterOn, state.spideySenseOn);
})();
