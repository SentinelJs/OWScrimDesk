#!/usr/bin/env node
/**
 * 스크린샷 자동 캡처 스크립트
 *
 * 사전 준비:
 *   npm install --save-dev puppeteer
 *
 * 사용법 (서버를 먼저 실행한 뒤):
 *   node docs/capture-screenshots.js
 *   node docs/capture-screenshots.js --port 3001
 *
 * 결과물은 docs/example_image/ 에 저장됩니다.
 */

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// ─── 설정 ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const portArg = args.find((a) => a.startsWith("--port=") || a === "--port");
const PORT =
  portArg
    ? portArg.startsWith("--port=")
      ? Number(portArg.split("=")[1])
      : Number(args[args.indexOf("--port") + 1])
    : 3000;

const BASE = `http://localhost:${PORT}`;
const OUT_DIR = path.join(__dirname, "example_image");

const VIEWPORT = { width: 1920, height: 1080 };

/** 캡처할 대상 목록 */
const CAPTURES = [
  // ── 독립 페이지 ──────────────────────────────────────────────────────────
  { filename: "main.png",           url: "/" },
  { filename: "mappick.png",        url: "/map-pick" },
  { filename: "heroban.png",        url: "/hero-ban" },
  { filename: "ingameoverlay.png",  url: "/in-game-overlay" },
  { filename: "gamehistory.png",    url: "/game-history" },
  { filename: "match_start.png",    url: "/match-start" },
  { filename: "intermission.png",   url: "/intermission" },
  { filename: "waiting_room.png",   url: "/waiting-room" },
  { filename: "preview.png",        url: "/preview.html" },

  // ── 관리자 탭 ────────────────────────────────────────────────────────────
  {
    filename: "admin_team.png",
    url: "/admin.html",
    click: '[data-tab="team"]',
  },
  {
    filename: "admin_ingame.png",
    url: "/admin.html",
    click: '[data-tab="ingame"]',
  },
  {
    filename: "admin_history.png",
    url: "/admin.html",
    click: '[data-tab="history"]',
  },
  {
    filename: "admin_matchinfo.png",
    url: "/admin.html",
    click: '[data-tab="match"]',
  },
  {
    filename: "admin_etc.png",
    url: "/admin.html",
    click: '[data-tab="etc"]',
  },
];

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n📷  스크린샷 캡처 시작 (${BASE})\n`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let success = 0;
  let fail = 0;

  for (const capture of CAPTURES) {
    const outPath = path.join(OUT_DIR, capture.filename);

    try {
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);

      // 네트워크가 완전히 안정될 때까지 대기
      await page.goto(`${BASE}${capture.url}`, {
        waitUntil: "networkidle2",
        timeout: 15_000,
      });

      // 탭 클릭이 필요한 경우
      if (capture.click) {
        await page.waitForSelector(capture.click, { timeout: 7_000 });
        await page.click(capture.click);
        await sleep(400); // 탭 전환 애니메이션 대기
      }

      // 폰트·이미지 렌더링 안정화
      await sleep(1000);

      await page.screenshot({ path: outPath, type: "png" });
      await page.close();

      console.log(`  ✅  ${capture.filename}`);
      success++;
    } catch (err) {
      console.error(`  ❌  ${capture.filename}  →  ${err.message}`);
      fail++;
    }
  }

  await browser.close();

  console.log(`\n완료: 성공 ${success} / 실패 ${fail}`);
  console.log(`저장 위치: ${OUT_DIR}\n`);

  process.exit(fail > 0 ? 1 : 0);
})();
