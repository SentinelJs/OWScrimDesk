// dominant-color.js
// npm i sharp
// Node.js 18+
// 입력: base64(데이터URL 포함 가능) 또는 Buffer 또는 파일경로(string)
// 출력: 거의 흰색/검정 제외한 지배색(대표색) HEX

const sharp = require("sharp");

// ---- color utils ----
function rgbToHex(r, g, b) {
  const toHex = (v) => v.toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function isNearWhite(r, g, b, thr = 245) {
  return r >= thr && g >= thr && b >= thr;
}
function isNearBlack(r, g, b, thr = 15) {
  return r <= thr && g <= thr && b <= thr;
}

// RGB -> LAB (D65)
function rgbToLab(r, g, b) {
  const srgb = [r, g, b].map((v) => v / 255);
  const lin = srgb.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));

  const X = (lin[0] * 0.4124564 + lin[1] * 0.3575761 + lin[2] * 0.1804375) / 0.95047;
  const Y = (lin[0] * 0.2126729 + lin[1] * 0.7151522 + lin[2] * 0.0721750) / 1.0;
  const Z = (lin[0] * 0.0193339 + lin[1] * 0.1191920 + lin[2] * 0.9503041) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(X), fy = f(Y), fz = f(Z);
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bb = 200 * (fy - fz);
  return [L, a, bb];
}

function labDist2(a, b) {
  const d0 = a[0] - b[0];
  const d1 = a[1] - b[1];
  const d2 = a[2] - b[2];
  return d0 * d0 + d1 * d1 + d2 * d2;
}

function collectPointsFromImage(data, info, options) {
  const {
    step,
    alphaMin,
    nearWhiteThr,
    nearBlackThr,
    ignoreTransparent,
    ignoreNearWhite,
    ignoreNearBlack
  } = options;

  const points = [];
  const w = info.width;
  const h = info.height;
  const channels = info.channels;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels >= 4 ? data[i + 3] : 255;

      if (ignoreTransparent && a < alphaMin) continue;
      if (ignoreNearWhite && isNearWhite(r, g, b, nearWhiteThr)) continue;
      if (ignoreNearBlack && isNearBlack(r, g, b, nearBlackThr)) continue;

      points.push({ rgb: [r, g, b], lab: rgbToLab(r, g, b) });
    }
  }

  return points;
}

// ---- decoding input ----
function decodeImageInput(input) {
  if (Buffer.isBuffer(input)) return input;

  if (typeof input === "string") {
    // data URL
    if (input.startsWith("data:")) {
      const comma = input.indexOf(",");
      if (comma === -1) throw new Error("Invalid data URL");
      const b64 = input.slice(comma + 1);
      return Buffer.from(b64, "base64");
    }

    // raw base64 (heuristic)
    const maybeB64 = input.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(input);
    if (maybeB64) return Buffer.from(input.replace(/\s+/g, ""), "base64");

    // assume file path
    return input;
  }

  throw new Error("Unsupported input type. Use Buffer, base64 string, data URL, or file path string.");
}

