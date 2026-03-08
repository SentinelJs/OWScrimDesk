import { state } from "./admin/core/state.js";
import { connectWS, fetchJSON, wsPublish } from "./admin/core/net.js";
import { showToast, showError } from "./admin/core/ui.js";
import { setupAutocomplete } from "./admin/core/autocomplete.js";
import { bindBeforeUnload, createUnsavedChangesManager } from "./admin/core/unsaved.js";

import { createTeamModule } from "./admin/features/team.js";
import { createInGameModule } from "./admin/features/ingame.js";
import { createHistoryModule } from "./admin/features/history.js";
import { createMatchModule } from "./admin/features/match.js";
import { createEtcModule } from "./admin/features/etc.js";

const ctx = {
  state,
  fetchJSON,
  wsPublish,
  showToast,
  showError,
  views: {},
  unsaved: createUnsavedChangesManager()
};

function getUnsavedWarningMessage(action = "계속") {
  const dirtyTabs = ctx.unsaved.getDirtyTabs();
  if (dirtyTabs.length === 0) {
    return `저장되지 않은 변경사항이 있습니다. 저장하지 않고 ${action}하시겠습니까?`;
  }
  const labels = dirtyTabs.map((item) => item.label).join(", ");
  return `저장되지 않은 변경사항이 있습니다. (${labels}) 저장하지 않고 ${action}하시겠습니까?`;
}

function activateTab(tabName) {
  const tabs = document.querySelectorAll("#tabs button");
  tabs.forEach((item) => item.classList.toggle("active", item.dataset.tab === tabName));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  document.getElementById(`tab-${tabName}`)?.classList.add("active");
}

async function refreshStateFromServer() {
  const current = await fetchJSON("/api/state");
  state.current = current;
}

async function refreshAllData(options = {}) {
  const { force = false, showSuccessToast = true } = options;
  if (!force && ctx.unsaved.hasAnyDirty()) {
    const confirmed = ctx.unsaved.confirmDiscard(
      getUnsavedWarningMessage("새로 불러오시겠습니까?")
    );
    if (!confirmed) return false;
  }

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

  if (ctx.views.renderTeamForm) ctx.views.renderTeamForm();
  if (ctx.views.renderInGame) ctx.views.renderInGame();
  if (ctx.views.renderHistory) ctx.views.renderHistory();
  if (ctx.views.renderMatchInfo) ctx.views.renderMatchInfo();
  if (ctx.views.renderEtc) ctx.views.renderEtc();
  ctx.unsaved.syncAll();

  if (showSuccessToast) {
    showToast("최신 정보를 불러왔습니다.");
  }
  return true;
}

ctx.refreshStateFromServer = refreshStateFromServer;
ctx.refreshAllData = refreshAllData;

function bindTopLevelEvents() {
  const refreshMap = {
    refreshTeam: refreshAllData,
    refreshInGame: refreshAllData,
    refreshHistory: refreshAllData,
    refreshMatch: refreshAllData,
    refreshEtc: refreshAllData
  };

  Object.entries(refreshMap).forEach(([id, handler]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
  });
}

function tabInit() {
  const tabs = document.querySelectorAll("#tabs button");
  tabs.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.classList.contains("active")) return;
      if (ctx.unsaved.hasAnyDirty()) {
        const confirmed = ctx.unsaved.confirmDiscard(
          getUnsavedWarningMessage("탭을 이동하시겠습니까?")
        );
        if (!confirmed) return;
      }

      const refreshed = await refreshAllData({ force: true });
      if (!refreshed) return;
      activateTab(btn.dataset.tab);
    });
  });
}

async function init() {
  connectWS((message) => showError(message));
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

  const teamModule = createTeamModule(ctx);
  const ingameModule = createInGameModule(ctx);
  const historyModule = createHistoryModule(ctx);
  const matchModule = createMatchModule(ctx);
  const etcModule = createEtcModule(ctx);

  ctx.views.renderTeamForm = teamModule.render;
  ctx.views.renderInGame = ingameModule.render;
  ctx.views.renderHistory = historyModule.render;
  ctx.views.renderMatchInfo = matchModule.render;
  ctx.views.renderEtc = etcModule.render;

  ctx.unsaved.register("team", "Team", teamModule.getSnapshot);
  ctx.unsaved.register("ingame", "In-Game", ingameModule.getSnapshot);
  ctx.unsaved.register("history", "History", historyModule.getSnapshot);
  ctx.unsaved.register("match", "Match Info", matchModule.getSnapshot);

  teamModule.render();
  ingameModule.render();
  historyModule.render();
  matchModule.render();
  etcModule.render();

  teamModule.bind();
  ingameModule.bind();
  historyModule.bind();
  matchModule.bind();
  etcModule.bind();
  ctx.unsaved.syncAll();
  bindTopLevelEvents();
  bindBeforeUnload(ctx.unsaved);

  setupAutocomplete({
    inputId: "map-input",
    containerId: "map-autocomplete",
    getItems: ingameModule.getSelectableMaps,
    onSelect: (map) => {
      ingameModule.updateSideArea(map.mode);
      ingameModule.renderSidePickOwner();
    }
  });

  setupAutocomplete({
    inputId: "ban-team1",
    containerId: "ban-team1-autocomplete",
    getItems: () => ingameModule.getSelectableHeroes("team1"),
    onSelect: () => {}
  });

  setupAutocomplete({
    inputId: "ban-team2",
    containerId: "ban-team2-autocomplete",
    getItems: () => ingameModule.getSelectableHeroes("team2"),
    onSelect: () => {}
  });
}

init();
