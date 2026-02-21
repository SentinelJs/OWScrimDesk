let hangulSearchApi = null;

const hangulSearchApiPromise = import("https://cdn.jsdelivr.net/npm/es-hangul@2.3.8/dist/index.mjs")
  .then((module) => {
    if (typeof module.getChoseong === "function" && typeof module.disassemble === "function") {
      hangulSearchApi = {
        getChoseong: module.getChoseong,
        disassemble: module.disassemble
      };
    }
  })
  .catch(() => {
    hangulSearchApi = null;
  });

function normalizeForSearch(value) {
  return (value || "").trim().toLowerCase();
}

function compactForSearch(value) {
  return normalizeForSearch(value).replace(/\s+/g, "");
}

function matchesKeyword(target, keyword) {
  if (!keyword) return true;

  const normalizedTarget = normalizeForSearch(target);
  if (normalizedTarget.includes(keyword)) return true;

  const compactTarget = compactForSearch(target);
  const compactKeyword = keyword.replace(/\s+/g, "");
  if (compactTarget.includes(compactKeyword)) return true;

  if (!hangulSearchApi) return false;

  const choseong = hangulSearchApi.getChoseong(compactTarget);
  if (choseong.includes(compactKeyword)) return true;

  const disassembledTarget = hangulSearchApi.disassemble(compactTarget);
  const disassembledKeyword = hangulSearchApi.disassemble(compactKeyword);
  return disassembledTarget.includes(disassembledKeyword);
}

export function setupAutocomplete({ inputId, containerId, items, getItems, onSelect }) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) return;
  let userInteracted = false;

  function clear() {
    container.innerHTML = "";
  }

  function renderList(filtered) {
    clear();
    if (!filtered.length) return;
    const list = document.createElement("div");
    list.className = "autocomplete-list";
    filtered.forEach((item) => {
      const row = document.createElement("div");
      row.className = "autocomplete-item";
      row.textContent = item.name;
      row.addEventListener("click", () => {
        input.value = item.name;
        onSelect(item);
        clear();
      });
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  function refreshList() {
    const isUserFocused = document.activeElement === input && userInteracted;
    if (!isUserFocused) {
      clear();
      return;
    }

    const keyword = normalizeForSearch(input.value);
    const sourceItems = getItems ? getItems() : items || [];
    const filtered = keyword
      ? sourceItems.filter((item) => matchesKeyword(item.name, keyword))
      : sourceItems;
    renderList(filtered);
  }

  input.addEventListener("pointerdown", () => {
    userInteracted = true;
  });
  input.addEventListener("keydown", () => {
    userInteracted = true;
  });
  input.addEventListener("input", refreshList);
  input.addEventListener("focus", refreshList);
  input.addEventListener("blur", () => {
    userInteracted = false;
    setTimeout(clear, 150);
  });

  hangulSearchApiPromise.finally(() => {
    if (document.activeElement === input && userInteracted) {
      refreshList();
    }
  });
}
