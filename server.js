const path = require("path");
const http = require("http");
const os = require("os");
const express = require("express");
const WebSocket = require("ws");
const { readJson, writeJsonAtomic, ensureDir } = require("./src/storage");
const { scanMaps, scanHeroes } = require("./src/assets");
const { validateMapPick, getSelectableMapIds, validateBans, getSidePickOwner } = require("./src/rules");
const { extractDominantColor } = require("./src/dominant-color");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const IN_GAME_ASSETS_DIR = path.join(ROOT_DIR, "public", "in-game-assets");

ensureDir(DATA_DIR);

const DEFAULT_SETTINGS = {
  matchName: "OW2 Scrim",
  matchLogo: "",
  series: "Bo3",
  firstPickTeamId: "team1",
  enableHeroBan: true,
  enableMapPick: true,
  etc: {
    sponsor: "",
    breakContentType: "youtube",
    breakContentUrl: "",
    breakContents: [],
    selectedBreakContentId: "",
    revision: 0,
    rotationSeed: 0,
    breakMinutes: 10,
    breakSeconds: 0,
    players: {
      team1: [],
      team2: []
    }
  },
  mapPool: {
    control: [],
    hybrid: [],
    flashpoint: [],
    push: [],
    escort: []
  }
};

function normalizeEtcSettings(etc) {
  const source = etc || {};
  const players = source.players || {};

  const normalizeContentItem = (item, index) => {
    const safeType = item?.type === "image" ? "image" : "youtube";
    const safeUrl = typeof item?.url === "string" ? item.url : "";
    const safeId = typeof item?.id === "string" && item.id.trim()
      ? item.id.trim()
      : `content-${index + 1}`;
    const safeDuration = Number(item?.durationSeconds);
    return {
      id: safeId,
      title: typeof item?.title === "string" ? item.title : `콘텐츠 ${index + 1}`,
      type: safeType,
      url: safeUrl,
      durationSeconds: Number.isFinite(safeDuration)
        ? Math.max(1, Math.min(36000, Math.floor(safeDuration)))
        : 30,
      enabled: item?.enabled !== false,
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index
    };
  };

  const rawContents = Array.isArray(source.breakContents)
    ? source.breakContents
    : (typeof source.breakContentUrl === "string" && source.breakContentUrl.trim())
      ? [{
          id: "legacy-1",
          title: "기존 콘텐츠",
          type: source.breakContentType === "image" ? "image" : "youtube",
          url: source.breakContentUrl,
          enabled: true,
          order: 0
        }]
      : [];

  const legacyDuration = Number(source.breakDurationSeconds);
  const breakContents = rawContents
    .slice(0, 200)
    .map((item, index) => normalizeContentItem({
      ...item,
      durationSeconds: item?.durationSeconds ?? legacyDuration
    }, index))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));

  const selectedBreakContentId = typeof source.selectedBreakContentId === "string"
    ? source.selectedBreakContentId
    : "";
  const revision = Number(source.revision);
  const rotationSeed = Number(source.rotationSeed ?? source.autoRotateSeed);

  const normalizePlayers = (value) => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 10).map((player) => ({
      name: typeof player?.name === "string" ? player.name : "",
      position: typeof player?.position === "string" ? player.position : "",
      mainHero: typeof player?.mainHero === "string" ? player.mainHero : "",
      tier: typeof player?.tier === "string" ? player.tier : ""
    }));
  };

  const minutes = Number(source.breakMinutes);
  const seconds = Number(source.breakSeconds);

  return {
    sponsor: typeof source.sponsor === "string" ? source.sponsor : "",
    breakContentType: source.breakContentType === "image" ? "image" : "youtube",
    breakContentUrl: typeof source.breakContentUrl === "string" ? source.breakContentUrl : "",
    breakContents,
    selectedBreakContentId: breakContents.some((item) => item.id === selectedBreakContentId)
      ? selectedBreakContentId
      : (breakContents[0]?.id || ""),
    revision: Number.isFinite(revision) ? Math.max(0, Math.floor(revision)) : 0,
    rotationSeed: Number.isFinite(rotationSeed) ? Math.max(0, Math.floor(rotationSeed)) : 0,
    breakMinutes: Number.isFinite(minutes) ? Math.max(0, Math.min(180, minutes)) : 10,
    breakSeconds: Number.isFinite(seconds) ? Math.max(0, Math.min(59, seconds)) : 0,
    players: {
      team1: normalizePlayers(players.team1),
      team2: normalizePlayers(players.team2)
    }
  };
}

