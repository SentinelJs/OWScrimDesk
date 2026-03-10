// @ts-check

const path = require("path");
const { readJson, writeJsonAtomic, ensureDir } = require("../../shared/storage");

/**
 * @typedef {import("../../shared/contracts/types").StoreData} StoreData
 */

/**
 * @param {{
 *   dataDir: string,
 *   normalizeSettings: (settings: unknown) => any,
 *   DEFAULT_SETTINGS: any,
 *   DEFAULT_TEAMS: any,
 *   DEFAULT_STATE: any
 * }} deps
 */
function createJsonRepository(deps) {
  const {
    dataDir,
    normalizeSettings,
    DEFAULT_SETTINGS,
    DEFAULT_TEAMS,
    DEFAULT_STATE
  } = deps;

  ensureDir(dataDir);

  function loadStore() {
    const settings = normalizeSettings(readJson(path.join(dataDir, "settings.json"), DEFAULT_SETTINGS));
    const teams = readJson(path.join(dataDir, "teams.json"), DEFAULT_TEAMS);
    const state = readJson(path.join(dataDir, "state.json"), DEFAULT_STATE);
    const history = readJson(path.join(dataDir, "history.json"), []);
    return { settings, teams, state, history };
  }

  /**
   * @param {StoreData} store
   */
  function saveStore(store) {
    writeJsonAtomic(path.join(dataDir, "settings.json"), store.settings);
    writeJsonAtomic(path.join(dataDir, "teams.json"), store.teams);
    writeJsonAtomic(path.join(dataDir, "state.json"), store.state);
    writeJsonAtomic(path.join(dataDir, "history.json"), store.history);
  }

  function resetStore() {
    /** @type {StoreData} */
    const store = {
      settings: normalizeSettings(DEFAULT_SETTINGS),
      teams: DEFAULT_TEAMS,
      state: DEFAULT_STATE,
      history: []
    };
    saveStore(store);
    return store;
  }

  return {
    loadStore,
    saveStore,
    resetStore
  };
}

module.exports = {
  createJsonRepository
};
