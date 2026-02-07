const fs = require("fs");
const path = require("path");

const MAP_MODE_FOLDERS = {
  control: ["Control", "쟁탈", "control"],
  hybrid: ["Hybrid", "하이브리드", "혼합", "hybrid"],
  flashpoint: ["Flashpoint", "플래시포인트", "flashpoint"],
  push: ["Push", "밀기", "push"],
  escort: ["Escort", "호위", "escort"]
};

const HERO_ROLE_FOLDERS = {
  tank: ["tank", "돌격"],
  damage: ["damage", "공격"],
  support: ["support", "지원"]
};

function normalizeName(fileName) {
  const base = fileName.replace(/\.[^/.]+$/, "");
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scanMaps(rootDir) {
  const maps = [];
  const seen = new Set();
  const mapRootCandidates = [
    path.join(rootDir, "img", "maps"),
    path.join(rootDir, "img")
  ];

  for (const [modeKey, folderAliases] of Object.entries(MAP_MODE_FOLDERS)) {
    for (const baseRoot of mapRootCandidates) {
      if (!fs.existsSync(baseRoot)) continue;
      for (const folderName of folderAliases) {
        const dir = path.join(baseRoot, folderName);
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((file) => file.toLowerCase().endsWith(".png"));
        for (const file of files) {
          const name = normalizeName(file);
          const id = slugify(name);
          const key = `${modeKey}:${id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          maps.push({
            id,
            name,
            mode: modeKey,
            image: `/img/${baseRoot.endsWith("maps") ? "maps/" : ""}${folderName}/${file}`
          });
        }
      }
    }
  }

  return maps;
}

function scanHeroes(rootDir) {
  const heroes = [];
  const heroRoot = path.join(rootDir, "img", "hero");
  if (!fs.existsSync(heroRoot)) return heroes;

  for (const [roleKey, folderAliases] of Object.entries(HERO_ROLE_FOLDERS)) {
    for (const folderName of folderAliases) {
      const dir = path.join(heroRoot, folderName);
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((file) => file.toLowerCase().endsWith(".png"));
      for (const file of files) {
        const name = normalizeName(file);
        const id = slugify(name);
        heroes.push({
          id,
          name,
          role: roleKey,
          image: `/img/hero/${folderName}/${file}`
        });
      }
    }
  }

  return heroes;
}

module.exports = {
  scanMaps,
  scanHeroes,
  slugify
};
