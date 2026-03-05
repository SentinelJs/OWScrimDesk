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

module.exports = {
  DEFAULT_SETTINGS,
  DEFAULT_TEAMS,
  DEFAULT_STATE,
  normalizeSettings,
  normalizeEtcSettings
};
