// ClarityLens Content Script — Page Analysis, TF-IDF Summarizer, Focus Reader & Reading Ruler

(() => {
  if (window.__clarityLensLoaded) return;
  window.__clarityLensLoaded = true;

  const STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i",
    "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
    "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves", "also", "just", "like", "make", "many", "much",
    "new", "now", "one", "two", "use", "using", "used", "way", "well", "will"
  ]);

  let rulerActive = false;
  let rulerMouseHandler = null;
  let highlightsActive = false;
  let cachedAnalysis = null;

  function getMainRoot() {
    return (
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.body
    );
  }

  function extractParagraphs() {
    const root = getMainRoot();
    const candidates = root.querySelectorAll("p, li, blockquote, h2, h3");
    const blocks = [];

    for (const el of candidates) {
      if (el.closest("nav, header, footer, aside, [role='navigation'], #claritylens-reader-overlay")) {
        continue;
      }
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const text = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (text.length < 35 && !/^H[23]$/.test(el.tagName)) continue;

      blocks.push({ tag: el.tagName.toLowerCase(), text });
    }

    if (blocks.length === 0) {
      const fallbackText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
      if (fallbackText.length > 0) {
        blocks.push({ tag: "p", text: fallbackText.slice(0, 15000) });
      }
    }
    return blocks;
  }

  function tokenize(text) {
    return (text.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !STOP_WORDS.has(w));
  }

  function countSyllables(word) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.length <= 3) return 1;
    const stripped = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    const matches = stripped.match(/[aeiouy]{1,2}/g);
    return matches ? Math.max(1, matches.length) : 1;
  }

  function splitSentences(text) {
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 45 && s.length <= 360);
  }

  function analyzePage() {
    const blocks = extractParagraphs();
    const proseBlocks = blocks.filter((b) => b.tag !== "h2" && b.tag !== "h3");
    const fullText = proseBlocks.map((b) => b.text).join(" ");

    const rawWords = fullText.match(/[A-Za-z0-9'-]+/g) || [];
    const wordCount = rawWords.length;
    const readMinutes = Math.max(1, Math.round(wordCount / 225));

    // Term frequency
    const freq = new Map();
    for (const w of tokenize(fullText)) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }

    const sortedTerms = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    const maxFreq = sortedTerms.length ? sortedTerms[0][1] : 1;
    const keywords = sortedTerms.slice(0, 8).map(([word]) => word);

    // Extractive summarization via weighted term-frequency + position score
    const sentences = splitSentences(fullText);
    const scored = sentences.map((sentence, idx) => {
      const words = tokenize(sentence);
      if (words.length < 5) return { sentence, idx, score: 0 };
      let tfScore = 0;
      for (const w of words) {
        tfScore += (freq.get(w) || 0) / maxFreq;
      }
      const normalized = tfScore / Math.sqrt(words.length);
      const positionBonus = idx < 3 ? 0.22 : idx < 8 ? 0.1 : 0;
      return { sentence, idx, score: normalized + positionBonus };
    });

    const topSentences = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .sort((a, b) => a.idx - b.idx)
      .map((s) => s.sentence);

    // Flesch-Kincaid Grade Level
    const sentenceTotal = Math.max(1, sentences.length);
    let totalSyllables = 0;
    for (const w of rawWords.slice(0, 2500)) {
      totalSyllables += countSyllables(w);
    }
    const sampledWords = Math.max(1, Math.min(rawWords.length, 2500));
    const avgWordsPerSentence = wordCount / sentenceTotal;
    const avgSyllablesPerWord = totalSyllables / sampledWords;
    const fkGrade = Math.max(
      1,
      Math.min(18, Math.round(0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59))
    );

    const readabilityLabel = fkGrade <= 8 ? "Easy" : fkGrade <= 12 ? "Standard" : "Dense";

    cachedAnalysis = {
      title: document.title || "Untitled Page",
      url: window.location.href,
      wordCount,
      readMinutes,
      fkGrade,
      readabilityLabel,
      takeaways: topSentences.length ? topSentences : ["Not enough structured prose on this page to distill."],
      keywords,
      blocks
    };

    return cachedAnalysis;
  }

  function clearHighlights() {
    const marks = document.querySelectorAll("mark.claritylens-highlight");
    for (const mark of marks) {
      const parent = mark.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    }
    highlightsActive = false;
  }

  function applyHighlights(keywords) {
    clearHighlights();
    if (!keywords || !keywords.length) return 0;

    const root = getMainRoot();
    const pattern = new RegExp(`\\b(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, textarea, input, select, nav, #claritylens-reader-overlay, mark")) {
          return NodeFilter.FILTER_REJECT;
        }
        return pattern.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    let count = 0;
    for (const textNode of nodes) {
      const text = textNode.nodeValue;
      pattern.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const mark = document.createElement("mark");
        mark.className = "claritylens-highlight";
        mark.dataset.term = match[0].toLowerCase();
        mark.textContent = match[0];
        frag.appendChild(mark);
        lastIndex = pattern.lastIndex;
        count++;
      }

      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      textNode.parentNode.replaceChild(frag, textNode);
    }

    highlightsActive = true;
    return count;
  }

  function jumpToKeyword(term) {
    if (!highlightsActive && cachedAnalysis?.keywords?.length) {
      applyHighlights(cachedAnalysis.keywords);
    }
    const all = [...document.querySelectorAll("mark.claritylens-highlight")];
    all.forEach((m) => m.classList.remove("claritylens-highlight-active"));
    const target = all.find((m) => m.dataset.term === term.toLowerCase());
    if (target) {
      target.classList.add("claritylens-highlight-active");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function openReaderMode(theme = "paper", fontSize = 18) {
    const existing = document.getElementById("claritylens-reader-overlay");
    if (existing) existing.remove();

    const analysis = cachedAnalysis || analyzePage();
    const overlay = document.createElement("div");
    overlay.id = "claritylens-reader-overlay";
    overlay.dataset.theme = theme;
    overlay.style.fontSize = `${fontSize}px`;

    const container = document.createElement("div");
    container.className = "claritylens-reader-container";

    const topbar = document.createElement("div");
    topbar.className = "claritylens-reader-topbar";
    topbar.innerHTML = `
      <span class="claritylens-reader-brand">ClarityLens Focus Reader · ${analysis.readMinutes} min read</span>
      <button class="claritylens-reader-close" type="button">Exit Reader</button>
    `;

    const titleEl = document.createElement("h1");
    titleEl.className = "claritylens-reader-title";
    titleEl.textContent = analysis.title;

    const bodyEl = document.createElement("div");
    bodyEl.className = "claritylens-reader-body";

    for (const block of analysis.blocks) {
      const el = document.createElement(block.tag === "li" ? "p" : block.tag);
      el.textContent = block.tag === "li" ? `• ${block.text}` : block.text;
      bodyEl.appendChild(el);
    }

    container.appendChild(topbar);
    container.appendChild(titleEl);
    container.appendChild(bodyEl);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    topbar.querySelector(".claritylens-reader-close").addEventListener("click", () => {
      overlay.remove();
    });
  }

  function updateReaderSettings(theme, fontSize) {
    const overlay = document.getElementById("claritylens-reader-overlay");
    if (!overlay) return;
    if (theme) overlay.dataset.theme = theme;
    if (fontSize) overlay.style.fontSize = `${fontSize}px`;
  }

  function toggleReadingRuler(enable) {
    const existingTop = document.getElementById("claritylens-ruler-top");
    const existingBottom = document.getElementById("claritylens-ruler-bottom");
    if (existingTop) existingTop.remove();
    if (existingBottom) existingBottom.remove();
    if (rulerMouseHandler) {
      window.removeEventListener("mousemove", rulerMouseHandler);
      rulerMouseHandler = null;
    }

    rulerActive = typeof enable === "boolean" ? enable : !rulerActive;
    if (!rulerActive) return false;

    const topShade = document.createElement("div");
    topShade.id = "claritylens-ruler-top";
    const bottomShade = document.createElement("div");
    bottomShade.id = "claritylens-ruler-bottom";
    document.body.appendChild(topShade);
    document.body.appendChild(bottomShade);

    const bandHalf = 68;
    const positionBand = (y) => {
      const vh = window.innerHeight;
      const topH = Math.max(0, y - bandHalf);
      const bottomH = Math.max(0, vh - (y + bandHalf));
      topShade.style.height = `${topH}px`;
      bottomShade.style.height = `${bottomH}px`;
    };

    positionBand(Math.round(window.innerHeight / 2));
    rulerMouseHandler = (e) => positionBand(e.clientY);
    window.addEventListener("mousemove", rulerMouseHandler, { passive: true });
    return true;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "ANALYZE_PAGE") {
      const data = analyzePage();
      sendResponse({ ok: true, data, highlightsActive, rulerActive });
      return true;
    }

    if (msg.type === "TOGGLE_HIGHLIGHTS") {
      if (highlightsActive) {
        clearHighlights();
        sendResponse({ ok: true, highlightsActive: false });
      } else {
        const analysis = cachedAnalysis || analyzePage();
        applyHighlights(analysis.keywords);
        sendResponse({ ok: true, highlightsActive: true });
      }
      return true;
    }

    if (msg.type === "JUMP_KEYWORD") {
      jumpToKeyword(msg.term);
      sendResponse({ ok: true, highlightsActive: true });
      return true;
    }

    if (msg.type === "OPEN_READER") {
      openReaderMode(msg.theme, msg.fontSize);
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "UPDATE_READER_SETTINGS") {
      updateReaderSettings(msg.theme, msg.fontSize);
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "TOGGLE_RULER") {
      const active = toggleReadingRuler(msg.enable);
      sendResponse({ ok: true, rulerActive: active });
      return true;
    }

    if (msg.type === "GET_SELECTION") {
      const text = (window.getSelection()?.toString() || "").trim();
      sendResponse({ ok: true, text, title: document.title, url: window.location.href });
      return true;
    }
  });
})();
