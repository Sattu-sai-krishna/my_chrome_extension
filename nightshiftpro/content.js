// NightShift Pro Content Script — Anti-Flash Adaptive Dark Mode & Eye-Care Filters

(() => {
  const STYLE_ID = "nightshift-pro-style";
  const HOST = location.hostname.replace(/^www\./, "");

  const DEFAULTS = {
    globalEnabled: true,
    brightness: 100,
    contrast: 100,
    sepia: 10,
    preset: "midnight",
    siteOverrides: {} // { [host]: boolean }
  };

  let currentSettings = { ...DEFAULTS };

  function isEnabledForHost(settings) {
    if (HOST && Object.prototype.hasOwnProperty.call(settings.siteOverrides || {}, HOST)) {
      return Boolean(settings.siteOverrides[HOST]);
    }
    return Boolean(settings.globalEnabled);
  }

  function buildCSS(settings) {
    if (!isEnabledForHost(settings)) return "";

    const b = (settings.brightness ?? 100) / 100;
    const c = (settings.contrast ?? 100) / 100;
    const s = (settings.sepia ?? 10) / 100;

    return `
      html {
        filter: invert(0.92) hue-rotate(180deg) brightness(${b}) contrast(${c}) sepia(${s}) !important;
        background-color: #ffffff !important;
      }
      img,
      video,
      picture,
      canvas,
      iframe,
      [style*="background-image"] {
        filter: invert(1) hue-rotate(180deg) !important;
      }
      img img,
      picture img {
        filter: none !important;
      }
    `;
  }

  function applyStyles(settings) {
    currentSettings = settings;
    let styleEl = document.getElementById(STYLE_ID);
    const css = buildCSS(settings);

    if (!css) {
      if (styleEl) styleEl.remove();
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  chrome.storage.local.get(DEFAULTS, (res) => {
    applyStyles(res);
  });

  chrome.storage.onChanged.addListener((changes) => {
    const updated = { ...currentSettings };
    for (const [key, { newValue }] of Object.entries(changes)) {
      updated[key] = newValue;
    }
    applyStyles(updated);
  });
})();
