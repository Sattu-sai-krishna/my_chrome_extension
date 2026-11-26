// ClarityLens Popup Controller

let currentTabId = null;
let currentAnalysis = null;
let readerTheme = "paper";
let readerFontSize = 18;

const els = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
  badge: document.getElementById("readability-badge"),
  error: document.getElementById("gist-error"),
  metricTime: document.getElementById("metric-time"),
  metricWords: document.getElementById("metric-words"),
  metricGrade: document.getElementById("metric-grade"),
  takeaways: document.getElementById("takeaways-list"),
  keywords: document.getElementById("keywords-container"),
  btnHighlight: document.getElementById("btn-toggle-highlights"),
  btnCopyGist: document.getElementById("btn-copy-gist"),
  btnReader: document.getElementById("btn-reader-mode"),
  btnRuler: document.getElementById("btn-ruler-mode"),
  themeBtns: document.querySelectorAll("#theme-selector .seg-btn"),
  fontSlider: document.getElementById("font-size-slider"),
  fontVal: document.getElementById("font-size-val"),
  clipsCount: document.getElementById("clips-count"),
  clipsList: document.getElementById("clips-list"),
  btnClipSel: document.getElementById("btn-clip-selection"),
  btnExportClips: document.getElementById("btn-export-clips"),
  btnClearClips: document.getElementById("btn-clear-clips")
};

// Tab switching
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    els.panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

async function ensureContentScript(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

async function sendToTab(payload) {
  if (!currentTabId) return null;
  try {
    return await chrome.tabs.sendMessage(currentTabId, payload);
  } catch (_) {
    await ensureContentScript(currentTabId);
    return await chrome.tabs.sendMessage(currentTabId, payload);
  }
}

function renderAnalysis(data, highlightsActive, rulerActive) {
  currentAnalysis = data;
  els.metricTime.textContent = `${data.readMinutes} min`;
  els.metricWords.textContent = data.wordCount.toLocaleString();
  els.metricGrade.textContent = `G${data.fkGrade}`;

  els.badge.textContent = data.readabilityLabel;
  els.badge.className = `badge badge-${data.readabilityLabel.toLowerCase()}`;

  els.takeaways.innerHTML = "";
  data.takeaways.forEach((sentence) => {
    const li = document.createElement("li");
    li.textContent = sentence;
    els.takeaways.appendChild(li);
  });

  els.keywords.innerHTML = "";
  data.keywords.forEach((term) => {
    const btn = document.createElement("button");
    btn.className = "keyword-chip";
    btn.textContent = term;
    btn.title = `Jump to "${term}" on page`;
    btn.addEventListener("click", async () => {
      const res = await sendToTab({ type: "JUMP_KEYWORD", term });
      if (res?.highlightsActive) {
        setHighlightBtn(true);
      }
    });
    els.keywords.appendChild(btn);
  });

  setHighlightBtn(highlightsActive);
  setRulerBtn(rulerActive);
}

function setHighlightBtn(active) {
  els.btnHighlight.dataset.active = String(Boolean(active));
  els.btnHighlight.textContent = active ? "Highlights On" : "Highlight on Page";
}

function setRulerBtn(active) {
  els.btnRuler.dataset.active = String(Boolean(active));
  els.btnRuler.textContent = active ? "Disable Ruler" : "Enable Ruler";
}

async function loadSettings() {
  const saved = await chrome.storage.local.get({
    clarityTheme: "paper",
    clarityFontSize: 18
  });
  readerTheme = saved.clarityTheme;
  readerFontSize = saved.clarityFontSize;
  els.fontSlider.value = readerFontSize;
  els.fontVal.textContent = `${readerFontSize}px`;
  els.themeBtns.forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === readerTheme);
  });
}

async function renderClips() {
  const { clarityClips = [] } = await chrome.storage.local.get({ clarityClips: [] });
  els.clipsCount.textContent = clarityClips.length;
  els.clipsList.innerHTML = "";

  if (clarityClips.length === 0) {
    els.clipsList.innerHTML = `<div class="empty-state">No clips yet. Select text on any page and right-click <strong>"Save snippet to ClarityLens"</strong> or click <strong>+ Clip Selection</strong>.</div>`;
    return;
  }

  clarityClips.forEach((clip) => {
    const card = document.createElement("div");
    card.className = "clip-item";

    const textEl = document.createElement("div");
    textEl.className = "clip-text";
    textEl.textContent = clip.text;

    const meta = document.createElement("div");
    meta.className = "clip-meta";

    const link = document.createElement("a");
    link.className = "clip-source";
    link.href = clip.url || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = clip.title || clip.url;

    const delBtn = document.createElement("button");
    delBtn.className = "btn-ghost danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      const updated = clarityClips.filter((c) => c.id !== clip.id);
      await chrome.storage.local.set({ clarityClips: updated });
      renderClips();
    });

    meta.appendChild(link);
    meta.appendChild(delBtn);
    card.appendChild(textEl);
    card.appendChild(meta);
    els.clipsList.appendChild(card);
  });
}

