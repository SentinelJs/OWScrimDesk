const state = {
  settings: null,
  teams: null,
  current: null,
  history: [],
  assets: { maps: [], heroes: [] }
};

const wsStatus = document.getElementById("wsStatus");
let ws;
const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function connectWS() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.addEventListener("open", () => {
    wsStatus.textContent = "WS 연결됨";
  });
  ws.addEventListener("close", () => {
    wsStatus.textContent = "WS 연결 끊김";
    setTimeout(connectWS, 1500);
  });
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "admin:error") {
      alert(data.payload.message);
    }
  });
}

function wsPublish(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert("웹소켓 연결이 필요합니다.");
    return;
  }
  ws.send(JSON.stringify({ type: "admin:publish", payload }));
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function refreshAllData() {
  const [settings, teams, current, history] = await Promise.all([
    fetchJSON("/api/settings"),
    fetchJSON("/api/teams"),
    fetchJSON("/api/state"),
    fetchJSON("/api/history")
  ]);
  state.settings = settings;
  state.teams = teams;
  state.current = current;
  state.history = history;
  renderTeamForm();
  renderInGame();
  renderHistory();
  renderMatchInfo();
  showToast("최신 정보를 불러왔습니다.");
}

async function refreshStateFromServer() {
  const current = await fetchJSON("/api/state");
  state.current = current;
}

function tabInit() {
  const tabs = document.querySelectorAll("#tabs button");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      refreshAllData();
    });
  });
}

function mapByName(name) {
  return state.assets.maps.find((map) => map.name === name) || null;
}

function heroByName(name) {
  return state.assets.heroes.find((hero) => hero.name === name) || null;
}

function renderTeamForm() {
  document.getElementById("team1-name").value = state.teams.team1.name;
  document.getElementById("team2-name").value = state.teams.team2.name;
  document.getElementById("team1-color").value = state.teams.team1.color;
  document.getElementById("team2-color").value = state.teams.team2.color;
  document.getElementById("team1-color-swatch").style.background = state.teams.team1.color;
  document.getElementById("team2-color-swatch").style.background = state.teams.team2.color;
  updateLogoPreview("team1");
  updateLogoPreview("team2");
  renderTeamIdentity();
}

function renderTeamIdentity() {
  const el = document.getElementById("teamIdentity");
  if (!el || !state.teams) return;
  const team1 = state.teams.team1?.name || "Team 1";
  const team2 = state.teams.team2?.name || "Team 2";
  el.textContent = `Team 1: ${team1}  |  Team 2: ${team2}`;
}

function updateLogoPreview(teamId) {
  const preview = document.getElementById(`${teamId}-logo-preview`);
  preview.innerHTML = "";
  const logo = state.teams[teamId].logo;
  if (logo) {
    const img = document.createElement("img");
    img.src = logo;
    preview.appendChild(img);
  }
}

function updateColorLabel(teamId) {
  const color = document.getElementById(`${teamId}-color`).value;
  document.getElementById(`${teamId}-color-swatch`).style.background = color;
}

async function applyDominantColor(teamId) {
  const logo = state.teams[teamId].logo;
  if (!logo) {
    alert("먼저 로고를 업로드해주세요.");
    return;
  }
  try {
    const result = await fetchJSON("/api/teams/dominant-color", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo })
    });
    if (!result.ok || !result.color) {
      throw new Error(result.message || "색상 추출 실패");
    }
    state.teams[teamId].color = result.color;
    document.getElementById(`${teamId}-color`).value = result.color;
    updateColorLabel(teamId);
    showToast("로고 색상이 적용되었습니다.");
  } catch (error) {
    alert(error.message || "색상 추출 중 오류가 발생했습니다.");
  }
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderDatalists() {
  return;
}

function setupAutocomplete({ inputId, containerId, items, getItems, onSelect }) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);

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

function computeAvailableModes(settings, history) {
  const mapPoolByMode = settings.mapPool || {};
  const validModes = ["control", "hybrid", "flashpoint", "push", "escort"];
  const availableModes = validModes.filter((item) => (mapPoolByMode[item] || []).length > 0);
  if (availableModes.length === 0) return { availableModes, cycleSet: new Set() };

  const cycleSet = new Set();
  history.forEach((game) => {
    if (!availableModes.includes(game.mapMode)) return;
    cycleSet.add(game.mapMode);
    if (cycleSet.size === availableModes.length) {
      cycleSet.clear();
    }
  });
  return { availableModes, cycleSet };
}

