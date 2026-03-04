function createEmptyPlayer() {
  return {
    name: "",
    position: "",
    mainHero: "",
    tier: ""
  };
}

function createContentId() {
  return `content-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toSafeDurationSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 30;
  return Math.max(1, Math.min(36000, Math.floor(numeric)));
}

function splitDuration(durationSeconds) {
  const safe = toSafeDurationSeconds(durationSeconds);
  return {
    minutes: Math.floor(safe / 60),
    seconds: safe % 60
  };
}

function parseDurationFromInputs(minutesValue, secondsValue) {
  const minutes = Number.isFinite(Number(minutesValue)) ? Math.max(0, Math.floor(Number(minutesValue))) : 0;
  const seconds = Number.isFinite(Number(secondsValue)) ? Math.max(0, Math.floor(Number(secondsValue))) : 0;
  return toSafeDurationSeconds(minutes * 60 + seconds);
}

function normalizeContentItem(item, index) {
  return {
    id: typeof item?.id === "string" && item.id.trim() ? item.id.trim() : `content-${index + 1}`,
    title: typeof item?.title === "string" ? item.title : `콘텐츠 ${index + 1}`,
    type: item?.type === "image" ? "image" : "youtube",
    url: typeof item?.url === "string" ? item.url : "",
    durationSeconds: toSafeDurationSeconds(item?.durationSeconds),
    enabled: item?.enabled !== false,
    order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index
  };
}

function createDefaultContent(index = 0) {
  return {
    id: createContentId(),
    title: `콘텐츠 ${index + 1}`,
    type: "youtube",
    url: "",
    durationSeconds: 30,
    enabled: true,
    order: index
  };
}

function normalizeContents(rawContents, legacyType, legacyUrl, legacyDurationSeconds) {
  const source = Array.isArray(rawContents) ? rawContents : [];
  let list = source.map((item, index) => normalizeContentItem({
    ...item,
    durationSeconds: item?.durationSeconds ?? legacyDurationSeconds
  }, index));

  if (list.length === 0 && typeof legacyUrl === "string" && legacyUrl.trim()) {
    list = [{
      id: createContentId(),
      title: "기본 콘텐츠",
      type: legacyType === "image" ? "image" : "youtube",
      url: legacyUrl,
      durationSeconds: toSafeDurationSeconds(legacyDurationSeconds),
      enabled: true,
      order: 0
    }];
  }

  return list
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
}

function ensureTeamPlayers(players) {
  const list = Array.isArray(players) ? players.slice(0, 5) : [];
  while (list.length < 5) list.push(createEmptyPlayer());
  return list.map((player) => ({
    name: typeof player?.name === "string" ? player.name : "",
    position: typeof player?.position === "string" ? player.position : "",
    mainHero: typeof player?.mainHero === "string" ? player.mainHero : "",
    tier: typeof player?.tier === "string" ? player.tier : ""
  }));
}

function ensureEtcSettings(settings) {
  const source = settings?.etc || {};
  const contents = normalizeContents(
    source.breakContents,
    source.breakContentType,
    source.breakContentUrl,
    source.breakDurationSeconds
  );
  const selectedBreakContentId = typeof source.selectedBreakContentId === "string" ? source.selectedBreakContentId : "";
  return {
    sponsor: typeof source.sponsor === "string" ? source.sponsor : "",
    breakContentType: source.breakContentType === "image" ? "image" : "youtube",
    breakContentUrl: typeof source.breakContentUrl === "string" ? source.breakContentUrl : "",
    breakContents: contents,
    selectedBreakContentId: contents.some((item) => item.id === selectedBreakContentId)
      ? selectedBreakContentId
      : (contents[0]?.id || ""),
    revision: Number.isFinite(Number(source.revision)) ? Math.max(0, Math.floor(Number(source.revision))) : 0,
    rotationSeed: Number.isFinite(Number(source.rotationSeed ?? source.autoRotateSeed))
      ? Math.max(0, Math.floor(Number(source.rotationSeed ?? source.autoRotateSeed)))
      : 0,
    breakMinutes: Number.isFinite(Number(source.breakMinutes)) ? Math.max(0, Math.min(180, Number(source.breakMinutes))) : 10,
    breakSeconds: Number.isFinite(Number(source.breakSeconds)) ? Math.max(0, Math.min(59, Number(source.breakSeconds))) : 0,
    players: {
      team1: ensureTeamPlayers(source.players?.team1),
      team2: ensureTeamPlayers(source.players?.team2)
    }
  };
}

function renderContentsTable(contents, selectedId) {
  if (!contents.length) {
    return '<tr><td colspan="8" class="muted">콘텐츠가 없습니다. "콘텐츠 추가"를 눌러 등록하세요.</td></tr>';
  }

  return contents.map((item, index) => {
    const checked = item.id === selectedId ? "checked" : "";
    const enabled = item.enabled ? "checked" : "";
    const duration = splitDuration(item.durationSeconds);
    return `
      <tr data-content-id="${escapeHtml(item.id)}">
        <td>${index + 1}</td>
        <td><input type="text" data-field="title" value="${escapeHtml(item.title)}" placeholder="콘텐츠 이름" autocomplete="off" /></td>
        <td>
          <select data-field="type">
            <option value="youtube" ${item.type === "youtube" ? "selected" : ""}>YouTube</option>
            <option value="image" ${item.type === "image" ? "selected" : ""}>Image</option>
          </select>
        </td>
        <td><input type="text" data-field="url" value="${escapeHtml(item.url)}" placeholder="https://..." autocomplete="off" /></td>
        <td>
          <div style="display:flex;align-items:center;gap:6px;justify-content:center;">
            <input type="number" data-field="durationMinutes" min="0" max="600" step="1" value="${duration.minutes}" style="width:72px" />
            <span>분</span>
            <input type="number" data-field="durationSeconds" min="0" max="59" step="1" value="${duration.seconds}" style="width:72px" />
            <span>초</span>
          </div>
        </td>
        <td style="text-align:center"><input type="checkbox" data-field="enabled" ${enabled} /></td>
        <td style="text-align:center"><input type="radio" name="etc-current-content" data-field="selected" ${checked} /></td>
        <td style="text-align:center"><button type="button" class="danger icon-delete" data-action="delete-content">×</button></td>
      </tr>
    `;
  }).join("");
}

function getValidContentIndexes(contents) {
  return contents
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.enabled && String(item.url || "").trim())
    .map(({ index }) => index);
}

function renderPlayerTable(teamKey, players) {
  const rows = players
    .map((player, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><input data-team="${teamKey}" data-index="${index}" data-field="name" type="text" value="${player.name}" autocomplete="off" placeholder="선수 이름" /></td>
        <td><input data-team="${teamKey}" data-index="${index}" data-field="position" type="text" value="${player.position}" autocomplete="off" placeholder="포지션" /></td>
        <td><input data-team="${teamKey}" data-index="${index}" data-field="mainHero" type="text" value="${player.mainHero}" autocomplete="off" placeholder="주챔" /></td>
        <td><input data-team="${teamKey}" data-index="${index}" data-field="tier" type="text" value="${player.tier}" autocomplete="off" placeholder="티어" /></td>
      </tr>
    `)
    .join("");

  const label = teamKey === "team1" ? "Team 1" : "Team 2";
  return `
    <div class="etc-player-team">
      <h4>${label}</h4>
      <table class="etc-player-table">
        <thead>
          <tr>
            <th>#</th>
            <th>이름</th>
            <th>포지션</th>
            <th>주챔</th>
            <th>티어</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function extractYouTubeVideoId(url) {
  if (typeof url !== "string" || !url.trim()) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "").toLowerCase();

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (host.endsWith("youtube.com")) {
      const direct = parsed.searchParams.get("v");
      if (direct) return direct;

      const segments = parsed.pathname.split("/").filter(Boolean);
      const index = segments.findIndex((value) => value === "embed" || value === "shorts" || value === "live");
      if (index >= 0 && segments[index + 1]) {
        return segments[index + 1];
      }
    }
  } catch {}
  return "";
}

async function fetchYouTubeDurationSeconds(url) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  try {
    const response = await fetch(`/api/youtube/duration?videoId=${encodeURIComponent(videoId)}`, {
      method: "GET",
      cache: "no-store"
    });
    if (!response.ok) return null;
    const data = await response.json();
    const duration = Number(data?.durationSeconds);
    return Number.isFinite(duration) && duration > 0 ? Math.max(1, Math.floor(duration)) : null;
  } catch {
    return null;
  }
}

function buildContentSignature(contents) {
  return contents
    .map((item) => [
      item.id,
      item.type,
      item.url,
      item.enabled ? "1" : "0",
      toSafeDurationSeconds(item.durationSeconds)
    ].join(":"))
    .join("|");
}

export function createEtcModule(ctx) {
  const { state, fetchJSON, wsPublish, showToast, showError } = ctx;
  let realtimeSyncTimer = 0;
  let saveQueue = Promise.resolve();
  let revisionCounter = Number(state.settings?.etc?.revision) || Date.now();
  const youtubeDurationCache = new Map();
  const youtubeTaskTokenByContentId = new Map();
  let lastPromptedYoutubeSignature = "";

  function nextRevision() {
    revisionCounter = Math.max(revisionCounter + 1, Date.now());
    return revisionCounter;
  }

  async function persistAndPublish(withToast = false) {
    await fetchJSON("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { etc: state.settings.etc } })
    });

    wsPublish({
      context: "settings",
      settings: state.settings,
      teams: state.teams,
      state: state.current,
      history: state.history
    });

    if (withToast) showToast("ETC 설정이 저장되었습니다.");
  }

  function enqueuePersist(withToast = false) {
    saveQueue = saveQueue
      .then(async () => {
        snapshotDomToState();
        await persistAndPublish(withToast);
      })
      .catch((error) => {
        console.error("[ETC] queued save failed", error);
        if (typeof showError === "function") {
          showError(`ETC 저장 실패: ${error?.message || "알 수 없는 오류"}`);
        }
      });

    return saveQueue;
  }

  function queueRealtimeSync(immediate = false) {
    if (realtimeSyncTimer) {
      clearTimeout(realtimeSyncTimer);
      realtimeSyncTimer = 0;
    }

    const run = async () => {
      try {
        await enqueuePersist(false);
      } catch (error) {
        console.error("[ETC] realtime sync failed", error);
        if (typeof showError === "function") {
          showError(`ETC 저장 실패: ${error?.message || "알 수 없는 오류"}`);
        }
      }
    };

    if (immediate) {
      void run();
      return;
    }

    realtimeSyncTimer = setTimeout(() => {
      realtimeSyncTimer = 0;
      void run();
    }, 300);
  }

  function getEtc() {
    const ensured = ensureEtcSettings(state.settings);
    if (Number.isFinite(Number(ensured.revision))) {
      revisionCounter = Math.max(revisionCounter, Number(ensured.revision));
    }
    state.settings.etc = ensured;
    return ensured;
  }

  function render() {
    const etc = getEtc();
    const sponsorInput = document.getElementById("etc-sponsor");
    const minutesInput = document.getElementById("etc-break-minutes");
    const secondsInput = document.getElementById("etc-break-seconds");
    const shell = document.getElementById("etc-player-shell");
    const contentBody = document.querySelector("#etcContentTable tbody");

    if (!sponsorInput || !minutesInput || !secondsInput || !shell || !contentBody) return;

    sponsorInput.value = etc.sponsor;
    minutesInput.value = String(etc.breakMinutes);
    secondsInput.value = String(etc.breakSeconds);
    contentBody.innerHTML = renderContentsTable(etc.breakContents, etc.selectedBreakContentId);

    shell.innerHTML = `${renderPlayerTable("team1", etc.players.team1)}${renderPlayerTable("team2", etc.players.team2)}`;
  }

  function setRowDurationSeconds(row, durationSeconds) {
    const duration = splitDuration(durationSeconds);
    const minuteInput = row.querySelector('[data-field="durationMinutes"]');
    const secondInput = row.querySelector('[data-field="durationSeconds"]');
    if (minuteInput instanceof HTMLInputElement) minuteInput.value = String(duration.minutes);
    if (secondInput instanceof HTMLInputElement) secondInput.value = String(duration.seconds);
  }

  function getYoutubePromptRows() {
    const rows = Array.from(document.querySelectorAll("#etcContentTable tbody tr[data-content-id]"));
    return rows
      .map((row) => {
        const typeSelect = row.querySelector('[data-field="type"]');
        const urlInput = row.querySelector('[data-field="url"]');
        if (!(typeSelect instanceof HTMLSelectElement) || !(urlInput instanceof HTMLInputElement)) {
          return null;
        }
        const url = String(urlInput.value || "").trim();
        return {
          row,
          contentId: row.dataset.contentId || "",
          type: typeSelect.value,
          url,
          videoId: extractYouTubeVideoId(url)
        };
      })
      .filter((item) => !!item && item.type === "youtube");
  }

  function showDurationInsertPrompt(onConfirm, onCancel) {
    if (window.confirm("YouTube 링크가 모두 입력되었습니다. 시간 삽입을 하시겠습니까?")) {
      onConfirm();
    } else {
      onCancel?.();
    }
  }

  async function applyYoutubeDurationFromRow(row, options = {}) {
    const { queueSync = true } = options;
    if (!(row instanceof HTMLTableRowElement)) return;
    const contentId = row.dataset.contentId;
    if (!contentId) return false;

    const typeSelect = row.querySelector('[data-field="type"]');
    const urlInput = row.querySelector('[data-field="url"]');
    if (!(typeSelect instanceof HTMLSelectElement) || !(urlInput instanceof HTMLInputElement)) return false;
    if (typeSelect.value !== "youtube") return false;

    const url = String(urlInput.value || "").trim();
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return false;

    const nextToken = (youtubeTaskTokenByContentId.get(contentId) || 0) + 1;
    youtubeTaskTokenByContentId.set(contentId, nextToken);

    let durationSeconds = youtubeDurationCache.get(videoId);
    if (!Number.isFinite(durationSeconds)) {
      durationSeconds = await fetchYouTubeDurationSeconds(url);
      if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        youtubeDurationCache.set(videoId, durationSeconds);
      }
    }

    const currentToken = youtubeTaskTokenByContentId.get(contentId);
    if (currentToken !== nextToken) return false;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
    if (row.dataset.contentId !== contentId) return false;

    setRowDurationSeconds(row, durationSeconds);
    if (queueSync) queueRealtimeSync(true);
    return true;
  }

  async function applyYoutubeDurationForAllRows() {
    const youtubeRows = getYoutubePromptRows().filter((item) => item.videoId);
    if (!youtubeRows.length) return;

    let appliedCount = 0;
    for (const { row } of youtubeRows) {
      const applied = await applyYoutubeDurationFromRow(row, { queueSync: false });
      if (applied) appliedCount += 1;
    }

    if (appliedCount > 0) {
      queueRealtimeSync(true);
      showToast(`YouTube ${appliedCount}개 길이를 지속시간에 반영했습니다.`);
    } else {
      showToast("YouTube 길이를 가져오지 못했습니다.");
    }
  }

  function maybePromptYoutubeDurationInsert() {
    const youtubeRows = getYoutubePromptRows();
    if (!youtubeRows.length) return;

    const allFilled = youtubeRows.every((item) => !!item.videoId);
    if (!allFilled) return;

    const signature = youtubeRows
      .map((item) => `${item.contentId}:${item.videoId}`)
      .join("|");
    if (!signature || signature === lastPromptedYoutubeSignature) return;

    lastPromptedYoutubeSignature = signature;
    showDurationInsertPrompt(
      async () => {
        await applyYoutubeDurationForAllRows();
      },
      () => {
        showToast("시간 자동 삽입을 취소했습니다.");
      }
    );
  }

  function collectContentsFromDom(etc) {
    const prevSelectedId = etc.selectedBreakContentId;
    const previousSignature = buildContentSignature(etc.breakContents || []);
    const rows = Array.from(document.querySelectorAll("#etcContentTable tbody tr[data-content-id]"));
    const list = rows.map((row, index) => {
      const id = row.dataset.contentId || createContentId();
      const titleInput = row.querySelector('[data-field="title"]');
      const typeSelect = row.querySelector('[data-field="type"]');
      const urlInput = row.querySelector('[data-field="url"]');
      const enabledInput = row.querySelector('[data-field="enabled"]');
      const selectedInput = row.querySelector('[data-field="selected"]');
      const durationMinutesInput = row.querySelector('[data-field="durationMinutes"]');
      const durationSecondsInput = row.querySelector('[data-field="durationSeconds"]');

      const durationSeconds = parseDurationFromInputs(
        durationMinutesInput instanceof HTMLInputElement ? durationMinutesInput.value : 0,
        durationSecondsInput instanceof HTMLInputElement ? durationSecondsInput.value : 0
      );

      return {
        id,
        title: titleInput?.value || `콘텐츠 ${index + 1}`,
        type: typeSelect?.value === "image" ? "image" : "youtube",
        url: urlInput?.value || "",
        durationSeconds,
        enabled: !!enabledInput?.checked,
        order: index,
        selected: !!selectedInput?.checked
      };
    });

    const selected = list.find((item) => item.selected);
    const normalized = list.map(({ selected: _, ...item }, index) => ({ ...item, order: index }));

    etc.breakContents = normalized;
    etc.selectedBreakContentId = selected?.id || normalized[0]?.id || "";
    const nextSignature = buildContentSignature(normalized);
    if (prevSelectedId !== etc.selectedBreakContentId || previousSignature !== nextSignature) {
      etc.rotationSeed = Date.now();
    }
    return etc;
  }

  function collectBasicFields(etc) {
    etc.sponsor = document.getElementById("etc-sponsor")?.value || "";

    const minuteValue = Number(document.getElementById("etc-break-minutes")?.value ?? etc.breakMinutes);
    const secondValue = Number(document.getElementById("etc-break-seconds")?.value ?? etc.breakSeconds);

    etc.breakMinutes = Number.isFinite(minuteValue) ? Math.max(0, Math.min(180, minuteValue)) : 10;
    etc.breakSeconds = Number.isFinite(secondValue) ? Math.max(0, Math.min(59, secondValue)) : 0;

    if (!Number.isFinite(Number(etc.rotationSeed)) || Number(etc.rotationSeed) <= 0) {
      etc.rotationSeed = Date.now();
    }

    const selected = etc.breakContents.find((item) => item.id === etc.selectedBreakContentId);
    etc.breakContentType = selected?.type || "youtube";
    etc.breakContentUrl = selected?.url || "";
    etc.revision = nextRevision();
  }

  function snapshotDomToState() {
    const etc = getEtc();
    collectPlayersFromDom(etc);
    collectContentsFromDom(etc);
    collectBasicFields(etc);
    state.settings.etc = ensureEtcSettings({ etc });
    return state.settings.etc;
  }

  function addContentRow() {
    const etc = snapshotDomToState();
    const next = createDefaultContent(etc.breakContents.length);
    etc.breakContents.push(next);
    etc.selectedBreakContentId = next.id;
    etc.rotationSeed = Date.now();
    lastPromptedYoutubeSignature = "";
    state.settings.etc = ensureEtcSettings({ etc });
    render();
    queueRealtimeSync(true);
  }

  function deleteContent(contentId) {
    const etc = snapshotDomToState();
    const prevSelectedId = etc.selectedBreakContentId;
    etc.breakContents = etc.breakContents.filter((item) => item.id !== contentId);
    if (!etc.breakContents.some((item) => item.id === etc.selectedBreakContentId)) {
      etc.selectedBreakContentId = etc.breakContents[0]?.id || "";
    }
    if (prevSelectedId !== etc.selectedBreakContentId) {
      etc.rotationSeed = Date.now();
    }
    lastPromptedYoutubeSignature = "";
    state.settings.etc = ensureEtcSettings({ etc });
    render();
    queueRealtimeSync(true);
  }

  function selectAdjacentContent(direction) {
    const etc = snapshotDomToState();
    const validIndexes = getValidContentIndexes(etc.breakContents);
    if (validIndexes.length === 0) {
      showToast("활성 콘텐츠(URL 포함)를 먼저 등록하세요.");
      return;
    }

    const currentIndex = etc.breakContents.findIndex((item) => item.id === etc.selectedBreakContentId);
    const currentValidPos = validIndexes.indexOf(currentIndex);
    const from = currentValidPos >= 0 ? currentValidPos : 0;
    const nextPos = (from + direction + validIndexes.length) % validIndexes.length;
    const nextIndex = validIndexes[nextPos];
    etc.selectedBreakContentId = etc.breakContents[nextIndex].id;
    etc.rotationSeed = Date.now();

    state.settings.etc = ensureEtcSettings({ etc });
    render();
    queueRealtimeSync(true);
  }

  function collectPlayersFromDom(etc) {
    const allInputs = document.querySelectorAll("#etc-player-shell input[data-team]");
    allInputs.forEach((input) => {
      const team = input.dataset.team;
      const index = Number(input.dataset.index);
      const field = input.dataset.field;
      if (!etc.players?.[team]?.[index]) return;
      etc.players[team][index][field] = input.value || "";
    });
  }

  async function save() {
    try {
      if (realtimeSyncTimer) {
        clearTimeout(realtimeSyncTimer);
        realtimeSyncTimer = 0;
      }
      await enqueuePersist(true);
    } catch (error) {
      console.error("[ETC] save failed", error);
      if (typeof showError === "function") {
        showError(`ETC 저장 실패: ${error?.message || "알 수 없는 오류"}`);
      }
    }
  }

  function bind() {
    const saveButton = document.getElementById("saveEtc");
    const addContentButton = document.getElementById("etcContentAdd");
    const prevContentButton = document.getElementById("etcContentPrev");
    const nextContentButton = document.getElementById("etcContentNext");
    const contentTableBody = document.querySelector("#etcContentTable tbody");

    if (saveButton) saveButton.addEventListener("click", save);
    if (addContentButton) addContentButton.addEventListener("click", addContentRow);
    if (prevContentButton) prevContentButton.addEventListener("click", () => selectAdjacentContent(-1));
    if (nextContentButton) nextContentButton.addEventListener("click", () => selectAdjacentContent(1));

    if (contentTableBody) {
      contentTableBody.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.action === "delete-content") {
          const row = target.closest("tr[data-content-id]");
          if (!row?.dataset.contentId) return;
          deleteContent(row.dataset.contentId);
        }
      });

      contentTableBody.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!(target instanceof HTMLInputElement)) return;
        const field = target.dataset.field;
        if (field === "title" || field === "url" || field === "durationMinutes" || field === "durationSeconds") {
          queueRealtimeSync(false);
        }
      });

      contentTableBody.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const field = target.dataset.field;
        if (field === "type" || field === "enabled" || field === "selected" || field === "durationMinutes" || field === "durationSeconds") {
          queueRealtimeSync(true);
        }
      });

      contentTableBody.addEventListener("focusout", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.dataset.field !== "url") return;
        maybePromptYoutubeDurationInsert();
      });
    }
  }

  return { render, bind, save };
}
