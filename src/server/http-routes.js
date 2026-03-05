const path = require("path");

function registerHttpRoutes(app, deps) {
  const {
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
  } = deps;

  app.use("/img", expressStatic(path.join(ROOT_DIR, "img")));
  app.use("/video", expressStatic(path.join(ROOT_DIR, "video")));
  app.use(expressStatic(path.join(ROOT_DIR, "public")));
  app.use("/in-game-assets", expressStatic(IN_GAME_ASSETS_DIR));

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

  app.get("/api/assets/maps", (req, res) => {
    refreshAssets();
    res.json(getAssets().maps);
  });

  app.get("/api/assets/heroes", (req, res) => {
    refreshAssets();
    res.json(getAssets().heroes);
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
}

function expressStatic(targetPath) {
  const express = require("express");
  return express.static(targetPath);
}

module.exports = { registerHttpRoutes };