function isMapSelectable(map) {
  if (!state.settings.enableMapPick) return true;
  if (!map || !map.mode) return false;
  const mapPoolByMode = state.settings.mapPool || {};
  const pool = mapPoolByMode[map.mode] || [];
  if (!pool.includes(map.id)) return false;

  const usedInMode = state.history
    .filter((game) => game.mapMode === map.mode)
    .map((game) => game.mapId)
    .filter(Boolean);

  const isExhausted = pool.length > 0 && pool.every((id) => usedInMode.includes(id));
  if (!isExhausted && usedInMode.includes(map.id)) return false;

  const { availableModes, cycleSet } = computeAvailableModes(state.settings, state.history);
  if (availableModes.length > 0 && cycleSet.has(map.mode)) return false;

  return true;
}

function getSelectableMaps() {
  return state.assets.maps.filter((map) => isMapSelectable(map));
}

function getHeroByInputValue(inputId) {
  const value = document.getElementById(inputId)?.value?.trim() || "";
  if (!value) return null;
  return heroByName(value);
}

function isHeroSelectable(teamId, hero) {
  if (!state.settings.enableHeroBan) return true;
  if (!hero) return false;

  const usedBans = state.history.map((game) => game.bans?.[teamId]).filter(Boolean);
  if (usedBans.includes(hero.id)) return false;

  const otherTeamId = teamId === "team1" ? "team2" : "team1";
  const otherHero = getHeroByInputValue(otherTeamId === "team1" ? "ban-team1" : "ban-team2");
  if (otherHero) {
    if (otherHero.id === hero.id) return false;
    if (otherHero.role === hero.role) return false;
  }

  return true;
}

function getSelectableHeroes(teamId) {
  return state.assets.heroes.filter((hero) => isHeroSelectable(teamId, hero));
}

function renderInGame() {
  const map = state.assets.maps.find((item) => item.id === state.current.currentMapId);
  const mode = state.current.currentMapMode || (map ? map.mode : "");
  document.getElementById("map-input").value = map ? map.name : "";
  const ban1 = state.assets.heroes.find((item) => item.id === state.current.bans.team1);
  const ban2 = state.assets.heroes.find((item) => item.id === state.current.bans.team2);
  document.getElementById("ban-team1").value = ban1 ? ban1.name : "";
  document.getElementById("ban-team2").value = ban2 ? ban2.name : "";
  updateSideArea(mode);
  setSideSelection(state.current.side);
  renderSidePickOwner(mode);
  renderBanPriority();
  renderLayoutSwap();
}

function renderBanPriority() {
  const info = document.getElementById("banPriorityInfo");
  const controls = document.getElementById("banPriorityControls");
  const caption = document.getElementById("ban-order-caption");
  if (!state.settings.enableHeroBan) {
    if (info) info.style.display = "none";
    if (controls) controls.style.display = "none";
    return;
  }

  const owner = state.current.banChoiceOwner || state.current.banChoiceOwnerAuto;
  const ownerName = owner === "team2" ? state.teams.team2.name : state.teams.team1.name;
  const reason = state.current.banChoiceOwnerReason === "PREV_LOSER"
    ? "전 경기 패배팀"
    : "맵1: 시리즈 시작 선택권 팀";
  if (info) {
    info.textContent = `영웅밴 선택권 팀: ${ownerName} (${reason})`;
    info.style.display = "block";
  }

  if (controls) {
    controls.style.display = "grid";
  }
  if (caption) {
    caption.textContent = `선밴/후밴 선택(권한: ${ownerName})`;
  }

  const autoToggle = document.getElementById("ban-auto");
  const manualSelect = document.getElementById("ban-choice-owner");
  if (autoToggle) {
    autoToggle.checked = !state.current.banChoiceOwnerManual;
  }
  if (manualSelect) {
    manualSelect.disabled = !state.current.banChoiceOwnerManual;
    manualSelect.value = state.current.banChoiceOwnerManual || owner || "team1";
  }

  const order = state.current.banOrder || state.current.banOrderAuto || "A_FIRST";
  document.querySelectorAll("input[name='ban-order']").forEach((radio) => {
    radio.checked = radio.value === order;
  });
}