// ---- k-means in LAB ----
function kmeans(points, k, maxIter = 25) {
  if (!points.length) return null;
  k = Math.max(1, Math.min(k, points.length));

  // init centers: random unique
  const centers = [];
  const used = new Set();
  while (centers.length < k) {
    const idx = Math.floor(Math.random() * points.length);
    if (used.has(idx)) continue;
    used.add(idx);
    centers.push(points[idx].lab.slice());
  }

  let assign = new Array(points.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    // assign
    for (let i = 0; i < points.length; i++) {
      const p = points[i].lab;
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = labDist2(p, centers[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed = true;
      }
    }

    // recompute
    const sum = Array.from({ length: k }, () => [0, 0, 0]);
    const cnt = new Array(k).fill(0);

    for (let i = 0; i < points.length; i++) {
      const c = assign[i];
      const p = points[i].lab;
      sum[c][0] += p[0];
      sum[c][1] += p[1];
      sum[c][2] += p[2];
      cnt[c] += 1;
    }

    for (let c = 0; c < k; c++) {
      if (cnt[c] === 0) {
        const idx = Math.floor(Math.random() * points.length);
        centers[c] = points[idx].lab.slice();
      } else {
        centers[c] = [sum[c][0] / cnt[c], sum[c][1] / cnt[c], sum[c][2] / cnt[c]];
      }
    }

    if (!changed && iter > 0) break;
  }

  // cluster RGB mean + counts
  const rgbSum = Array.from({ length: k }, () => [0, 0, 0]);
  const rgbCnt = new Array(k).fill(0);

  for (let i = 0; i < points.length; i++) {
    const c = assign[i];
    const [r, g, b] = points[i].rgb;
    rgbSum[c][0] += r;
    rgbSum[c][1] += g;
    rgbSum[c][2] += b;
    rgbCnt[c] += 1;
  }

  const clusters = [];
  for (let c = 0; c < k; c++) {
    if (rgbCnt[c] === 0) continue;
    const r = Math.round(rgbSum[c][0] / rgbCnt[c]);
    const g = Math.round(rgbSum[c][1] / rgbCnt[c]);
    const b = Math.round(rgbSum[c][2] / rgbCnt[c]);
    clusters.push({ rgb: [r, g, b], count: rgbCnt[c] });
  }

  clusters.sort((a, b) => b.count - a.count);
  return clusters;
}

// ---- main API ----
async function extractDominantColor(input, options = {}) {
  const {
    k = 5,
    step = 3,                 // 샘플링 간격(1=전부)
    maxSize = 360,            // 리사이즈 최대 변
    alphaMin = 10,            // 투명 픽셀 제외 기준
    nearWhiteThr = 245,       // 거의 흰색 제외 기준
    nearBlackThr = 15,        // 거의 검정 제외 기준
    ignoreTransparent = true,
    ignoreNearWhite = true,
    ignoreNearBlack = true,
    returnPalette = false,    // true면 팔레트도 반환
  } = options;

  const src = decodeImageInput(input);

  // resize -> raw RGBA
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .resize({
      width: maxSize,
      height: maxSize,
      fit: "inside",
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const attempts = [
    {
      ignoreTransparent,
      ignoreNearWhite,
      ignoreNearBlack,
      nearWhiteThr,
      nearBlackThr,
      fallbackStage: "strict"
    },
    {
      ignoreTransparent,
      ignoreNearWhite,
      ignoreNearBlack,
      nearWhiteThr: Math.min(254, nearWhiteThr + 8),
      nearBlackThr: Math.max(1, nearBlackThr - 8),
      fallbackStage: "relaxed-thresholds"
    },
    {
      ignoreTransparent,
      ignoreNearWhite,
      ignoreNearBlack: false,
      nearWhiteThr,
      nearBlackThr,
      fallbackStage: "allow-near-black"
    },
    {
      ignoreTransparent,
      ignoreNearWhite: false,
      ignoreNearBlack,
      nearWhiteThr,
      nearBlackThr,
      fallbackStage: "allow-near-white"
    },
    {
      ignoreTransparent,
      ignoreNearWhite: false,
      ignoreNearBlack: false,
      nearWhiteThr,
      nearBlackThr,
      fallbackStage: "allow-white-black"
    }
  ];

  let points = [];
  let appliedFallbackStage = "strict";

  for (const attempt of attempts) {
    points = collectPointsFromImage(data, info, {
      step,
      alphaMin,
      nearWhiteThr: attempt.nearWhiteThr,
      nearBlackThr: attempt.nearBlackThr,
      ignoreTransparent: attempt.ignoreTransparent,
      ignoreNearWhite: attempt.ignoreNearWhite,
      ignoreNearBlack: attempt.ignoreNearBlack
    });

    if (points.length > 0) {
      appliedFallbackStage = attempt.fallbackStage;
      break;
    }
  }

  if (points.length === 0) {
    return {
      ok: false,
      reason: "No valid pixels found in the logo image."
    };
  }

  const clusters = kmeans(points, k, 25);
  if (!clusters || clusters.length === 0) {
    return { ok: false, reason: "Clustering failed." };
  }

  const dominant = clusters[0];
  const dominantHex = rgbToHex(dominant.rgb[0], dominant.rgb[1], dominant.rgb[2]);

  if (!returnPalette) {
    return { ok: true, dominantHex, fallbackStage: appliedFallbackStage };
  }

  const total = clusters.reduce((s, c) => s + c.count, 0);
  const palette = clusters.map((c) => ({
    hex: rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]),
    ratio: c.count / total,
  }));

  return { ok: true, dominantHex, palette, fallbackStage: appliedFallbackStage };
}

module.exports = { extractDominantColor };
