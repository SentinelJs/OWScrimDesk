// @ts-check

const { scanMaps, scanHeroes } = require("../../assets/scan-assets");
const { getSelectableMapIds } = require("../../match/domain/rules");

/**
 * @typedef {import("../../../shared/contracts/types").StoreData} StoreData
 */

/**
 * @param {{
 *   rootDir: string,
 *   repository: { loadStore: () => StoreData, saveStore: (store: StoreData) => void },
 *   applyAllMeta: (data: StoreData) => void,
 *   applyBanPriorityMeta: (data: StoreData) => void,
 *   applyLayoutSwapMeta: (data: { state: StoreData["state"] }) => void
 * }} deps
 */
function createOverlayService(deps) {
  const {
    rootDir,
    repository,
    applyAllMeta,
    applyBanPriorityMeta,
    applyLayoutSwapMeta
  } = deps;

  let assets = {
    maps: scanMaps(rootDir),
    heroes: scanHeroes(rootDir)
  };

  function refreshAssets() {
    assets = {
      maps: scanMaps(rootDir),
      heroes: scanHeroes(rootDir)
    };
    return assets;
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

  /**
   * @param {StoreData["history"]} history
   */
  function computeScore(history) {
    const score = { team1: 0, team2: 0 };
    history.forEach((item) => {
      if (item.winner === "team1") score.team1 += 1;
      if (item.winner === "team2") score.team2 += 1;
    });
    return score;
  }

  /**
   * @param {StoreData} store
   */
  function buildBroadcastState(store) {
    refreshAssets();
    applyBanPriorityMeta(store);
    applyLayoutSwapMeta({ state: store.state });
    const selectableMapIds = getSelectableMapIds({
      enableMapPick: store.settings.enableMapPick,
      settings: store.settings,
      historyGames: store.history
    });
    return {
      settings: store.settings,
      teams: store.teams,
      state: store.state,
      history: store.history,
      score: computeScore(store.history),
      selectableMapIds,
      assets
    };
  }

  function buildOverlaySnapshot() {
    const store = repository.loadStore();
    applyAllMeta(store);
    repository.saveStore(store);
    return buildBroadcastState(store);
  }

  return {
    refreshAssets,
    getAssets,
    buildHeroLookup,
    buildMapLookup,
    buildBroadcastState,
    buildOverlaySnapshot
  };
}

module.exports = {
  createOverlayService
};
