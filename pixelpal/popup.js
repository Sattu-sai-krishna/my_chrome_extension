// PixelPal Popup Controller & Star Catcher Mini-Game

const DEFAULT_STATE = {
  coins: 25,
  xp: 0,
  level: 1,
  joy: 80,
  energy: 85,
  highScore: 0,
  unlockedHats: [],
  equippedHat: null
};

const HATS = [
  { id: "crown", name: "Golden Crown", desc: "Royal browser energy", price: 30, icon: "👑" },
  { id: "shades", name: "Cool Shades", desc: "Zero-stress browsing", price: 20, icon: "🕶️" },
  { id: "headphones", name: "Lo-Fi Beats", desc: "Deep focus vibes", price: 25, icon: "🎧" }
];

let state = { ...DEFAULT_STATE };
let gameRunning = false;
let gameLoopId = null;

const els = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
  level: document.getElementById("pet-level"),
  xpFill: document.getElementById("xp-fill"),
  coins: document.getElementById("coins-count"),
  tabMsg: document.getElementById("tab-status-msg"),
  avatar: document.getElementById("pet-avatar"),
  eyesNormal: document.getElementById("eyes-normal"),
  eyesHappy: document.getElementById("eyes-happy"),
  particles: document.getElementById("particles"),
  barJoy: document.getElementById("bar-joy"),
  barEnergy: document.getElementById("bar-energy"),
  btnPet: document.getElementById("btn-pet"),
  btnSnack: document.getElementById("btn-snack"),
  btnBubbles: document.getElementById("btn-page-bubbles"),
  btnBreath: document.getElementById("btn-breath"),
  canvas: document.getElementById("game-canvas"),
  btnStartGame: document.getElementById("btn-start-game"),
  gameScore: document.getElementById("game-score"),
  highScore: document.getElementById("high-score"),
  shopList: document.getElementById("shop-list")
};

// Tab switching
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    els.panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

function xpNeeded(level) {
  return level * 50;
}

async function saveState() {
  while (state.xp >= xpNeeded(state.level)) {
    state.xp -= xpNeeded(state.level);
    state.level += 1;
    state.coins += 15;
    spawnParticle("🎉 Level Up! +15★");
  }
  await chrome.storage.local.set({ pixelPalState: state });
  renderState();
}

function renderState() {
  els.level.textContent = `Lv.${state.level}`;
  els.xpFill.style.width = `${Math.min(100, (state.xp / xpNeeded(state.level)) * 100)}%`;
  els.coins.textContent = state.coins;
  els.barJoy.style.width = `${state.joy}%`;
  els.barEnergy.style.width = `${state.energy}%`;
  els.highScore.textContent = state.highScore;

  ["crown", "shades", "headphones"].forEach((hatId) => {
    const el = document.getElementById(`hat-${hatId}`);
    if (el) el.classList.toggle("hidden", state.equippedHat !== hatId);
  });

  renderShop();
}

function spawnParticle(text) {
  const span = document.createElement("span");
  span.className = "particle";
  span.textContent = text;
  span.style.left = `${35 + Math.random() * 30}%`;
  span.style.top = `${42 + Math.random() * 15}%`;
  els.particles.appendChild(span);
  setTimeout(() => span.remove(), 900);
}

function happyBounce(emoji) {
  els.avatar.classList.remove("bounce");
  void els.avatar.offsetWidth;
  els.avatar.classList.add("bounce");
  els.eyesNormal.classList.add("hidden");
  els.eyesHappy.classList.remove("hidden");
  spawnParticle(emoji);
  setTimeout(() => {
    els.eyesNormal.classList.remove("hidden");
    els.eyesHappy.classList.add("hidden");
  }, 650);
}

function renderShop() {
  els.shopList.innerHTML = "";
  HATS.forEach((hat) => {
    const unlocked = state.unlockedHats.includes(hat.id);
    const equipped = state.equippedHat === hat.id;

    const row = document.createElement("div");
    row.className = "shop-item";
    row.innerHTML = `
      <div class="shop-info">
        <strong>${hat.icon} ${hat.name}</strong>
        <span>${hat.desc}</span>
      </div>
    `;

    const btn = document.createElement("button");
    if (equipped) {
      btn.className = "shop-btn equipped";
      btn.textContent = "Equipped";
      btn.addEventListener("click", async () => {
        state.equippedHat = null;
        await saveState();
      });
    } else if (unlocked) {
      btn.className = "shop-btn equip";
      btn.textContent = "Wear";
      btn.addEventListener("click", async () => {
        state.equippedHat = hat.id;
        await saveState();
      });
    } else {
      btn.className = "shop-btn buy";
      btn.textContent = `Buy ${hat.price} ★`;
      btn.addEventListener("click", async () => {
        if (state.coins < hat.price) {
          btn.textContent = "Need more ★";
          setTimeout(() => (btn.textContent = `Buy ${hat.price} ★`), 1000);
          return;
        }
        state.coins -= hat.price;
        state.unlockedHats.push(hat.id);
        state.equippedHat = hat.id;
        await saveState();
      });
    }

    row.appendChild(btn);
    els.shopList.appendChild(row);
  });
}

