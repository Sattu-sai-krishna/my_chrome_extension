// PixelPal In-Page Bubble Pop Stress-Reliever

(() => {
  if (window.__pixelPalInjected) return;
  window.__pixelPalInjected = true;

  let active = false;
  let layer = null;
  let spawnTimer = null;
  let popped = 0;

  const COLORS = [
    "radial-gradient(circle at 30% 30%, #fbcfe8, #f472b6)",
    "radial-gradient(circle at 30% 30%, #ddd6fe, #8b5cf6)",
    "radial-gradient(circle at 30% 30%, #bae6fd, #38bdf8)",
    "radial-gradient(circle at 30% 30%, #bbf7d0, #34d399)",
    "radial-gradient(circle at 30% 30%, #fef08a, #facc15)"
  ];
  const ICONS = ["✨", "🫧", "⭐", "🍬", "💫"];

  function spawnBubble() {
    if (!active || !layer) return;
    if (layer.querySelectorAll(".pixelpal-bubble").length >= 14) return;

    const size = 44 + Math.floor(Math.random() * 28);
    const bubble = document.createElement("div");
    bubble.className = "pixelpal-bubble";
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.max(20, Math.random() * (window.innerWidth - size - 30))}px`;
    bubble.style.top = `${window.innerHeight + 20}px`;
    bubble.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    bubble.textContent = ICONS[Math.floor(Math.random() * ICONS.length)];

    const duration = 4500 + Math.random() * 2800;
    bubble.animate(
      [
        { transform: "translateY(0px)" },
        { transform: `translateY(-${window.innerHeight + 120}px)` }
      ],
      { duration, easing: "linear" }
    ).onfinish = () => bubble.remove();

    bubble.addEventListener("click", (e) => {
      popped += 1;
      const hudCount = document.getElementById("pixelpal-pop-count");
      if (hudCount) hudCount.textContent = popped;

      const popTag = document.createElement("div");
      popTag.className = "pixelpal-pop-text";
      popTag.textContent = "+1 ★";
      popTag.style.left = `${e.clientX - 12}px`;
      popTag.style.top = `${e.clientY - 12}px`;
      document.body.appendChild(popTag);
      setTimeout(() => popTag.remove(), 650);

      chrome.storage.local.get({ pixelPalState: null }, (data) => {
        if (data.pixelPalState) {
          data.pixelPalState.coins += 1;
          data.pixelPalState.xp += 1;
          chrome.storage.local.set({ pixelPalState: data.pixelPalState });
        }
      });

      bubble.remove();
    });

    layer.appendChild(bubble);
  }

  function startBubbles() {
    if (active) return;
    active = true;
    popped = 0;

    layer = document.createElement("div");
    layer.id = "pixelpal-bubble-layer";

    const hud = document.createElement("div");
    hud.className = "pixelpal-hud";
    hud.innerHTML = `<span>🫧 Popped: <strong id="pixelpal-pop-count">0</strong></span><button id="pixelpal-stop-btn" type="button">Done</button>`;

    layer.appendChild(hud);
    document.body.appendChild(layer);

    hud.querySelector("#pixelpal-stop-btn").addEventListener("click", stopBubbles);

    for (let i = 0; i < 5; i++) setTimeout(spawnBubble, i * 200);
    spawnTimer = setInterval(spawnBubble, 650);
  }

  function stopBubbles() {
    active = false;
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = null;
    if (layer) layer.remove();
    layer = null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "TOGGLE_BUBBLES") {
      if (active) stopBubbles();
      else startBubbles();
      sendResponse({ ok: true, active });
      return true;
    }
  });
})();
