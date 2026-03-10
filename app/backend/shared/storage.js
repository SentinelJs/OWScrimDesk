const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempPath, filePath);
}

module.exports = {
  ensureDir,
  readJson,
  writeJsonAtomic
};