// Event Listeners
els.btnHighlight.addEventListener("click", async () => {
  const res = await sendToTab({ type: "TOGGLE_HIGHLIGHTS" });
  if (res) setHighlightBtn(res.highlightsActive);
});

els.btnCopyGist.addEventListener("click", async () => {
  if (!currentAnalysis) return;
  const md = [
    `# ${currentAnalysis.title}`,
    `Source: ${currentAnalysis.url}`,
    `Read time: ~${currentAnalysis.readMinutes} min · Grade ${currentAnalysis.fkGrade} (${currentAnalysis.readabilityLabel})`,
    "",
    "## Key Takeaways",
    ...currentAnalysis.takeaways.map((t) => `- ${t}`),
    "",
    `Keywords: ${currentAnalysis.keywords.join(", ")}`
  ].join("\n");

  await navigator.clipboard.writeText(md);
  els.btnCopyGist.textContent = "Copied!";
  setTimeout(() => (els.btnCopyGist.textContent = "Copy"), 1400);
});

els.btnReader.addEventListener("click", async () => {
  await sendToTab({ type: "OPEN_READER", theme: readerTheme, fontSize: readerFontSize });
});

els.btnRuler.addEventListener("click", async () => {
  const res = await sendToTab({ type: "TOGGLE_RULER" });
  if (res) setRulerBtn(res.rulerActive);
});

els.themeBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    readerTheme = btn.dataset.theme;
    els.themeBtns.forEach((b) => b.classList.toggle("active", b === btn));
    await chrome.storage.local.set({ clarityTheme: readerTheme });
    await sendToTab({ type: "UPDATE_READER_SETTINGS", theme: readerTheme, fontSize: readerFontSize });
  });
});

els.fontSlider.addEventListener("input", async () => {
  readerFontSize = Number(els.fontSlider.value);
  els.fontVal.textContent = `${readerFontSize}px`;
  await chrome.storage.local.set({ clarityFontSize: readerFontSize });
  await sendToTab({ type: "UPDATE_READER_SETTINGS", theme: readerTheme, fontSize: readerFontSize });
});

els.btnClipSel.addEventListener("click", async () => {
  const res = await sendToTab({ type: "GET_SELECTION" });
  if (!res?.text) {
    els.btnClipSel.textContent = "Select text first";
    setTimeout(() => (els.btnClipSel.textContent = "+ Clip Selection"), 1500);
    return;
  }
  const { clarityClips = [] } = await chrome.storage.local.get({ clarityClips: [] });
  const clip = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: res.text,
    title: res.title || "Untitled Page",
    url: res.url || "",
    createdAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ clarityClips: [clip, ...clarityClips].slice(0, 200) });
  renderClips();
});

els.btnExportClips.addEventListener("click", async () => {
  const { clarityClips = [] } = await chrome.storage.local.get({ clarityClips: [] });
  if (!clarityClips.length) return;
  const md = clarityClips
    .map((c) => `> ${c.text.replace(/\n/g, "\n> ")}\n— [${c.title}](${c.url}) (${c.createdAt.slice(0, 10)})\n`)
    .join("\n---\n\n");
  const blob = new Blob([`# ClarityLens Clips\n\n${md}`], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `claritylens-clips-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

els.btnClearClips.addEventListener("click", async () => {
  await chrome.storage.local.set({ clarityClips: [] });
  renderClips();
});

// Initialize
(async () => {
  await loadSettings();
  await renderClips();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || /^(chrome|edge|about|chrome-extension):/.test(tab.url)) {
    els.badge.textContent = "Restricted";
    els.error.textContent = "ClarityLens cannot inspect browser internal pages. Open any website or article to analyze.";
    els.error.classList.remove("hidden");
    els.takeaways.innerHTML = "";
    return;
  }

  currentTabId = tab.id;
  try {
    const res = await sendToTab({ type: "ANALYZE_PAGE" });
    if (res?.ok) {
      renderAnalysis(res.data, res.highlightsActive, res.rulerActive);
    }
  } catch (err) {
    els.badge.textContent = "Unavailable";
    els.error.textContent = "Could not connect to this page. Try refreshing the tab.";
    els.error.classList.remove("hidden");
    els.takeaways.innerHTML = "";
  }
})();
