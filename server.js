const path = require("path");
const http = require("http");
const express = require("express");
const WebSocket = require("ws");
const { readJson, writeJsonAtomic, ensureDir } = require("./src/storage");
const { scanMaps, scanHeroes } = require("./src/assets");
const { validateMapPick, validateBans, getSidePickOwner } = require("./src/rules");
const { extractDominantColor } = require("./dominant-color");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const IN_GAME_OVERLAY_DIR = path.join(ROOT_DIR, "public", "in-game-overlay");
const IN_GAME_ASSETS_DIR = path.join(ROOT_DIR, "public", "in-game-assets");

ensureDir(DATA_DIR);

const DEFAULT_SETTINGS = {
  matchName: "OW2 Scrim",
  series: "Bo3",
  firstPickTeamId: "team1",
  enableHeroBan: true,
  enableMapPick: true,
  mapPool: {
    control: [],
    hybrid: [],
    flashpoint: [],
    push: [],
    escort: []
  }
};

const DEFAULT_TEAMS = {
  team1: { id: "team1", name: "Team 1", color: "#101014", logo: "" },
  team2: { id: "team2", name: "Team 2", color: "#101014", logo: "" }
};

const DEFAULT_STATE = {
  currentMatchIndex: 1,
  currentMapId: "",
  currentMapName: "",
  currentMapMode: "",
  side: "",
  sidePickOwner: "",
  sidePickReason: "",
  attackTeam: "",
  layoutSwap: false,
  layoutSwapAuto: true,
  banChoiceOwnerAuto: "",
  banChoiceOwnerManual: "",
  banChoiceOwner: "",
  banChoiceOwnerReason: "",
  banOrderAuto: "",
  banOrderManual: "",
  banOrder: "",
  bans: { team1: "", team2: "" },
  firstBanTeamId: "",
  lastWinnerTeamId: ""
};

function applySidePickMeta({ settings, state, history }) {
  const maxIndex = history.length + 1;
  if (!state.currentMatchIndex || state.currentMatchIndex < 1) {
    state.currentMatchIndex = 1;
  }
  if (state.currentMatchIndex > maxIndex) {
    state.currentMatchIndex = maxIndex;
  }
  const { ownerTeam, reason } = getSidePickOwner({
    gameIndex: state.currentMatchIndex,
    initialLeadTeam: settings.firstPickTeamId,
    historyGames: history
  });
  state.sidePickOwner = ownerTeam;
  state.sidePickReason = reason;
}

function applyBanPriorityMeta({ settings, state, history }) {
  if (!settings.enableHeroBan) {
    state.banChoiceOwnerAuto = "";
    state.banChoiceOwner = "";
    state.banChoiceOwnerReason = "";
    state.banOrderAuto = "";
    state.banOrder = "";
    return;
  }
  const maxIndex = history.length + 1;
  if (!state.currentMatchIndex || state.currentMatchIndex < 1) {
    state.currentMatchIndex = 1;
  }
  if (state.currentMatchIndex > maxIndex) {
    state.currentMatchIndex = maxIndex;
  }
  const gameIndex = state.currentMatchIndex;
  const initialLeadTeam = settings.firstPickTeamId;
  if (gameIndex === 1) {
    state.banChoiceOwnerAuto = initialLeadTeam;
    state.banChoiceOwnerReason = "MAP1_INITIAL";
  } else {
    const prev = history.find((game) => game.index === gameIndex - 1);
    if (!prev || !prev.winner) {
      state.banChoiceOwnerAuto = initialLeadTeam;
      state.banChoiceOwnerReason = "MAP1_INITIAL";
    } else {
      state.banChoiceOwnerAuto = prev.winner === "team1" ? "team2" : "team1";
      state.banChoiceOwnerReason = "PREV_LOSER";
    }
  }

  const manualOwner = ["team1", "team2"].includes(state.banChoiceOwnerManual)
    ? state.banChoiceOwnerManual
    : "";
  state.banChoiceOwner = manualOwner || state.banChoiceOwnerAuto;

  state.banOrderAuto = state.banChoiceOwnerAuto === "team1" ? "A_FIRST" : "B_FIRST";
  const manualOrder = ["A_FIRST", "B_FIRST"].includes(state.banOrderManual)
    ? state.banOrderManual
    : "";
  state.banOrder = manualOrder || state.banOrderAuto;
}

function applyLayoutSwapMeta({ state }) {
  if (state.sidePickOwner && state.side) {
    if (state.side === "attack") {
      state.attackTeam = state.sidePickOwner;
    } else if (state.side === "defense") {
      state.attackTeam = state.sidePickOwner === "team1" ? "team2" : "team1";
    }
  }
  if (state.layoutSwapAuto === false) {
    return;
  }
  if (state.attackTeam === "team1") {
    state.layoutSwap = true;
  } else if (state.attackTeam === "team2") {
    state.layoutSwap = false;
  }
}

function loadAll() {
  const settings = readJson(path.join(DATA_DIR, "settings.json"), DEFAULT_SETTINGS);
  const teams = readJson(path.join(DATA_DIR, "teams.json"), DEFAULT_TEAMS);
  const state = readJson(path.join(DATA_DIR, "state.json"), DEFAULT_STATE);
  const history = readJson(path.join(DATA_DIR, "history.json"), []);
  return { settings, teams, state, history };
}

