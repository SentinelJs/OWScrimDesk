// @ts-check

const { HttpError } = require("../../../shared/contracts/schemas");

/**
 * @typedef {import("../../../shared/contracts/types").AdminPublishPayload} AdminPublishPayload
 * @typedef {import("../../../shared/contracts/types").StoreData} StoreData
 */

/**
 * @param {{
 *   repository: { loadStore: () => StoreData, saveStore: (store: StoreData) => void },
 *   normalizeSettings: (settings: unknown) => any,
 *   applyAllMeta: (data: StoreData) => void,
 *   overlayService: {
 *     buildMapLookup: () => Map<string, any>,
 *     buildHeroLookup: () => Map<string, any>,
 *     buildBroadcastState: (store: StoreData) => any
 *   },
 *   validateMapPick: (args: any) => { ok: boolean, code?: string, message?: string },
 *   validateBans: (args: any) => { ok: boolean, code?: string, message?: string }
 * }} deps
 */
function createAdminPublishService(deps) {
  const {
    repository,
    normalizeSettings,
    applyAllMeta,
    overlayService,
    validateMapPick,
    validateBans
  } = deps;

  /**
   * @param {AdminPublishPayload} payload
   */
  function publish(payload) {
    const store = repository.loadStore();
    const settings = normalizeSettings(payload.settings || store.settings);
    const teams = payload.teams || store.teams;
    const state = payload.state || store.state;
    const history = payload.history || store.history;
    const context = payload.context || "ingame";
    const isReset = !!payload.reset;
    const skipHeroBan = !!payload.skipHeroBan;
    const skipMapPick = !!payload.skipMapPick;
    const gameIndex = payload.gameIndex;

    /** @type {StoreData} */
    const nextStore = { settings, teams, state, history };
    applyAllMeta(nextStore);

    const mapLookup = overlayService.buildMapLookup();
    const heroLookup = overlayService.buildHeroLookup();

    const mapData = mapLookup.get(state.currentMapId);
    const mapMode = mapData ? mapData.mode : state.currentMapMode;
    if (context === "ingame" && settings.enableMapPick && !isReset && !skipMapPick) {
      if (!mapData) {
        throw new HttpError(400, "선택한 맵이 존재하지 않습니다.");
      }

      const mapValidation = validateMapPick({
        enableMapPick: settings.enableMapPick,
        mode: mapMode,
        mapId: state.currentMapId,
        settings,
        historyGames: history
      });
      if (!mapValidation.ok) {
        throw new HttpError(400, mapValidation.message || "맵 검증에 실패했습니다.");
      }
    }

    if (context === "ingame" && !isReset && !skipMapPick) {
      if (mapMode === "hybrid" || mapMode === "escort") {
        if (!state.side || !["attack", "defense"].includes(state.side)) {
          throw new HttpError(400, "Hybrid/호위 전장에서는 공격/수비를 선택해야 합니다.");
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
        throw new HttpError(400, "현재 경기 인덱스와 적용 대상이 일치하지 않습니다.");
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
          throw new HttpError(400, "우선팀이 먼저 영웅밴을 적용해야 합니다.");
        }
      }

      if (
        (state.banChoiceOwnerManual && !["team1", "team2"].includes(state.banChoiceOwnerManual)) ||
        (state.banOrderManual && !["A_FIRST", "B_FIRST"].includes(state.banOrderManual))
      ) {
        throw new HttpError(400, "영웅밴 우선팀/선밴 설정 값이 올바르지 않습니다.");
      }

      const heroValidation = validateBans({
        enableHeroBan: settings.enableHeroBan,
        banA: state.bans.team1,
        banB: state.bans.team2,
        heroesById: heroLookup,
        historyGames: history
      });
      if (!heroValidation.ok) {
        throw new HttpError(400, heroValidation.message || "영웅 밴 검증에 실패했습니다.");
      }
    }

    state.currentMapName = mapData ? mapData.name : "";
    state.currentMapMode = mapData ? mapData.mode : state.currentMapMode;

    repository.saveStore(nextStore);

    return {
      store: nextStore,
      snapshot: overlayService.buildBroadcastState(nextStore)
    };
  }

  return {
    publish
  };
}

module.exports = {
  createAdminPublishService
};
