// WebSlinger Content Script — In-Page Web-Shooter & Spidey-Sense

(() => {
  if (window.__webSlingerLoaded) return;
  window.__webSlingerLoaded = true;

  let webShooterOn = false;
  let spideySenseOn = false;
  let canvas = null;
  let ctx = null;
  let hud = null;
  let senseRing = null;
  const splats = [];
  let animId = null;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "webslinger-canvas";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");

    window.addEventListener("resize", () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }

  function drawWebSplat(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2;
    const spokes = 8;
    const radius = 26;
    for (let i = 0; i < spokes; i++) {
      const ang = (Math.PI * 2 * i) / spokes;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * radius, y + Math.sin(ang) * radius);
      ctx.stroke();
    }
    for (const r of [10, 19]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderWebs() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const originX = canvas.width / 2;
    const originY = canvas.height;

    for (let i = splats.length - 1; i >= 0; i--) {
      const s = splats[i];
      s.life -= 0.014;
      if (s.life <= 0) {
        splats.splice(i, 1);
        continue;
      }

      if (s.strand > 0) {
        s.strand -= 0.06;
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.strand);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.restore();
      }

      drawWebSplat(s.x, s.y, Math.min(1, s.life));
    }

    if (splats.length > 0 || webShooterOn) {
      animId = requestAnimationFrame(renderWebs);
    } else {
      animId = null;
    }
  }

  function onPageClick(e) {
    if (!webShooterOn) return;
    if (e.target.closest(".webslinger-hud")) return;
    ensureCanvas();
    splats.push({ x: e.clientX, y: e.clientY, life: 1.0, strand: 1.0 });
    if (!animId) animId = requestAnimationFrame(renderWebs);

    chrome.storage.local.get({ wsWebsCount: 0 }, (res) => {
      chrome.storage.local.set({ wsWebsCount: (res.wsWebsCount || 0) + 1 });
    });
  }

  function setWebShooter(enable) {
    webShooterOn = enable;
    if (hud) hud.remove();
    document.removeEventListener("click", onPageClick, true);

    if (!webShooterOn) {
      if (canvas && splats.length === 0) {
        canvas.remove();
        canvas = null;
        ctx = null;
      }
      return;
    }

    ensureCanvas();
    document.addEventListener("click", onPageClick, true);
    hud = document.createElement("div");
    hud.className = "webslinger-hud";
    hud.innerHTML = `<span>🕸️ Web-Shooter Active — Click anywhere!</span><button type="button" id="ws-off-btn">Exit</button>`;
    document.body.appendChild(hud);
    hud.querySelector("#ws-off-btn").addEventListener("click", () => setWebShooter(false));
    if (!animId) animId = requestAnimationFrame(renderWebs);
  }

  function onHoverLink(e) {
    if (!spideySenseOn || !senseRing) return;
    const link = e.target.closest("a[href]");
    if (link && link.hostname && link.hostname !== location.hostname) {
      senseRing.classList.add("tingle");
    } else {
      senseRing.classList.remove("tingle");
    }
  }

  function setSpideySense(enable) {
    spideySenseOn = enable;
    if (senseRing) senseRing.remove();
    document.removeEventListener("mouseover", onHoverLink, true);
    if (!spideySenseOn) {
      senseRing = null;
      return;
    }
    senseRing = document.createElement("div");
    senseRing.id = "webslinger-sense-ring";
    document.body.appendChild(senseRing);
    document.addEventListener("mouseover", onHoverLink, true);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "GET_STATE") {
      sendResponse({ ok: true, webShooterOn, spideySenseOn });
      return true;
    }
    if (msg.type === "TOGGLE_WEB_SHOOTER") {
      setWebShooter(!webShooterOn);
      sendResponse({ ok: true, webShooterOn });
      return true;
    }
    if (msg.type === "TOGGLE_SPIDEY_SENSE") {
      setSpideySense(!spideySenseOn);
      sendResponse({ ok: true, spideySenseOn });
      return true;
    }
  });
})();
