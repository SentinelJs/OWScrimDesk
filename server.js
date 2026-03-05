const path = require("path");
const http = require("http");
const os = require("os");
const express = require("express");
const { readJson, writeJsonAtomic, ensureDir } = require("./src/storage");
const { scanMaps, scanHeroes } = require("./src/assets");
const { validateMapPick, getSelectableMapIds, validateBans } = require("./src/rules");
const { extractDominantColor } = require("./src/dominant-color");
const {
  DEFAULT_SETTINGS,
  DEFAULT_TEAMS,
  DEFAULT_STATE,
  normalizeSettings
} = require("./src/server/normalizers");
const {
  applyAllMeta,
  applyBanPriorityMeta,
  applyLayoutSwapMeta
} = require("./src/server/meta");
const { registerHttpRoutes } = require("./src/server/http-routes");
const { registerWebSocket } = require("./src/server/websocket");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const IN_GAME_ASSETS_DIR = path.join(ROOT_DIR, "public", "in-game-assets");
const IS_LAN_ACCESSIBLE = false;

ensureDir(DATA_DIR);

function loadAll() {
  const settings = normalizeSettings(readJson(path.join(DATA_DIR, "settings.json"), DEFAULT_SETTINGS));
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

function getAssets() {
  return assets;
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
  const selectableMapIds = getSelectableMapIds({
    enableMapPick: settings.enableMapPick,
    settings,
    historyGames: history
  });
  return {
    settings,
    teams,
    state,
    history,
    score: computeScore(history),
    selectableMapIds,
    assets
  };
}

function buildOverlaySnapshot() {
  const snapshotData = loadAll();
  applyAllMeta(snapshotData);
  saveAll(snapshotData);
  return buildBroadcastState(snapshotData);
}

async function fetchYouTubeDurationSecondsByVideoId(videoId) {
  if (typeof videoId !== "string" || !videoId.trim()) return null;

  const safeVideoId = videoId.trim();
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(safeVideoId)}&hl=ko&bpctr=9999999999&has_verified=1`;

  const response = await fetch(watchUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "ko,en-US;q=0.8,en;q=0.6"
    }
  });

  if (!response.ok) return null;
  const html = await response.text();

  const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
  if (lengthMatch && Number.isFinite(Number(lengthMatch[1]))) {
    return Math.max(1, Math.floor(Number(lengthMatch[1])));
  }

  const approxMatch = html.match(/"approxDurationMs":"(\d+)"/);
  if (approxMatch && Number.isFinite(Number(approxMatch[1]))) {
    return Math.max(1, Math.floor(Number(approxMatch[1]) / 1000));
  }

  return null;
}

const app = express();
app.use(express.json({ limit: "5mb" }));

registerHttpRoutes(app, {
  ROOT_DIR,
  IN_GAME_ASSETS_DIR,
  loadAll,
  saveAll,
  refreshAssets,
  getAssets,
  buildOverlaySnapshot,
  normalizeSettings,
  DEFAULT_SETTINGS,
  DEFAULT_TEAMS,
  DEFAULT_STATE,
  applyAllMeta,
  extractDominantColor,
  fetchYouTubeDurationSecondsByVideoId
});

const server = http.createServer(app);

registerWebSocket(server, {
  loadAll,
  saveAll,
  normalizeSettings,
  applyAllMeta,
  buildOverlaySnapshot,
  buildBroadcastState,
  buildMapLookup,
  buildHeroLookup,
  validateMapPick,
  validateBans
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running at http://localhost:3000");

  if (IS_LAN_ACCESSIBLE) {
    const nets = os.networkInterfaces();
    const lanIps = [];

    Object.values(nets).forEach((items) => {
      (items || []).forEach((item) => {
        if (!item || item.family !== "IPv4" || item.internal) return;
        lanIps.push(item.address);
      });
    });

    lanIps.forEach((ip) => {
      console.log(`LAN access: http://${ip}:3000`);
    });
  }
});