function renderSidePickOwner(mode) {
  const bar = document.getElementById("sideOwnerBar");
  if (!bar) return;
  const owner = state.current.sidePickOwner;
  const reason = state.current.sidePickReason;
  const ownerName = owner === "team2" ? state.teams.team2.name : state.teams.team1.name;
  const reasonText = reason === "PREV_LOSER"
    ? "전 경기 패배팀"
    : reason === "FALLBACK"
      ? "기록 누락으로 기본값 적용"
      : "맵1: 시리즈 시작 선택권 팀";
  bar.textContent = `공/수 선택팀: ${ownerName} (${reasonText})`;
  bar.style.display = "block";
}

function updateSideArea(mode) {
  const sideArea = document.getElementById("sideArea");
  const isSideMode = mode === "hybrid" || mode === "escort";
  sideArea.style.display = isSideMode ? "block" : "none";
}

function setSideSelection(value) {
  const radios = document.querySelectorAll("input[name='side']");
  radios.forEach((radio) => {
    radio.checked = radio.value === value;
  });
}

function getSelectedSide() {
  const selected = document.querySelector("input[name='side']:checked");
  return selected ? selected.value : "";
}

function computeLayoutSwapForAttackRight(attackTeam) {
  if (attackTeam === "team1") return true;
  if (attackTeam === "team2") return false;
  return state.current.layoutSwap;
}

function renderLayoutSwap() {
  const autoToggle = document.getElementById("layout-auto");
  const swapToggle = document.getElementById("layout-swap");
  if (!autoToggle || !swapToggle) return;
  autoToggle.checked = state.current.layoutSwapAuto !== false;
  swapToggle.checked = !!state.current.layoutSwap;
}

function getSelectedBanOrder() {
  const selected = document.querySelector("input[name='ban-order']:checked");
  return selected ? selected.value : "";
}

