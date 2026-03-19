const path = require("path");
const {
  HttpError,
  parseHistoryBody,
  parseTeamsBody,
  parseSettingsBody,
  parseStateBody,
  parseDominantColorBody,
  parseImageUrlBody,
  parseVideoId
} = require("../../shared/contracts/schemas");

async function fetchImageAsDataUrl(rawUrl, baseOrigin) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new HttpError(400, "url 데이터가 필요합니다.");
  }

  let resolved;
  try {
    resolved = new URL(rawUrl, baseOrigin);
  } catch {
    throw new HttpError(400, "유효한 이미지 URL이 아닙니다.");
  }

  if (!["http:", "https:"].includes(resolved.protocol)) {
    throw new HttpError(400, "http/https URL만 지원합니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(resolved.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "OWScrimDesk/1.0"
      }
    });

    if (!response.ok) {
      throw new HttpError(422, `이미지 다운로드 실패 (${response.status})`);
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new HttpError(422, "이미지 URL이 아닙니다.");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) {
      throw new HttpError(422, "이미지 데이터가 비어 있습니다.");
    }

    const maxBytes = 8 * 1024 * 1024;
    if (bytes.length > maxBytes) {
      throw new HttpError(413, "이미지 용량이 너무 큽니다. (최대 8MB)");
    }

    const base64 = Buffer.from(bytes).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.name === "AbortError") {
      throw new HttpError(504, "이미지 다운로드 시간이 초과되었습니다.");
    }
    throw new HttpError(500, error?.message || "이미지 변환 실패");
  } finally {
    clearTimeout(timeout);
  }
}

function registerHttpRoutes(app, deps) {
  const {
    PROJECT_ROOT,
    PUBLIC_DIR,
    IN_GAME_ASSETS_DIR,
    adminStateService,
    overlayService,
    extractDominantColor,
    fetchYouTubeDurationSecondsByVideoId
  } = deps;

  app.use("/img", expressStatic(path.join(PROJECT_ROOT, "img")));
  app.use("/video", expressStatic(path.join(PROJECT_ROOT, "video")));
  app.use(expressStatic(PUBLIC_DIR));
  app.use("/in-game-assets", expressStatic(IN_GAME_ASSETS_DIR));

  app.get("/in-game-overlay", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "overlay.html"));
  });

  app.get("/map-pick", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "map-pick.html"));
  });

  app.get("/hero-ban", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "hero-ban.html"));
  });

  app.get("/game-history", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "game-history.html"));
  });

  app.get("/match-start", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "match-start.html"));
  });

  app.get("/intermission", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "intermission.html"));
  });

  app.get("/waiting-room", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "waiting-room.html"));
  });

  app.get("/api/assets/maps", (req, res) => {
    overlayService.refreshAssets();
    res.json(overlayService.getAssets().maps);
  });

  app.get("/api/assets/heroes", (req, res) => {
    overlayService.refreshAssets();
    res.json(overlayService.getAssets().heroes);
  });

  app.get("/api/settings", (req, res) => {
    res.json(adminStateService.getSettings());
  });

  app.get("/api/teams", (req, res) => {
    res.json(adminStateService.getTeams());
  });

  app.get("/api/state", (req, res) => {
    res.json(adminStateService.getState());
  });

  app.get("/api/history", (req, res) => {
    res.json(adminStateService.getHistory());
  });

  app.get("/api/overlay/snapshot", (req, res) => {
    res.json(overlayService.buildOverlaySnapshot());
  });

  app.get("/api/youtube/duration", async (req, res) => {
    try {
      const videoId = parseVideoId(req.query?.videoId);
      const seconds = await fetchYouTubeDurationSecondsByVideoId(videoId);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        return res.status(404).json({ ok: false, message: "YouTube 영상 길이를 찾지 못했습니다." });
      }
      return res.json({ ok: true, durationSeconds: seconds });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ ok: false, message: error.message });
      }
      return res.status(500).json({ ok: false, message: error?.message || "YouTube 길이 조회 실패" });
    }
  });

  app.post("/api/history", (req, res) => {
    try {
      const { history } = parseHistoryBody(req.body);
      adminStateService.updateHistory(history);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ ok: false, message: error.message });
      }
      return res.status(500).json({ ok: false, message: error.message || "history 저장 실패" });
    }
  });

  app.post("/api/teams", (req, res) => {
    try {
      const { teams } = parseTeamsBody(req.body);
      adminStateService.updateTeams(teams);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ ok: false, message: error.message });
      }
      return res.status(500).json({ ok: false, message: error.message || "teams 저장 실패" });
    }
  });

  app.post("/api/teams/dominant-color", async (req, res) => {
    try {
      const { logo } = parseDominantColorBody(req.body);
      const result = await extractDominantColor(logo);
      if (!result.ok) {
        return res.status(422).json({ ok: false, message: result.reason || "색상 추출 실패" });
      }
      res.json({ ok: true, color: result.dominantHex });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ ok: false, message: error.message });
      }
      res.status(500).json({ ok: false, message: error.message || "색상 추출 오류" });
    }
  });

  app.post("/api/assets/image-data-url", async (req, res) => {
    try {
      const { url } = parseImageUrlBody(req.body);
      const origin = `${req.protocol}://${req.get("host")}`;
      const dataUrl = await fetchImageAsDataUrl(url, origin);
      return res.json({ ok: true, dataUrl });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ ok: false, message: error.message });
      }
      return res.status(500).json({ ok: false, message: error?.message || "이미지 변환 실패" });
    }
  });

  app.post("/api/settings", (req, res) => {
    try {
      const { settings } = parseSettingsBody(req.body);
      adminStateService.updateSettings(settings);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ ok: false, message: error.message });
      }
      return res.status(500).json({ ok: false, message: error.message || "settings 저장 실패" });
    }
  });

  app.post("/api/state", (req, res) => {
    try {
      const { state } = parseStateBody(req.body);
      adminStateService.updateState(state);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ ok: false, message: error.message });
      }
      return res.status(500).json({ ok: false, message: error.message || "state 저장 실패" });
    }
  });

  app.post("/api/reset", (req, res) => {
    adminStateService.reset();
    res.json({ ok: true });
  });
}

function expressStatic(targetPath) {
  const express = require("express");
  return express.static(targetPath);
}

module.exports = { registerHttpRoutes };
