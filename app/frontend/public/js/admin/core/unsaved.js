function stringifySnapshot(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "null";
  }
}

export function createUnsavedChangesManager() {
  const entries = new Map();

  function register(tabId, label, getSnapshot) {
    if (typeof getSnapshot !== "function") return;
    const initial = stringifySnapshot(getSnapshot());
    entries.set(tabId, {
      label,
      getSnapshot,
      baseline: initial
    });
  }

  function sync(tabId) {
    const entry = entries.get(tabId);
    if (!entry) return;
    entry.baseline = stringifySnapshot(entry.getSnapshot());
  }

  function syncAll() {
    entries.forEach((_, tabId) => sync(tabId));
  }

  function isDirty(tabId) {
    const entry = entries.get(tabId);
    if (!entry) return false;
    return stringifySnapshot(entry.getSnapshot()) !== entry.baseline;
  }

  function getDirtyTabs() {
    return Array.from(entries.entries())
      .filter(([tabId]) => isDirty(tabId))
      .map(([tabId, entry]) => ({ tabId, label: entry.label }));
  }

  function hasAnyDirty() {
    return getDirtyTabs().length > 0;
  }

  function confirmDiscard(message) {
    if (!hasAnyDirty()) return true;
    return window.confirm(message || "저장되지 않은 변경사항이 있습니다. 저장하지 않고 계속하시겠습니까?");
  }

  return {
    register,
    sync,
    syncAll,
    isDirty,
    getDirtyTabs,
    hasAnyDirty,
    confirmDiscard
  };
}

export function bindBeforeUnload(unsaved) {
  window.addEventListener("beforeunload", (event) => {
    if (!unsaved?.hasAnyDirty?.()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}