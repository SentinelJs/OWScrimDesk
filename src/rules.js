const VALID_MAP_MODES = ["control", "hybrid", "flashpoint", "push", "escort"];

function validateMapPick({ enableMapPick, mode, mapId, settings, historyGames }) {
  if (!enableMapPick) {
    return { ok: true };
  }

  if (!mode || !VALID_MAP_MODES.includes(mode)) {
    return { ok: false, code: "INVALID_MODE", message: "맵 모드가 올바르지 않습니다." };
  }

  if (!mapId) {
    return { ok: false, code: "MAP_REQUIRED", message: "맵을 선택해주세요." };
  }

  const mapPoolByMode = settings.mapPool || {};
  const pool = mapPoolByMode[mode] || [];
  if (!pool.includes(mapId)) {
    return { ok: false, code: "MAP_NOT_IN_POOL", message: "선택한 맵이 현재 설정된 맵 풀에 없습니다." };
  }

  const usedInMode = historyGames
    .filter((game) => game.mapMode === mode)
    .map((game) => game.mapId)
    .filter(Boolean);

  const isExhausted = pool.length > 0 && pool.every((id) => usedInMode.includes(id));
  if (!isExhausted && usedInMode.includes(mapId)) {
    return {
      ok: false,
      code: "MAP_ALREADY_USED",
      message: "이미 사용된 맵입니다. (해당 모드의 맵 풀이 소진되기 전 재사용 불가)"
    };
  }

  const availableModes = VALID_MAP_MODES.filter((item) => (mapPoolByMode[item] || []).length > 0);
  if (availableModes.length > 0) {
    const cycleSet = new Set();
    historyGames.forEach((game) => {
      if (!availableModes.includes(game.mapMode)) return;
      cycleSet.add(game.mapMode);
      if (cycleSet.size === availableModes.length) {
        cycleSet.clear();
      }
    });
    if (cycleSet.has(mode)) {
      const remainingModes = availableModes.filter((item) => !cycleSet.has(item));
      return {
        ok: false,
        code: "MODE_REPEAT_NOT_ALLOWED",
        message: `모드가 아직 순환 완료되지 않았습니다. (${remainingModes.join(", ")}) 사용 전까지 ${mode} 중복 불가)`
      };
    }
  }

  return { ok: true };
}

function getSelectableMapIds({ enableMapPick, settings, historyGames }) {
  if (!enableMapPick) {
    return [];
  }

  const mapPoolByMode = settings?.mapPool || {};
  const selectable = [];

  VALID_MAP_MODES.forEach((mode) => {
    const pool = Array.isArray(mapPoolByMode[mode]) ? mapPoolByMode[mode] : [];
    pool.forEach((mapId) => {
      const result = validateMapPick({
        enableMapPick,
        mode,
        mapId,
        settings,
        historyGames
      });
      if (result.ok) {
        selectable.push(mapId);
      }
    });
  });

  return selectable;
}

function validateBans({ enableHeroBan, banA, banB, heroesById, historyGames }) {
  if (!enableHeroBan || (!banA && !banB)) {
    return { ok: true };
  }

  const heroA = banA ? heroesById.get(banA) : null;
  const heroB = banB ? heroesById.get(banB) : null;
  
  if ((banA && !heroA) || (banB && !heroB)) {
    return {
      ok: false,
      code: "BAN_INVALID_HERO",
      message: "밴 영웅이 존재하지 않습니다."
    };
  }

  if (banA && banB && banA === banB) {
    return {
      ok: false,
      code: "BAN_SAME_HERO_BOTH_TEAMS",
      message: "양 팀이 같은 영웅을 동시에 밴할 수 없습니다."
    };
  }

  const usedBansA = historyGames.map((game) => game.bans?.team1).filter(Boolean);
  const usedBansB = historyGames.map((game) => game.bans?.team2).filter(Boolean);

  const duplicateChecks = [
    { ban: banA, used: usedBansA, team: "Team 1", code: "BAN_DUPLICATE_IN_SERIES_TEAM_A" },
    { ban: banB, used: usedBansB, team: "Team 2", code: "BAN_DUPLICATE_IN_SERIES_TEAM_B" }
  ];

  for (const { ban, used, team, code } of duplicateChecks) {
    if (ban && used.includes(ban)) {
      return {
        ok: false,
        code,
        message: `${team}은 시리즈에서 동일 영웅을 2번 밴할 수 없습니다.`
      };
    }
  }

  if (heroA && heroB && heroA.role === heroB.role) {
    return {
      ok: false,
      code: "BAN_SAME_ROLE_CONFLICT",
      message: `이번 맵에서 이미 ${heroA.role} 역할군이 밴되어 상대는 같은 역할군을 밴할 수 없습니다.`
    };
  }

  return { ok: true };
}

function getSidePickOwner({ gameIndex, initialLeadTeam, historyGames }) {
  if (gameIndex === 1) {
    return { ownerTeam: initialLeadTeam, reason: "MAP1_INITIAL" };
  }
  const prev = historyGames.find((game) => game.index === gameIndex - 1);
  if (!prev || !prev.winner) {
    return { ownerTeam: initialLeadTeam, reason: "FALLBACK" };
  }
  const ownerTeam = prev.winner === "team1" ? "team2" : "team1";
  return { ownerTeam, reason: "PREV_LOSER" };
}

module.exports = {
  validateMapPick,
  getSelectableMapIds,
  validateBans,
  getSidePickOwner
};
