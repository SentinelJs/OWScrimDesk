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
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scanFilesInFolders(baseDirs, folderAliases, createItem) {
  const items = [];
  const seen = new Set();
  
  for (const baseDir of baseDirs) {
    if (!fs.existsSync(baseDir)) continue;
    
    for (const folderName of folderAliases) {
      const dir = path.join(baseDir, folderName);
      if (!fs.existsSync(dir)) continue;
      
      const files = fs.readdirSync(dir).filter((file) => file.toLowerCase().endsWith(".png"));
      for (const file of files) {
        const name = normalizeName(file);
        const id = slugify(name);
        const item = createItem(id, name, file, folderName, baseDir);
        const key = item.key;
        
        if (!seen.has(key)) {
          seen.add(key);
          items.push(item.data);
        }
      }
    }
  }
  
  return items;
}

function scanMaps(rootDir) {
  const mapRootCandidates = [
    path.join(rootDir, "img", "maps"),
    path.join(rootDir, "img")
  ];
  
  const maps = [];
  
  for (const [modeKey, folderAliases] of Object.entries(MAP_MODE_FOLDERS)) {
    const items = scanFilesInFolders(
      mapRootCandidates,
      folderAliases,
      (id, name, file, folderName, baseDir) => ({
        key: `${modeKey}:${id}`,
        data: {
          id,
          name,
          mode: modeKey,
          image: `/img/${baseDir.endsWith("maps") ? "maps/" : ""}${folderName}/${file}`
        }
      })
    );
    maps.push(...items);
  }
  
  return maps;
}

function scanHeroes(rootDir) {
  const heroRoot = path.join(rootDir, "img", "hero");
  if (!fs.existsSync(heroRoot)) return [];
  
  const heroes = [];
  
  for (const [roleKey, folderAliases] of Object.entries(HERO_ROLE_FOLDERS)) {
    const items = scanFilesInFolders(
      [heroRoot],
      folderAliases,
      (id, name, file, folderName) => ({
        key: `${roleKey}:${id}`,
        data: {
          id,
          name,
          role: roleKey,
          image: `/img/hero/${folderName}/${file}`
        }
      })
    );
    heroes.push(...items);
  }
  
  return heroes;
}

module.exports = {
  scanMaps,
  scanHeroes,
  slugify
};
