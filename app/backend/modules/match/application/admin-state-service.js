// @ts-check

/**
 * @typedef {import("../../../shared/contracts/types").StoreData} StoreData
 */

/**
 * @param {{
 *   repository: {
 *     loadStore: () => StoreData,
 *     saveStore: (store: StoreData) => void,
 *     resetStore: () => StoreData
 *   },
 *   normalizeSettings: (value: unknown) => any,
 *   applyAllMeta: (data: StoreData) => void
 * }} deps
 */
function createAdminStateService(deps) {
  const { repository, normalizeSettings, applyAllMeta } = deps;

  function getSettings() {
    return repository.loadStore().settings;
  }

  function getTeams() {
    return repository.loadStore().teams;
  }

  function getHistory() {
    return repository.loadStore().history;
  }

  function getState() {
    const store = repository.loadStore();
    applyAllMeta(store);
    repository.saveStore(store);
    return store.state;
  }

  /**
   * @param {StoreData["history"]} history
   */
  function updateHistory(history) {
    const store = repository.loadStore();
    store.history = history;
    applyAllMeta(store);
    repository.saveStore(store);
    return store;
  }

  /**
   * @param {StoreData["teams"]} teams
   */
  function updateTeams(teams) {
    const store = repository.loadStore();
    store.teams = teams;
    repository.saveStore(store);
    return store;
  }

  /**
   * @param {Record<string, any>} settings
   */
  function updateSettings(settings) {
    const store = repository.loadStore();
    /** @type {Record<string, any>} */
    const currentEtc = store.settings?.etc || {};
    /** @type {Record<string, any>} */
    let mergedEtc = currentEtc;

    if (settings.etc) {
      /** @type {Record<string, any>} */
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
      ...store.settings,
      ...settings,
      etc: mergedEtc,
      mapPool: settings.mapPool
        ? {
            ...(store.settings?.mapPool || {}),
            ...settings.mapPool
          }
        : (store.settings?.mapPool || {})
    };

    store.settings = normalizeSettings(mergedSettings);
    applyAllMeta(store);
    repository.saveStore(store);
    return store;
  }

  /**
   * @param {StoreData["state"]} state
   */
  function updateState(state) {
    const store = repository.loadStore();
    store.state = state;
    applyAllMeta(store);
    repository.saveStore(store);
    return store;
  }

  function reset() {
    return repository.resetStore();
  }

  return {
    getSettings,
    getTeams,
    getHistory,
    getState,
    updateHistory,
    updateTeams,
    updateSettings,
    updateState,
    reset
  };
}

module.exports = {
  createAdminStateService
};
