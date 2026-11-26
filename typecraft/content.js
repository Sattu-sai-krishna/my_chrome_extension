// TypeCraft Content Script — Real-Time Spelling, Grammar & Word Suggestion Engine

(() => {
  if (window.__typeCraftLoaded) return;
  window.__typeCraftLoaded = true;

  const DATA = window.TYPECRAFT_DATA || { typos: {}, phrases: [], words: [] };
  const WORD_SET = new Set(DATA.words.map((w) => w.toLowerCase()));

  let enabled = true;
  let customWords = new Set();
  let activeEl = null;
  let currentSuggestion = null; // { kind, replaceStart, replaceEnd, options: string[], isContentEditable }
  let pill = null;

  // Load settings
  chrome.storage.local.get(
    { tcEnabled: true, tcCustomWords: [] },
    (res) => {
      enabled = res.tcEnabled !== false;
      customWords = new Set((res.tcCustomWords || []).map((w) => w.toLowerCase()));
    }
  );

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.tcEnabled) {
      enabled = changes.tcEnabled.newValue !== false;
      if (!enabled) hidePill();
    }
    if (changes.tcCustomWords) {
      customWords = new Set((changes.tcCustomWords.newValue || []).map((w) => w.toLowerCase()));
    }
  });

  // Damerau-Levenshtein distance for fuzzy typo matching
  function editDistance(a, b) {
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > 2) return 99;
    const dp = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
    for (let i = 0; i <= la; i++) dp[i][0] = i;
    for (let j = 0; j <= lb; j++) dp[0][j] = j;

    for (let i = 1; i <= la; i++) {
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
        }
      }
    }
    return dp[la][lb];
  }

  function matchCase(source, target) {
    if (!source) return target;
    if (source === source.toUpperCase() && source.length > 1) return target.toUpperCase();
    if (source[0] === source[0].toUpperCase()) {
      return target.charAt(0).toUpperCase() + target.slice(1);
    }
    return target;
  }

  function findFuzzyCorrections(word) {
    const lower = word.toLowerCase();
    if (lower.length < 3 || WORD_SET.has(lower) || customWords.has(lower)) return [];

    if (DATA.typos[lower]) {
      return [matchCase(word, DATA.typos[lower])];
    }

    const candidates = [];
    for (let i = 0; i < DATA.words.length; i++) {
      const dictWord = DATA.words[i];
      if (Math.abs(dictWord.length - lower.length) > 2) continue;
      const dist = editDistance(lower, dictWord);
      if (dist <= 2) {
        // Prefer distance 1 and higher-frequency words (smaller index)
        candidates.push({ word: matchCase(word, dictWord), dist, rank: i });
      }
    }

    candidates.sort((a, b) => a.dist - b.dist || a.rank - b.rank);
    return candidates.slice(0, 3).map((c) => c.word);
  }

  function findPrefixCompletions(prefix) {
    const lower = prefix.toLowerCase();
    if (lower.length < 3) return [];
    const results = [];
    for (let i = 0; i < DATA.words.length; i++) {
      const w = DATA.words[i];
      if (w.length > lower.length + 1 && w.startsWith(lower)) {
        results.push(matchCase(prefix, w));
        if (results.length >= 3) break;
      }
    }
    return results;
  }

  function analyzeContext(textBeforeCaret) {
    if (!textBeforeCaret) return null;

    // 1. Check phrase-level grammar rules near the end of text
    const tail = textBeforeCaret.slice(-60);
    for (const rule of DATA.phrases) {
      rule.pattern.lastIndex = 0;
      let match;
      let lastMatch = null;
      while ((match = rule.pattern.exec(tail)) !== null) {
        lastMatch = match;
      }
      if (lastMatch && lastMatch.index + lastMatch[0].length >= tail.length - 1) {
        const globalStart = textBeforeCaret.length - tail.length + lastMatch.index;
        const globalEnd = globalStart + lastMatch[0].length;
        return {
          kind: "grammar",
          label: rule.note || "Grammar",
          replaceStart: globalStart,
          replaceEnd: globalEnd,
          options: [lastMatch[0].toLowerCase() === "i" ? "I" : rule.replace]
        };
      }
    }

    // 2. Check completed word right before a trailing space/punctuation
    const completedMatch = textBeforeCaret.match(/([A-Za-z']{2,})([\s.,!?;:])$/);
    if (completedMatch) {
      const word = completedMatch[1];
      const fixes = findFuzzyCorrections(word);
      if (fixes.length > 0) {
        const end = textBeforeCaret.length - 1;
        const start = end - word.length;
        return {
          kind: "typo",
          label: "Spelling",
          replaceStart: start,
          replaceEnd: end,
          options: fixes
        };
      }
    }

    // 3. Check currently-being-typed word (prefix completion or typo if >= 4 chars)
    const typingMatch = textBeforeCaret.match(/([A-Za-z']{3,})$/);
    if (typingMatch) {
      const partial = typingMatch[1];
      const lower = partial.toLowerCase();
      if (DATA.typos[lower]) {
        return {
          kind: "typo",
          label: "Fix",
          replaceStart: textBeforeCaret.length - partial.length,
          replaceEnd: textBeforeCaret.length,
          options: [matchCase(partial, DATA.typos[lower])]
        };
      }
      const completions = findPrefixCompletions(partial);
      if (completions.length > 0) {
        return {
          kind: "complete",
          label: "Suggest",
          replaceStart: textBeforeCaret.length - partial.length,
          replaceEnd: textBeforeCaret.length,
          options: completions
        };
      }
    }

    return null;
  }

  function ensurePill() {
    if (pill) return pill;
    pill = document.createElement("div");
    pill.id = "typecraft-pill";
    pill.className = "hidden";
    document.documentElement.appendChild(pill);
    return pill;
  }

  function hidePill() {
    if (pill) pill.classList.add("hidden");
    currentSuggestion = null;
  }

  function positionPill(el) {
    const p = ensurePill();
    const rect = el.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 48, rect.bottom + 6);
    const left = Math.max(10, Math.min(window.innerWidth - 360, rect.left));
    p.style.top = `${Math.max(8, top)}px`;
    p.style.left = `${left}px`;
  }

  function showPill(el, suggestion) {
    currentSuggestion = suggestion;
    const p = ensurePill();
    p.innerHTML = "";

    const tag = document.createElement("span");
    tag.className = `tc-tag tc-tag-${suggestion.kind}`;
    tag.textContent = suggestion.label;
    p.appendChild(tag);

    suggestion.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tc-chip${idx === 0 ? " tc-primary" : ""}`;
      btn.textContent = opt;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        applySuggestion(opt);
      });
      p.appendChild(btn);
    });

    const hint = document.createElement("span");
    hint.className = "tc-hint";
    hint.textContent = "Tab";
    p.appendChild(hint);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "tc-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      hidePill();
    });
    p.appendChild(closeBtn);

    positionPill(el);
    p.classList.remove("hidden");
  }

  function incrementStats(kind) {
    chrome.storage.local.get({ tcStats: { fixes: 0, completions: 0 } }, (res) => {
      const stats = res.tcStats;
      if (kind === "complete") stats.completions += 1;
      else stats.fixes += 1;
      chrome.storage.local.set({ tcStats: stats });
    });
  }

  function applySuggestion(replacement) {
    if (!activeEl || !currentSuggestion) return;

    const { replaceStart, replaceEnd, kind } = currentSuggestion;

    if (activeEl.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.nodeValue || "";
          const offset = range.startOffset;
          const len = replaceEnd - replaceStart;
          const start = Math.max(0, offset - len - (text[offset - 1] === " " && kind === "typo" ? 1 : 0));
          const trailing = text.slice(start, offset).endsWith(" ") && kind === "typo" ? " " : "";
          const newText = text.slice(0, start) + replacement + trailing + text.slice(offset);
          node.nodeValue = newText;
          const newCursor = start + replacement.length + trailing.length;
          range.setStart(node, newCursor);
          range.setEnd(node, newCursor);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    } else if ("value" in activeEl) {
      const val = activeEl.value;
      const newVal = val.slice(0, replaceStart) + replacement + val.slice(replaceEnd);
      activeEl.value = newVal;
      const newCursor = replaceStart + replacement.length;
      activeEl.setSelectionRange(newCursor, newCursor);
      activeEl.dispatchEvent(new Event("input", { bubbles: true }));
    }

    incrementStats(kind);
    hidePill();
  }

  function isEditableTarget(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === "TEXTAREA") return !el.readOnly && !el.disabled;
    if (el.tagName === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      return ["text", "search", "email", "url"].includes(t) && !el.readOnly && !el.disabled;
    }
    return false;
  }

  function handleInput(e) {
    if (!enabled) return;
    const el = e.target;
    if (!isEditableTarget(el)) return;
    activeEl = el;

    let beforeCaret = "";
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return hidePill();
      const range = sel.getRangeAt(0);
      if (range.startContainer.nodeType !== Node.TEXT_NODE) return hidePill();
      beforeCaret = (range.startContainer.nodeValue || "").slice(0, range.startOffset);
    } else {
      const pos = el.selectionStart ?? el.value.length;
      beforeCaret = el.value.slice(0, pos);
    }

    const suggestion = analyzeContext(beforeCaret);
    if (suggestion) {
      showPill(el, suggestion);
    } else {
      hidePill();
    }
  }

  document.addEventListener("input", handleInput, true);

  document.addEventListener(
    "keydown",
    (e) => {
      if (!currentSuggestion || !pill || pill.classList.contains("hidden")) return;
      if (e.key === "Tab") {
        e.preventDefault();
        applySuggestion(currentSuggestion.options[0]);
      } else if (e.key === "Escape") {
        hidePill();
      }
    },
    true
  );

  document.addEventListener(
    "blur",
    () => {
      setTimeout(() => {
        if (document.activeElement !== activeEl) hidePill();
      }, 150);
    },
    true
  );
})();
