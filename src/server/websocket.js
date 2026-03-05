const WebSocket = require("ws");

function createMessageSender(wss) {
  function send(client, type, payload) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, payload }));
    }
  }

  function broadcast(type, payload) {
    wss.clients.forEach((client) => send(client, type, payload));
  }

  return { send, broadcast };
}

function registerWebSocket(server, deps) {
  const {
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
  } = deps;

  const wss = new WebSocket.Server({ server });
  const { send, broadcast } = createMessageSender(wss);

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

  return { wss, send, broadcast };
}

module.exports = {
  registerWebSocket,
  createMessageSender
};
