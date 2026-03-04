import { state } from "./admin/core/state.js";
import { connectWS, fetchJSON, wsPublish } from "./admin/core/net.js";
import { showToast, showError } from "./admin/core/ui.js";
import { setupAutocomplete } from "./admin/core/autocomplete.js";

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
  views: {}
};

async function refreshStateFromServer() {
  const current = await fetchJSON("/api/state");
  state.current = current;
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

  if (ctx.views.renderTeamForm) ctx.views.renderTeamForm();
  if (ctx.views.renderInGame) ctx.views.renderInGame();
  if (ctx.views.renderHistory) ctx.views.renderHistory();
  if (ctx.views.renderMatchInfo) ctx.views.renderMatchInfo();
  if (ctx.views.renderEtc) ctx.views.renderEtc();

  showToast("최신 정보를 불러왔습니다.");
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
    btn.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      refreshAllData();
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
  bindTopLevelEvents();

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