// Pet interactions
function petBuddy() {
  state.joy = Math.min(100, state.joy + 6);
  state.xp += 2;
  happyBounce("💖");
  saveState();
}

els.avatar.addEventListener("click", petBuddy);
els.btnPet.addEventListener("click", petBuddy);

els.btnSnack.addEventListener("click", () => {
  if (state.coins < 5) {
    spawnParticle("Need 5★");
    return;
  }
  state.coins -= 5;
  state.energy = Math.min(100, state.energy + 18);
  state.joy = Math.min(100, state.joy + 8);
  state.xp += 5;
  happyBounce("🍓 Yum!");
  saveState();
});

els.btnBreath.addEventListener("click", () => {
  if (els.btnBreath.disabled) return;
  els.btnBreath.disabled = true;
  let sec = 15;
  els.btnBreath.textContent = `Breathe… ${sec}s`;
  const timer = setInterval(() => {
    sec -= 1;
    if (sec > 0) {
      els.btnBreath.textContent = `Breathe… ${sec}s`;
    } else {
      clearInterval(timer);
      els.btnBreath.disabled = false;
      els.btnBreath.innerHTML = "<span>🌬️</span> 15s Reset (+10 ★)";
      state.coins += 10;
      state.energy = Math.min(100, state.energy + 15);
      state.xp += 10;
      happyBounce("✨ +10★");
      saveState();
    }
  }, 1000);
});

els.btnBubbles.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || /^(chrome|edge|about|chrome-extension):/.test(tab.url)) {
    spawnParticle("Open any website!");
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_BUBBLES" });
  } catch (_) {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_BUBBLES" });
  }
  window.close();
});

// Star Catcher Mini-Game
function startMiniGame() {
  if (gameRunning) return;
  gameRunning = true;
  els.btnStartGame.textContent = "Playing…";
  els.btnStartGame.disabled = true;

  const ctx = els.canvas.getContext("2d");
  const W = els.canvas.width;
  const H = els.canvas.height;
  let playerX = W / 2 - 24;
  const playerW = 48;
  let score = 0;
  let lives = 3;
  const items = [];
  let frame = 0;
  let keys = { left: false, right: false };

  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
  };
  const onKeyUp = (e) => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  };
  const onMouseMove = (e) => {
    const rect = els.canvas.getBoundingClientRect();
    playerX = Math.max(0, Math.min(W - playerW, e.clientX - rect.left - playerW / 2));
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  els.canvas.addEventListener("mousemove", onMouseMove);

  function endGame() {
    gameRunning = false;
    cancelAnimationFrame(gameLoopId);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    els.canvas.removeEventListener("mousemove", onMouseMove);

    const earned = Math.max(2, Math.floor(score / 2));
    state.coins += earned;
    state.xp += score;
    if (score > state.highScore) state.highScore = score;
    saveState();

    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Game Over! Score: ${score}`, W / 2, H / 2 - 10);
    ctx.fillStyle = "#fde047";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`Earned +${earned} ★ coins!`, W / 2, H / 2 + 16);

    els.btnStartGame.textContent = "Play Again";
    els.btnStartGame.disabled = false;
  }

  function loop() {
    frame++;
    if (keys.left) playerX = Math.max(0, playerX - 5);
    if (keys.right) playerX = Math.min(W - playerW, playerX + 5);

    if (frame % 26 === 0) {
      const isBomb = Math.random() < 0.24;
      items.push({
        x: 14 + Math.random() * (W - 28),
        y: -12,
        vy: 2.1 + Math.min(2.2, score * 0.05),
        bomb: isBomb
      });
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(0, 0, W, H);

    // Draw player paddle
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.roundRect(playerX, H - 22, playerW, 12, 6);
    ctx.fill();

    // Lives
    ctx.fillStyle = "#f472b6";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("♥".repeat(lives), 10, 20);

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy;
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(it.bomb ? "💣" : "⭐", it.x, it.y);

      if (it.y >= H - 24 && it.y <= H - 6 && it.x >= playerX - 6 && it.x <= playerX + playerW + 6) {
        if (it.bomb) {
          lives -= 1;
          if (lives <= 0) return endGame();
        } else {
          score += 1;
          els.gameScore.textContent = score;
        }
        items.splice(i, 1);
        continue;
      }

      if (it.y > H + 15) items.splice(i, 1);
    }

    if (gameRunning) gameLoopId = requestAnimationFrame(loop);
  }

  els.gameScore.textContent = "0";
  loop();
}

els.btnStartGame.addEventListener("click", startMiniGame);

// Initialize
(async () => {
  const stored = await chrome.storage.local.get({ pixelPalState: null });
  if (stored.pixelPalState) {
    state = { ...DEFAULT_STATE, ...stored.pixelPalState };
  }
  renderState();

  const allTabs = await chrome.tabs.query({});
  const count = allTabs.length;
  if (count <= 5) {
    els.tabMsg.textContent = `${count} tabs open · Super zen! ✨`;
  } else if (count <= 12) {
    els.tabMsg.textContent = `${count} tabs open · Looking cozy!`;
  } else {
    els.tabMsg.textContent = `${count} tabs open · Tab jungle! 🌿`;
  }
})();