function normalizeSettings(settings) {
  const source = settings || {};
  const mapPool = source.mapPool || {};
  return {
    matchName: typeof source.matchName === "string" ? source.matchName : DEFAULT_SETTINGS.matchName,
    matchLogo: typeof source.matchLogo === "string" ? source.matchLogo : "",
    series: source.series || DEFAULT_SETTINGS.series,
    firstPickTeamId: source.firstPickTeamId || DEFAULT_SETTINGS.firstPickTeamId,
    enableHeroBan: source.enableHeroBan !== false,
    enableMapPick: source.enableMapPick !== false,
    etc: normalizeEtcSettings(source.etc),
    mapPool: {
      control: Array.isArray(mapPool.control) ? mapPool.control : [],
      hybrid: Array.isArray(mapPool.hybrid) ? mapPool.hybrid : [],
      flashpoint: Array.isArray(mapPool.flashpoint) ? mapPool.flashpoint : [],
      push: Array.isArray(mapPool.push) ? mapPool.push : [],
      escort: Array.isArray(mapPool.escort) ? mapPool.escort : []
    }
  };
}

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
  overlayTeamSwap: false,
  overlayRoleSwap: false,
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

function normalizeMatchIndex(state, history) {
  const maxIndex = history.length + 1;
  if (!state.currentMatchIndex || state.currentMatchIndex < 1) {
    state.currentMatchIndex = 1;
  }
  if (state.currentMatchIndex > maxIndex) {
    state.currentMatchIndex = maxIndex;
  }
}

function applySidePickMeta({ settings, state, history }) {
  normalizeMatchIndex(state, history);
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
    Object.assign(state, {
      banChoiceOwnerAuto: "",
      banChoiceOwner: "",
      banChoiceOwnerReason: "",
      banOrderAuto: "",
      banOrder: ""
    });
    return;
  }
  
  normalizeMatchIndex(state, history);
  const gameIndex = state.currentMatchIndex;
  const initialLeadTeam = settings.firstPickTeamId;
  const prev = gameIndex > 1 ? history.find((game) => game.index === gameIndex - 1) : null;
  
  if (gameIndex === 1 || !prev || !prev.winner) {
    state.banChoiceOwnerAuto = initialLeadTeam;
    state.banChoiceOwnerReason = "MAP1_INITIAL";
  } else {
    state.banChoiceOwnerAuto = prev.winner === "team1" ? "team2" : "team1";
    state.banChoiceOwnerReason = "PREV_LOSER";
  }

  state.banChoiceOwner = ["team1", "team2"].includes(state.banChoiceOwnerManual)
    ? state.banChoiceOwnerManual
    : state.banChoiceOwnerAuto;

  state.banOrderAuto = state.banChoiceOwnerAuto === "team1" ? "A_FIRST" : "B_FIRST";
  state.banOrder = ["A_FIRST", "B_FIRST"].includes(state.banOrderManual)
    ? state.banOrderManual
    : state.banOrderAuto;
}

function applyLayoutSwapMeta({ state }) {
  state.attackTeam = state.sidePickOwner
    ? (state.side === "attack" ? state.sidePickOwner : (state.side === "defense" ? (state.sidePickOwner === "team1" ? "team2" : "team1") : ""))
    : "";

  state.overlayTeamSwap = !!state.overlayTeamSwap;
  state.overlayRoleSwap = !!state.overlayRoleSwap;

  const hasAttack = ["team1", "team2"].includes(state.attackTeam);
  const standardLeftTeamId = hasAttack && state.attackTeam === "team1" ? "team2" : "team1";
  const currentLeftTeamId = state.overlayTeamSwap ? (standardLeftTeamId === "team1" ? "team2" : "team1") : standardLeftTeamId;
  state.layoutSwap = currentLeftTeamId === "team2";
}

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

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use("/img", express.static(path.join(ROOT_DIR, "img")));
app.use("/video", express.static(path.join(ROOT_DIR, "video")));
app.use(express.static(path.join(ROOT_DIR, "public")));
app.use("/in-game-assets", express.static(IN_GAME_ASSETS_DIR));

