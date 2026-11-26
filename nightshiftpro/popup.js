// NightShift Pro Popup Controller

const PRESETS = {
  midnight: { brightness: 100, contrast: 100, sepia: 10 },
  amber: { brightness: 94, contrast: 96, sepia: 45 },
  slate: { brightness: 92, contrast: 90, sepia: 5 }
};

const DEFAULTS = {
  globalEnabled: true,
  brightness: 100,
  contrast: 100,
  sepia: 10,
  preset: "midnight",
  siteOverrides: {}
};

let currentHost = "";
let settings = { ...DEFAULTS };

const els = {
  toggleGlobal: document.getElementById("toggle-global"),
  siteHost: document.getElementById("site-host"),
  btnSiteToggle: document.getElementById("btn-site-toggle"),
  presetBtns: document.querySelectorAll(".preset-btn"),
  rangeBrightness: document.getElementById("range-brightness"),
  rangeContrast: document.getElementById("range-contrast"),
  rangeSepia: document.getElementById("range-sepia"),
  valBrightness: document.getElementById("val-brightness"),
  valContrast: document.getElementById("val-contrast"),
  valSepia: document.getElementById("val-sepia"),
  btnReset: document.getElementById("btn-reset")
};

function isSiteActive() {
  if (currentHost && Object.prototype.hasOwnProperty.call(settings.siteOverrides || {}, currentHost)) {
    return Boolean(settings.siteOverrides[currentHost]);
  }
  return Boolean(settings.globalEnabled);
}

function render() {
  els.toggleGlobal.checked = Boolean(settings.globalEnabled);
  els.rangeBrightness.value = settings.brightness;
  els.rangeContrast.value = settings.contrast;
  els.rangeSepia.value = settings.sepia;
  els.valBrightness.textContent = `${settings.brightness}%`;
  els.valContrast.textContent = `${settings.contrast}%`;
  els.valSepia.textContent = `${settings.sepia}%`;

  els.presetBtns.forEach((b) => {
    b.classList.toggle("active", b.dataset.preset === settings.preset);
  });

  const active = isSiteActive();
  els.btnSiteToggle.textContent = active ? "On for Site" : "Off for Site";
  els.btnSiteToggle.classList.toggle("off", !active);
}

async function save() {
  await chrome.storage.local.set(settings);
  render();
}

els.toggleGlobal.addEventListener("change", () => {
  settings.globalEnabled = els.toggleGlobal.checked;
  save();
});

els.btnSiteToggle.addEventListener("click", () => {
  if (!currentHost) return;
  const next = !isSiteActive();
  settings.siteOverrides = { ...(settings.siteOverrides || {}), [currentHost]: next };
  save();
});

els.presetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    settings.preset = btn.dataset.preset;
    settings.brightness = p.brightness;
    settings.contrast = p.contrast;
    settings.sepia = p.sepia;
    save();
  });
});

[
  [els.rangeBrightness, "brightness"],
  [els.rangeContrast, "contrast"],
  [els.rangeSepia, "sepia"]
].forEach(([slider, key]) => {
  slider.addEventListener("input", () => {
    settings[key] = Number(slider.value);
    settings.preset = "custom";
    save();
  });
});

els.btnReset.addEventListener("click", () => {
  settings = { ...DEFAULTS, siteOverrides: {} };
  save();
});

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    currentHost = tab?.url && tab.url.startsWith("http")
      ? new URL(tab.url).hostname.replace(/^www\./, "")
      : "";
  } catch {
    currentHost = "";
  }
  els.siteHost.textContent = currentHost || "Browser page";
  els.btnSiteToggle.disabled = !currentHost;

  settings = await chrome.storage.local.get(DEFAULTS);
  render();
})();
