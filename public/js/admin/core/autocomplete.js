export function setupAutocomplete({ inputId, containerId, items, getItems, onSelect }) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) return;

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
    const keyword = input.value.trim().toLowerCase();
    const sourceItems = getItems ? getItems() : items;
    const filtered = keyword
      ? sourceItems.filter((item) => item.name.toLowerCase().includes(keyword))
      : sourceItems;
    renderList(filtered);
  }

  input.addEventListener("input", refreshList);
  input.addEventListener("focus", refreshList);
  input.addEventListener("blur", () => {
    setTimeout(clear, 150);
  });
}