function saveAll({ settings, teams, state, history }) {
  writeJsonAtomic(path.join(DATA_DIR, "settings.json"), settings);
  writeJsonAtomic(path.join(DATA_DIR, "teams.json"), teams);
  writeJsonAtomic(path.join(DATA_DIR, "state.json"), state);
  writeJsonAtomic(path.join(DATA_DIR, "history.json"), history);
}

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use("/img", express.static(path.join(ROOT_DIR, "img")));
app.use(express.static(path.join(ROOT_DIR, "public")));
app.use("/in-game-assets", express.static(IN_GAME_ASSETS_DIR));

app.get("/in-game-overlay", (req, res) => {
  res.sendFile(path.join(IN_GAME_OVERLAY_DIR, "overlay.html"));
});

app.get("/map-pick", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "map-pick.html"));
});

app.get("/hero-ban", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "hero-ban.html"));
});

let assets = {
  maps: scanMaps(ROOT_DIR),
  heroes: scanHeroes(ROOT_DIR)
};

function refreshAssets() {
  assets = {
    maps: scanMaps(ROOT_DIR),
    heroes: scanHeroes(ROOT_DIR)
  };
}

function buildHeroLookup() {
  return new Map(assets.heroes.map((hero) => [hero.id, hero]));
}

function buildMapLookup() {
  return new Map(assets.maps.map((map) => [map.id, map]));
}

function computeScore(history) {
  const score = { team1: 0, team2: 0 };
  history.forEach((item) => {
    if (item.winner === "team1") score.team1 += 1;
    if (item.winner === "team2") score.team2 += 1;
  });
  return score;
}

function buildBroadcastState({ settings, teams, state, history }) {
  refreshAssets();
  applyBanPriorityMeta({ settings, state, history });
  applyLayoutSwapMeta({ state });
  return {
    settings,
    teams,
    state,
    history,
    score: computeScore(history),
    assets
  };
}

app.get("/api/assets/maps", (req, res) => {
  refreshAssets();
  res.json(assets.maps);
});

app.get("/api/assets/heroes", (req, res) => {
  refreshAssets();
  res.json(assets.heroes);
});

app.get("/api/settings", (req, res) => {
  const { settings } = loadAll();
  res.json(settings);
});

app.get("/api/teams", (req, res) => {
  const { teams } = loadAll();
  res.json(teams);
});

app.get("/api/state", (req, res) => {
  const data = loadAll();
  applySidePickMeta(data);
  applyBanPriorityMeta(data);
  applyLayoutSwapMeta(data);
  saveAll(data);
  const { state } = data;
  res.json(state);
});

app.get("/api/history", (req, res) => {
  const { history } = loadAll();
  res.json(history);
});

app.post("/api/history", (req, res) => {
  const { history } = req.body;
  if (!Array.isArray(history)) {
    return res.status(400).json({ ok: false, message: "history 배열이 필요합니다." });
  }
  const data = loadAll();
  data.history = history;
  applySidePickMeta(data);
  applyBanPriorityMeta(data);
  applyLayoutSwapMeta(data);
  saveAll(data);
  res.json({ ok: true });
});

app.post("/api/teams", (req, res) => {
  const { teams } = req.body;
  if (!teams) {
    return res.status(400).json({ ok: false, message: "teams 데이터가 필요합니다." });
  }
  const data = loadAll();
  data.teams = teams;
  saveAll(data);
  res.json({ ok: true });
});

app.post("/api/teams/dominant-color", async (req, res) => {
  const { logo } = req.body;
  if (!logo) {
    return res.status(400).json({ ok: false, message: "logo 데이터가 필요합니다." });
  }
  try {
    const result = await extractDominantColor(logo);
    if (!result.ok) {
      return res.status(422).json({ ok: false, message: result.reason || "색상 추출 실패" });
    }
    res.json({ ok: true, color: result.dominantHex });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "색상 추출 오류" });
  }
});

app.post("/api/settings", (req, res) => {
  const { settings } = req.body;
  if (!settings) {
    return res.status(400).json({ ok: false, message: "settings 데이터가 필요합니다." });
  }
  const data = loadAll();
  data.settings = settings;
  applySidePickMeta(data);
  applyBanPriorityMeta(data);
  applyLayoutSwapMeta(data);
  saveAll(data);
  res.json({ ok: true });
});

app.post("/api/state", (req, res) => {
  const { state } = req.body;
  if (!state) {
    return res.status(400).json({ ok: false, message: "state 데이터가 필요합니다." });
  }
  const data = loadAll();
  data.state = state;
  applySidePickMeta(data);
  applyBanPriorityMeta(data);
  applyLayoutSwapMeta(data);
  saveAll(data);
  res.json({ ok: true });
});

app.post("/api/reset", (req, res) => {
  const data = {
    settings: DEFAULT_SETTINGS,
    teams: DEFAULT_TEAMS,
    state: DEFAULT_STATE,
    history: []
  };
  saveAll(data);
  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function send(client, type, payload) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type, payload }));
  }
}

