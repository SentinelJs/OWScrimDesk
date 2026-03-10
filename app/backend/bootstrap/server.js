const path = require("path");
const http = require("http");
const os = require("os");
const express = require("express");
const { ensureDir } = require("../shared/storage");
const { validateMapPick, validateBans } = require("../modules/match/domain/rules");
const { extractDominantColor } = require("../modules/teams/application/dominant-color");
const {
  DEFAULT_SETTINGS,
  DEFAULT_TEAMS,
  DEFAULT_STATE,
  normalizeSettings
} = require("../modules/match/domain/normalizers");
const {
  applyAllMeta,
  applyBanPriorityMeta,
  applyLayoutSwapMeta
} = require("../modules/match/domain/meta");
const { createJsonRepository } = require("../platform/persistence/json-repository");
const { createOverlayService } = require("../modules/overlay/application/overlay-service");
const { createAdminStateService } = require("../modules/match/application/admin-state-service");
const { createAdminPublishService } = require("../modules/match/application/admin-publish-service");
const { registerHttpRoutes } = require("../platform/http/http-routes");
const { registerWebSocket } = require("../platform/ws/websocket");
const {
  PROJECT_ROOT,
  PUBLIC_DIR,
  DATA_DIR,
  IN_GAME_ASSETS_DIR
} = require("./paths");
const IS_LAN_ACCESSIBLE = false;
const requestedPort = Number(process.env.PORT);
const PORT = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 0;

ensureDir(DATA_DIR);

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

const app = express();
app.use(express.json({ limit: "5mb" }));

const repository = createJsonRepository({
  dataDir: DATA_DIR,
  normalizeSettings,
  DEFAULT_SETTINGS,
  DEFAULT_TEAMS,
  DEFAULT_STATE
});

const overlayService = createOverlayService({
  rootDir: PROJECT_ROOT,
  repository,
  applyAllMeta,
  applyBanPriorityMeta,
  applyLayoutSwapMeta
});

const adminStateService = createAdminStateService({
  repository,
  normalizeSettings,
  applyAllMeta
});

const adminPublishService = createAdminPublishService({
  repository,
  normalizeSettings,
  applyAllMeta,
  overlayService,
  validateMapPick,
  validateBans
});

registerHttpRoutes(app, {
  PROJECT_ROOT,
  PUBLIC_DIR,
  IN_GAME_ASSETS_DIR,
  adminStateService,
  overlayService,
  extractDominantColor,
  fetchYouTubeDurationSecondsByVideoId
});

const server = http.createServer(app);

registerWebSocket(server, {
  overlayService,
  adminPublishService
});

server.listen(PORT, "0.0.0.0", () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : PORT;
  console.log(`Server running at http://localhost:${activePort}`);

  if (IS_LAN_ACCESSIBLE) {
    const nets = os.networkInterfaces();
    const lanIps = [];

    Object.values(nets).forEach((items) => {
      (items || []).forEach((item) => {
        if (!item || item.family !== "IPv4" || item.internal) return;
        lanIps.push(item.address);
      });
    });

    lanIps.forEach((ip) => {
      console.log(`LAN access: http://${ip}:${activePort}`);
    });
  }
});
