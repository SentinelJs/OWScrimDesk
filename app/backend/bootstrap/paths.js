const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");
const APP_ROOT = path.join(PROJECT_ROOT, "app");
const BACKEND_ROOT = path.join(APP_ROOT, "backend");
const FRONTEND_ROOT = path.join(APP_ROOT, "frontend");
const PUBLIC_DIR = path.join(FRONTEND_ROOT, "public");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const IMG_DIR = path.join(PROJECT_ROOT, "img");
const VIDEO_DIR = path.join(PROJECT_ROOT, "video");
const IN_GAME_ASSETS_DIR = path.join(PUBLIC_DIR, "in-game-assets");

module.exports = {
  PROJECT_ROOT,
  APP_ROOT,
  BACKEND_ROOT,
  FRONTEND_ROOT,
  PUBLIC_DIR,
  DATA_DIR,
  IMG_DIR,
  VIDEO_DIR,
  IN_GAME_ASSETS_DIR
};