function broadcast(type, payload) {
  wss.clients.forEach((client) => send(client, type, payload));
}

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === "overlay:hello") {
        const snapshotData = loadAll();
        applySidePickMeta(snapshotData);
        applyBanPriorityMeta(snapshotData);
        applyLayoutSwapMeta(snapshotData);
        saveAll(snapshotData);
        const snapshot = buildBroadcastState(snapshotData);
        send(ws, "overlay:update", snapshot);
        return;
      }

      if (data.type === "admin:publish") {
        const payload = data.payload || {};
        const store = loadAll();
        const settings = payload.settings || store.settings;
        const teams = payload.teams || store.teams;
        const state = payload.state || store.state;
        const history = payload.history || store.history;
        const context = payload.context || "ingame";
        const isReset = !!payload.reset;
        const skipHeroBan = !!payload.skipHeroBan;
        const skipMapPick = !!payload.skipMapPick;
        const gameIndex = payload.gameIndex;
        applySidePickMeta({ settings, state, history });
        applyBanPriorityMeta({ settings, state, history });
        applyLayoutSwapMeta({ state });

        const mapLookup = buildMapLookup();
        const heroLookup = buildHeroLookup();

        const mapData = mapLookup.get(state.currentMapId);
        const mapMode = mapData ? mapData.mode : state.currentMapMode;
        if (context === "ingame" && settings.enableMapPick && !isReset && !skipMapPick) {
          if (!mapData) {
            return send(ws, "admin:error", {
              code: "MAP_NOT_FOUND",
              message: "선택한 맵이 존재하지 않습니다."
            });
          }
          const mapValidation = validateMapPick({
            enableMapPick: settings.enableMapPick,
            mode: mapMode,
            mapId: state.currentMapId,
            settings,
            historyGames: history
          });
          if (!mapValidation.ok) {
            return send(ws, "admin:error", {
              code: mapValidation.code,
              message: mapValidation.message
            });
          }
        }

        if (context === "ingame" && !isReset && !skipMapPick) {
          if (mapMode === "hybrid" || mapMode === "escort") {
            if (!state.side || !["attack", "defense"].includes(state.side)) {
              return send(ws, "admin:error", {
                code: "HYBRID_ESCORT_SIDE_REQUIRED",
                message: "Hybrid/호위 전장에서는 공격/수비를 선택해야 합니다."
              });
            }
          } else {
            state.side = "";
            state.attackTeam = "";
          }
        } else if (context === "ingame" && isReset) {
          state.side = "";
          state.attackTeam = "";
        }

        if (context === "ingame" && settings.enableHeroBan && !isReset && !skipHeroBan) {
          if (gameIndex && gameIndex !== state.currentMatchIndex) {
            return send(ws, "admin:error", {
              code: "BAN_PRIORITY_STATE_MISMATCH",
              message: "현재 경기 인덱스와 적용 대상이 일치하지 않습니다."
            });
          }
          const priorityTeamByOrder = state.banOrder === "A_FIRST"
            ? "team1"
            : state.banOrder === "B_FIRST"
              ? "team2"
              : "";
          const priorityTeam = priorityTeamByOrder || state.banChoiceOwner || state.banChoiceOwnerAuto;
          if (priorityTeam === "team1" || priorityTeam === "team2") {
            const otherTeam = priorityTeam === "team1" ? "team2" : "team1";
            const priorityBanEmpty = !state.bans?.[priorityTeam];
            const otherBanSelected = !!state.bans?.[otherTeam];
            if (priorityBanEmpty && otherBanSelected) {
              return send(ws, "admin:error", {
                code: "BAN_PRIORITY_REQUIRED",
                message: "우선팀이 먼저 영웅밴을 적용해야 합니다."
              });
            }
          }
          if (
            (state.banChoiceOwnerManual && !["team1", "team2"].includes(state.banChoiceOwnerManual)) ||
            (state.banOrderManual && !["A_FIRST", "B_FIRST"].includes(state.banOrderManual))
          ) {
            return send(ws, "admin:error", {
              code: "INVALID_BAN_PRIORITY_VALUE",
              message: "영웅밴 우선팀/선밴 설정 값이 올바르지 않습니다."
            });
          }
          const heroValidation = validateBans({
            enableHeroBan: settings.enableHeroBan,
            banA: state.bans.team1,
            banB: state.bans.team2,
            heroesById: heroLookup,
            historyGames: history
          });
          if (!heroValidation.ok) {
            return send(ws, "admin:error", {
              code: heroValidation.code,
              message: heroValidation.message
            });
          }
        }

        state.currentMapName = mapData ? mapData.name : "";
        state.currentMapMode = mapData ? mapData.mode : state.currentMapMode;

        saveAll({ settings, teams, state, history });
        const snapshot = buildBroadcastState({ settings, teams, state, history });
        broadcast("overlay:update", snapshot);
        send(ws, "admin:ok", { ok: true });
        return;
      }
    } catch (error) {
      send(ws, "admin:error", { message: "요청 처리 중 오류가 발생했습니다." });
    }
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
