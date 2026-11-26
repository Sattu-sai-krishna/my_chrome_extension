// TypeCraft Popup Controller

const toggleEnabled = document.getElementById("toggle-enabled");
const statFixes = document.getElementById("stat-fixes");
const statCompletions = document.getElementById("stat-completions");
const dictInput = document.getElementById("dict-input");
const btnAddWord = document.getElementById("btn-add-word");
const dictList = document.getElementById("dict-list");

async function loadPopupData() {
  const data = await chrome.storage.local.get({
    tcEnabled: true,
    tcStats: { fixes: 0, completions: 0 },
    tcCustomWords: []
  });

  toggleEnabled.checked = data.tcEnabled !== false;
  statFixes.textContent = data.tcStats.fixes || 0;
  statCompletions.textContent = data.tcStats.completions || 0;
  renderDict(data.tcCustomWords || []);
}

function renderDict(words) {
  dictList.innerHTML = "";
  words.forEach((word) => {
    const chip = document.createElement("span");
    chip.className = "dict-chip";
    chip.textContent = word;

    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = "×";
    rm.title = `Remove ${word}`;
    rm.addEventListener("click", async () => {
      const { tcCustomWords = [] } = await chrome.storage.local.get({ tcCustomWords: [] });
      const updated = tcCustomWords.filter((w) => w !== word);
      await chrome.storage.local.set({ tcCustomWords: updated });
      renderDict(updated);
    });

    chip.appendChild(rm);
    dictList.appendChild(chip);
  });
}

toggleEnabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ tcEnabled: toggleEnabled.checked });
});

async function addCustomWord() {
  const word = dictInput.value.trim();
  if (!word) return;
  const { tcCustomWords = [] } = await chrome.storage.local.get({ tcCustomWords: [] });
  if (!tcCustomWords.includes(word)) {
    const updated = [...tcCustomWords, word];
    await chrome.storage.local.set({ tcCustomWords: updated });
    renderDict(updated);
  }
  dictInput.value = "";
}

btnAddWord.addEventListener("click", addCustomWord);
dictInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCustomWord();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.tcStats) {
    const s = changes.tcStats.newValue || { fixes: 0, completions: 0 };
    statFixes.textContent = s.fixes || 0;
    statCompletions.textContent = s.completions || 0;
  }
});

loadPopupData();