app.get("/in-game-overlay", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "overlay.html"));
});

app.get("/map-pick", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "map-pick.html"));
});

app.get("/hero-ban", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "hero-ban.html"));
});

app.get("/game-history", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "game-history.html"));
});

app.get("/match-start", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "match-start.html"));
});

app.get("/intermission", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "intermission.html"));
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

function applyAllMeta(data) {
  applySidePickMeta(data);
  applyBanPriorityMeta(data);
  applyLayoutSwapMeta(data);
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
  applyAllMeta(data);
  saveAll(data);
  res.json(data.state);
});

app.get("/api/history", (req, res) => {
  const { history } = loadAll();
  res.json(history);
});

app.get("/api/overlay/snapshot", (req, res) => {
  const snapshot = buildOverlaySnapshot();
  res.json(snapshot);
});

app.get("/api/youtube/duration", async (req, res) => {
  const videoId = typeof req.query?.videoId === "string" ? req.query.videoId.trim() : "";
  if (!videoId) {
    return res.status(400).json({ ok: false, message: "videoId 파라미터가 필요합니다." });
  }

  try {
    const seconds = await fetchYouTubeDurationSecondsByVideoId(videoId);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return res.status(404).json({ ok: false, message: "YouTube 영상 길이를 찾지 못했습니다." });
    }
    return res.json({ ok: true, durationSeconds: seconds });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.message || "YouTube 길이 조회 실패" });
  }
});

app.post("/api/history", (req, res) => {
  const { history } = req.body;
  if (!Array.isArray(history)) {
    return res.status(400).json({ ok: false, message: "history 배열이 필요합니다." });
  }
  const data = loadAll();
  data.history = history;
  applyAllMeta(data);
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
  const currentEtc = data.settings?.etc || {};
  let mergedEtc = currentEtc;

  if (settings.etc) {
    const incomingEtc = settings.etc;
    const candidateEtc = {
      ...currentEtc,
      ...incomingEtc,
      players: incomingEtc.players
        ? {
            ...(currentEtc.players || {}),
            ...incomingEtc.players
          }
        : (currentEtc.players || {})
    };

    const incomingRevision = Number(incomingEtc.revision);
    const currentRevision = Number(currentEtc.revision) || 0;
    const hasIncomingRevision = Number.isFinite(incomingRevision);

    mergedEtc = !hasIncomingRevision || incomingRevision >= currentRevision
      ? candidateEtc
      : currentEtc;
  }

  const mergedSettings = {
    ...data.settings,
    ...settings,
    etc: mergedEtc,
    mapPool: settings.mapPool
      ? {
          ...(data.settings?.mapPool || {}),
          ...settings.mapPool
        }
      : (data.settings?.mapPool || {})
  };

  data.settings = normalizeSettings(mergedSettings);
  applyAllMeta(data);
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
  applyAllMeta(data);
  saveAll(data);
  res.json({ ok: true });
});

app.post("/api/reset", (req, res) => {
  const data = {
    settings: normalizeSettings(DEFAULT_SETTINGS),
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
        const snapshot = buildOverlaySnapshot();
        send(ws, "overlay:update", snapshot);
        return;
      }

      if (data.type === "admin:publish") {
        const payload = data.payload || {};
        const store = loadAll();
        const settings = normalizeSettings(payload.settings || store.settings);
        const teams = payload.teams || store.teams;
        const state = payload.state || store.state;
        const history = payload.history || store.history;
        const context = payload.context || "ingame";
        const isReset = !!payload.reset;
        const skipHeroBan = !!payload.skipHeroBan;
        const skipMapPick = !!payload.skipMapPick;
        const gameIndex = payload.gameIndex;
        applyAllMeta({ settings, state, history });

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

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running at http://localhost:3000");
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
});