function renderHistory() {
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = "";
  state.history.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td class="map-col">
        <select data-field="mapId">
          <option value="">-</option>
          ${state.assets.maps
            .map((map) => `<option value="${map.id}" ${map.id === item.mapId ? "selected" : ""}>${map.name}</option>`)
            .join("")}
        </select>
      </td>
      <td class="ban-col">
        <select data-field="ban1">
          <option value="">-</option>
          ${state.assets.heroes
            .map((hero) => `<option value="${hero.id}" ${hero.id === item.bans?.team1 ? "selected" : ""}>${hero.name}</option>`)
            .join("")}
        </select>
      </td>
      <td class="ban-col">
        <select data-field="ban2">
          <option value="">-</option>
          ${state.assets.heroes
            .map((hero) => `<option value="${hero.id}" ${hero.id === item.bans?.team2 ? "selected" : ""}>${hero.name}</option>`)
            .join("")}
        </select>
      </td>
      <td>
        <select data-field="winner">
          <option value="team1" ${item.winner === "team1" ? "selected" : ""}>Team1</option>
          <option value="team2" ${item.winner === "team2" ? "selected" : ""}>Team2</option>
        </select>
      </td>
      <td><button class="secondary" data-action="delete">삭제</button></td>
    `;
    row.querySelector("[data-action='delete']").addEventListener("click", () => {
      state.history.splice(index, 1);
      renderHistory();
    });
    tbody.appendChild(row);
  });

  const banCols = document.querySelectorAll(".ban-col");
  banCols.forEach((col) => {
    col.style.display = state.settings.enableHeroBan ? "table-cell" : "none";
  });
  const mapCols = document.querySelectorAll(".map-col");
  mapCols.forEach((col) => {
    col.style.display = state.settings.enableMapPick ? "table-cell" : "none";
  });
}

function renderMatchInfo() {
  document.getElementById("match-name").value = state.settings.matchName;
  document.getElementById("match-series").value = state.settings.series;
  document.getElementById("first-pick").value = state.settings.firstPickTeamId;
  document.getElementById("toggle-hero").checked = state.settings.enableHeroBan;
  document.getElementById("toggle-map").checked = state.settings.enableMapPick;
  renderMapPool();
  toggleAreas();
}

function renderMapPool() {
  const mapPool = document.getElementById("mapPool");
  mapPool.innerHTML = "";

  const modes = ["control", "hybrid", "flashpoint", "push", "escort"];

  modes.forEach((mode) => {
    const group = document.createElement("div");
    group.className = "map-pool-group";
    const options = state.assets.maps.filter((map) => map.mode === mode);
    const chips = (state.settings.mapPool[mode] || []).map((id) => {
      const map = state.assets.maps.find((item) => item.id === id);
      return `<span class="chip">${map ? map.name : id}<button data-remove="${id}">×</button></span>`;
    });

    group.innerHTML = `
      <strong>${mode.toUpperCase()}</strong>
      <div class="map-pool-chips">${chips.join("") || "<span class='muted'>선택 없음</span>"}</div>
      <div class="map-pool-actions">
        <select data-mode="${mode}">
          <option value="">맵 추가</option>
          ${options.map((map) => `<option value="${map.id}">${map.name}</option>`).join("")}
        </select>
        <button class="secondary" data-random="${mode}">랜덤 선택</button>
      </div>
    `;

    group.querySelector("select").addEventListener("change", (event) => {
      const mapId = event.target.value;
      if (!mapId) return;
      const list = state.settings.mapPool[mode] || [];
      if (!list.includes(mapId)) list.push(mapId);
      state.settings.mapPool[mode] = list;
      renderMapPool();
    });

    group.querySelector("[data-random]").addEventListener("click", () => {
      const picks = shuffle(options.map((map) => map.id)).slice(0, 4);
      state.settings.mapPool[mode] = picks;
      renderMapPool();
    });

    group.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.remove;
        state.settings.mapPool[mode] = (state.settings.mapPool[mode] || []).filter((item) => item !== id);
        renderMapPool();
      });
    });

    mapPool.appendChild(group);
  });
}

function toggleAreas() {
  document.getElementById("mapPickArea").style.display = state.settings.enableMapPick ? "block" : "none";
  document.getElementById("mapPoolCard").style.display = state.settings.enableMapPick ? "block" : "none";
  document.getElementById("heroBanArea").style.display = state.settings.enableHeroBan ? "block" : "none";
  renderHistory();
  renderBanPriority();
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function bindEvents() {
  document.getElementById("refreshTeam").addEventListener("click", refreshAllData);
  document.getElementById("refreshInGame").addEventListener("click", refreshAllData);
  document.getElementById("refreshHistory").addEventListener("click", refreshAllData);
  document.getElementById("refreshMatch").addEventListener("click", refreshAllData);

  document.querySelectorAll(".search-input").forEach((wrapper) => {
    const input = wrapper.querySelector("input");
    const clearBtn = wrapper.querySelector(".clear-btn");
    if (!input || !clearBtn) return;
    const toggleClear = () => {
      clearBtn.classList.toggle("hidden", input.value.length === 0);
    };
    input.addEventListener("input", toggleClear);
    toggleClear();
  });

  document.querySelectorAll(".clear-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.clear;
      const input = document.getElementById(targetId);
      if (!input) return;
      input.value = "";
      input.dispatchEvent(new Event("input"));
      if (targetId === "map-input") {
        updateSideArea("");
        setSideSelection("");
      }
    });
  });
  document.getElementById("map-input").addEventListener("change", () => {
    const map = mapByName(document.getElementById("map-input").value.trim());
    updateSideArea(map ? map.mode : "");
    renderSidePickOwner(map ? map.mode : "");
  });

  document.querySelectorAll("input[name='side']").forEach((radio) => {
    radio.addEventListener("change", (event) => {
      state.current.side = event.target.value;
      const owner = state.current.sidePickOwner;
      const attackTeam = owner
        ? event.target.value === "attack"
          ? owner
          : owner === "team1"
            ? "team2"
            : "team1"
        : "";
      state.current.attackTeam = attackTeam;
      if (state.current.layoutSwapAuto !== false) {
        state.current.layoutSwap = computeLayoutSwapForAttackRight(attackTeam);
        renderLayoutSwap();
      }
    });
  });

  document.getElementById("layout-swap").addEventListener("change", (event) => {
    state.current.layoutSwap = event.target.checked;
    state.current.layoutSwapAuto = false;
    renderLayoutSwap();
  });

  document.getElementById("layout-auto").addEventListener("change", (event) => {
    state.current.layoutSwapAuto = event.target.checked;
    if (state.current.layoutSwapAuto) {
      state.current.layoutSwap = computeLayoutSwapForAttackRight(state.current.attackTeam);
    }
    renderLayoutSwap();
  });

  document.getElementById("ban-auto").addEventListener("change", (event) => {
    const manualSelect = document.getElementById("ban-choice-owner");
    const manualEnabled = !event.target.checked;
    manualSelect.disabled = !manualEnabled;
    state.current.banChoiceOwnerManual = manualEnabled ? manualSelect.value : "";
    renderBanPriority();
    updateBanControlState();
    publishInGameState("영웅밴 우선 설정이 적용되었습니다.", {
      skipMapPick: true,
      skipHeroBan: true
    });
  });

  document.getElementById("ban-choice-owner").addEventListener("change", (event) => {
    state.current.banChoiceOwnerManual = event.target.value;
    renderBanPriority();
    updateBanControlState();
    publishInGameState("영웅밴 우선 설정이 적용되었습니다.", {
      skipMapPick: true,
      skipHeroBan: true
    });
  });

  document.querySelectorAll("input[name='ban-order']").forEach((radio) => {
    radio.addEventListener("change", (event) => {
      state.current.banOrderManual = event.target.value;
      updateBanControlState();
      publishInGameState("선밴/후밴 설정이 적용되었습니다.", {
        skipMapPick: true,
        skipHeroBan: true
      });
    });
  });
  document.getElementById("team1-color").addEventListener("input", () => updateColorLabel("team1"));
  document.getElementById("team2-color").addEventListener("input", () => updateColorLabel("team2"));

  document.getElementById("team1-logo-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.teams.team1.logo = await readImageAsDataUrl(file);
    updateLogoPreview("team1");
  });

  document.getElementById("team2-logo-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.teams.team2.logo = await readImageAsDataUrl(file);
    updateLogoPreview("team2");
  });

  document.getElementById("team1-logo-clear").addEventListener("click", () => {
    state.teams.team1.logo = "";
    updateLogoPreview("team1");
  });

  document.getElementById("team1-logo-color").addEventListener("click", () => {
    applyDominantColor("team1");
  });

  document.getElementById("team2-logo-clear").addEventListener("click", () => {
    state.teams.team2.logo = "";
    updateLogoPreview("team2");
  });

  document.getElementById("team2-logo-color").addEventListener("click", () => {
    applyDominantColor("team2");
  });

  document.getElementById("saveTeams").addEventListener("click", async () => {
    state.teams.team1.name = document.getElementById("team1-name").value || "Team 1";
    state.teams.team2.name = document.getElementById("team2-name").value || "Team 2";
    state.teams.team1.color = document.getElementById("team1-color").value;
    state.teams.team2.color = document.getElementById("team2-color").value;

    await fetchJSON("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teams: state.teams })
    });

    wsPublish({
      context: "teams",
      teams: state.teams,
      settings: state.settings,
      state: state.current,
      history: state.history
    });
    showToast("팀 정보가 저장되었습니다.");
  });

  function updateBanControlState() {
    const autoToggle = document.getElementById("ban-auto");
    const manualSelect = document.getElementById("ban-choice-owner");
    const manualEnabled = autoToggle ? !autoToggle.checked : false;
    state.current.banChoiceOwnerManual = manualEnabled ? manualSelect.value : "";
    state.current.banOrderManual = getSelectedBanOrder();
  }

  function publishInGameState(message, extraPayload = {}) {
    wsPublish({
      context: "ingame",
      gameIndex: state.current.currentMatchIndex,
      settings: state.settings,
      teams: state.teams,
      state: state.current,
      history: state.history,
      ...extraPayload
    });
    refreshStateFromServer().then(() => {
      renderInGame();
      if (message) showToast(message);
    });
  }

  function getHeroFromCurrentState(teamId) {
    const heroId = state.current?.bans?.[teamId];
    if (!heroId) return null;
    return state.assets.heroes.find((hero) => hero.id === heroId) || null;
  }

  document.getElementById("applyMap").addEventListener("click", async () => {
    const map = mapByName(document.getElementById("map-input").value.trim());
    if (state.settings.enableMapPick && !map) {
      return alert("맵을 선택해주세요.");
    }
    if (state.settings.enableMapPick && map && !isMapSelectable(map)) {
      return alert("현재 규칙상 선택할 수 없는 맵입니다.");
    }

    state.current.currentMapId = map ? map.id : "";
    state.current.currentMapName = map ? map.name : "";
    state.current.currentMapMode = map ? map.mode : "";
    if (map && (map.mode === "hybrid" || map.mode === "escort")) {
      state.current.side = getSelectedSide();
      const owner = state.current.sidePickOwner;
      state.current.attackTeam = owner
        ? state.current.side === "attack"
          ? owner
          : owner === "team1"
            ? "team2"
            : "team1"
        : "";
    } else {
      state.current.side = "";
      state.current.attackTeam = "";
    }

    const layoutAuto = document.getElementById("layout-auto").checked;
    const layoutSwap = document.getElementById("layout-swap").checked;
    state.current.layoutSwapAuto = layoutAuto;
    state.current.layoutSwap = layoutAuto
      ? computeLayoutSwapForAttackRight(state.current.attackTeam)
      : layoutSwap;

    publishInGameState("맵이 적용되었습니다.", { skipHeroBan: true });
  });

  document.getElementById("applyBanTeam1").addEventListener("click", async () => {
    if (!state.settings.enableHeroBan) {
      return alert("영웅밴이 비활성화 상태입니다.");
    }
    const hero1 = heroByName(document.getElementById("ban-team1").value.trim());
    if (!hero1) {
      return alert("Team 1의 밴 영웅을 선택해주세요.");
    }
    if (hero1 && !isHeroSelectable("team1", hero1)) {
      return alert("Team 1이 선택할 수 없는 영웅입니다.");
    }

    const otherHero = heroByName(document.getElementById("ban-team2").value.trim()) || getHeroFromCurrentState("team2");
    if (hero1 && otherHero) {
      if (otherHero.id === hero1.id) {
        return alert("동일한 영웅을 선택할 수 없습니다.");
      }
      if (otherHero.role === hero1.role) {
        return alert("동일한 역할군의 영웅을 선택할 수 없습니다.");
      }
    }

    state.current.bans.team1 = hero1 ? hero1.id : "";
    updateBanControlState();

    publishInGameState("Team 1 밴이 적용되었습니다.");
  });

  document.getElementById("applyBanTeam2").addEventListener("click", async () => {
    if (!state.settings.enableHeroBan) {
      return alert("영웅밴이 비활성화 상태입니다.");
    }
    const hero2 = heroByName(document.getElementById("ban-team2").value.trim());
    if (!hero2) {
      return alert("Team 2의 밴 영웅을 선택해주세요.");
    }
    if (hero2 && !isHeroSelectable("team2", hero2)) {
      return alert("Team 2가 선택할 수 없는 영웅입니다.");
    }

    const otherHero = heroByName(document.getElementById("ban-team1").value.trim()) || getHeroFromCurrentState("team1");
    if (hero2 && otherHero) {
      if (otherHero.id === hero2.id) {
        return alert("동일한 영웅을 선택할 수 없습니다.");
      }
      if (otherHero.role === hero2.role) {
        return alert("동일한 역할군의 영웅을 선택할 수 없습니다.");
      }
    }

    state.current.bans.team2 = hero2 ? hero2.id : "";
    updateBanControlState();

    publishInGameState("Team 2 밴이 적용되었습니다.");
  });

  document.getElementById("resetInGameAll").addEventListener("click", async () => {
    document.getElementById("map-input").value = "";
    document.getElementById("map-input").dispatchEvent(new Event("input"));
    document.getElementById("ban-team1").value = "";
    document.getElementById("ban-team1").dispatchEvent(new Event("input"));
    document.getElementById("ban-team2").value = "";
    document.getElementById("ban-team2").dispatchEvent(new Event("input"));

    updateSideArea("");
    setSideSelection("");

    state.current.currentMapId = "";
    state.current.currentMapName = "";
    state.current.currentMapMode = "";
    state.current.side = "";
    state.current.attackTeam = "";
    state.current.bans.team1 = "";
    state.current.bans.team2 = "";
    updateBanControlState();

    const layoutAuto = document.getElementById("layout-auto").checked;
    const layoutSwap = document.getElementById("layout-swap").checked;
    state.current.layoutSwapAuto = layoutAuto;
    state.current.layoutSwap = layoutAuto
      ? computeLayoutSwapForAttackRight(state.current.attackTeam)
      : layoutSwap;

    publishInGameState("현재 경기 데이터가 초기화되었습니다.", { reset: true });
  });

  document.getElementById("finishMatch").addEventListener("click", () => {
    const summary = document.getElementById("finishSummary");
    const ban1 = state.assets.heroes.find((hero) => hero.id === state.current.bans.team1);
    const ban2 = state.assets.heroes.find((hero) => hero.id === state.current.bans.team2);
    const sideLabel = state.current.side === "attack" ? "공격" : state.current.side === "defense" ? "수비" : "-";
    summary.textContent = `${state.current.currentMapName || "-"} / 사이드: ${sideLabel} / 밴: ${ban1 ? ban1.name : "-"}, ${ban2 ? ban2.name : "-"}`;
    document.getElementById("finishModal").classList.add("active");
  });

  document.getElementById("cancelFinish").addEventListener("click", () => {
    document.getElementById("finishModal").classList.remove("active");
  });

  document.getElementById("confirmFinish").addEventListener("click", async () => {
    const winner = document.getElementById("finishWinner").value;
    state.history.push({
      index: state.current.currentMatchIndex,
      mapId: state.current.currentMapId,
      mapName: state.current.currentMapName,
      mapMode: state.current.currentMapMode,
      side: state.current.side || "",
      sidePickOwner: state.current.sidePickOwner || "",
      sidePickReason: state.current.sidePickReason || "",
      attackTeam: state.current.attackTeam || "",
      layoutSwap: !!state.current.layoutSwap,
      banChoiceOwner: state.current.banChoiceOwner || "",
      banOrder: state.current.banOrder || "",
      bans: { ...state.current.bans },
      winner
    });
    state.current.currentMatchIndex += 1;
    state.current.lastWinnerTeamId = winner;
    state.current.currentMapId = "";
    state.current.currentMapName = "";
    state.current.currentMapMode = "";
    state.current.side = "";
    state.current.bans = { team1: "", team2: "" };

    await fetchJSON("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: state.history })
    });

    await fetchJSON("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: state.current })
    });

    await refreshStateFromServer();

    wsPublish({
      context: "finish",
      settings: state.settings,
      teams: state.teams,
      state: state.current,
      history: state.history
    });
    renderHistory();
    renderInGame();
    document.getElementById("finishModal").classList.remove("active");
    showToast("경기 결과가 저장되었습니다.");
  });

  document.getElementById("saveHistory").addEventListener("click", async () => {
    const rows = Array.from(document.querySelectorAll("#historyTable tbody tr"));
    const nextHistory = rows.map((row, index) => {
      const mapId = row.querySelector("[data-field='mapId']").value;
      const ban1 = row.querySelector("[data-field='ban1']")?.value || "";
      const ban2 = row.querySelector("[data-field='ban2']")?.value || "";
      const winner = row.querySelector("[data-field='winner']").value;
      const map = state.assets.maps.find((item) => item.id === mapId);
      const prev = state.history[index];
      return {
        index: index + 1,
        mapId,
        mapName: map ? map.name : "",
        mapMode: map ? map.mode : "",
        side: prev?.side || "",
        sidePickOwner: prev?.sidePickOwner || "",
        sidePickReason: prev?.sidePickReason || "",
        attackTeam: prev?.attackTeam || "",
        layoutSwap: prev?.layoutSwap || false,
        banChoiceOwner: prev?.banChoiceOwner || "",
        banOrder: prev?.banOrder || "",
        bans: { team1: ban1, team2: ban2 },
        winner
      };
    });
    state.history = nextHistory;

    await fetchJSON("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: state.history })
    });

    await refreshStateFromServer();

    wsPublish({
      context: "history",
      settings: state.settings,
      teams: state.teams,
      state: state.current,
      history: state.history
    });
    renderHistory();
    showToast("기록이 저장되었습니다.");
  });

  document.getElementById("saveMatch").addEventListener("click", async () => {
    state.settings.matchName = document.getElementById("match-name").value || "OW2 Scrim";
    state.settings.series = document.getElementById("match-series").value;
    state.settings.firstPickTeamId = document.getElementById("first-pick").value;
    state.settings.enableHeroBan = document.getElementById("toggle-hero").checked;
    state.settings.enableMapPick = document.getElementById("toggle-map").checked;

    await fetchJSON("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: state.settings })
    });

    wsPublish({
      context: "settings",
      settings: state.settings,
      teams: state.teams,
      state: state.current,
      history: state.history
    });
    toggleAreas();
    showToast("매치 설정이 저장되었습니다.");
  });

  document.getElementById("selectAllMaps").addEventListener("click", () => {
    const modes = ["control", "hybrid", "flashpoint", "push", "escort"];
    modes.forEach((mode) => {
      state.settings.mapPool[mode] = state.assets.maps
        .filter((map) => map.mode === mode)
        .map((map) => map.id);
    });
    renderMapPool();
    showToast("맵 풀을 전체 선택했습니다.");
  });

  document.getElementById("resetAll").addEventListener("click", async () => {
    const confirmed = confirm("전체 초기화하시겠습니까?");
    if (!confirmed) return;
    await fetchJSON("/api/reset", { method: "POST" });
    const [settings, teams, current, history] = await Promise.all([
      fetchJSON("/api/settings"),
      fetchJSON("/api/teams"),
      fetchJSON("/api/state"),
      fetchJSON("/api/history")
    ]);
    state.settings = settings;
    state.teams = teams;
    state.current = current;
    state.history = history;
    renderTeamForm();
    renderInGame();
    renderHistory();
    renderMatchInfo();
    wsPublish({
      context: "settings",
      settings: state.settings,
      teams: state.teams,
      state: state.current,
      history: state.history
    });
    showToast("초기화 완료");
  });

  document.getElementById("toggle-hero").addEventListener("change", () => {
    state.settings.enableHeroBan = document.getElementById("toggle-hero").checked;
    toggleAreas();
  });
  document.getElementById("toggle-map").addEventListener("change", () => {
    state.settings.enableMapPick = document.getElementById("toggle-map").checked;
    toggleAreas();
  });
}

async function init() {
  connectWS();
  tabInit();

  const [settings, teams, current, history, maps, heroes] = await Promise.all([
    fetchJSON("/api/settings"),
    fetchJSON("/api/teams"),
    fetchJSON("/api/state"),
    fetchJSON("/api/history"),
    fetchJSON("/api/assets/maps"),
    fetchJSON("/api/assets/heroes")
  ]);

  state.settings = settings;
  state.teams = teams;
  state.current = current;
  state.history = history;
  state.assets.maps = maps;
  state.assets.heroes = heroes;

  renderDatalists();
  renderTeamForm();
  renderInGame();
  renderHistory();
  renderMatchInfo();
  bindEvents();

  setupAutocomplete({
    inputId: "map-input",
    containerId: "map-autocomplete",
    getItems: getSelectableMaps,
    onSelect: (map) => {
      updateSideArea(map.mode);
      renderSidePickOwner(map.mode);
    }
  });

  setupAutocomplete({
    inputId: "ban-team1",
    containerId: "ban-team1-autocomplete",
    getItems: () => getSelectableHeroes("team1"),
    onSelect: () => {}
  });

  setupAutocomplete({
    inputId: "ban-team2",
    containerId: "ban-team2-autocomplete",
    getItems: () => getSelectableHeroes("team2"),
    onSelect: () => {}
  });
}

init();
