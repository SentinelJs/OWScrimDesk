export function createInGameModule(ctx) {
  const { state, wsPublish, showToast, fetchJSON } = ctx;

  const findByName = (collection, name) => collection.find((item) => item.name === name) || null;
  const mapByName = (name) => findByName(state.assets.maps, name);
  const heroByName = (name) => findByName(state.assets.heroes, name);

  function getMapInputValue() {
    return document.getElementById("map-input")?.value?.trim() || "";
  }

  function getSelectedMapFromInput() {
    return mapByName(getMapInputValue());
  }

  function isSelectedMapApplied() {
    const selectedMap = getSelectedMapFromInput();
    if (!selectedMap) return false;
    return state.current.currentMapId === selectedMap.id;
  }

  function computeAvailableModes(settings, history) {
    const mapPoolByMode = settings.mapPool || {};
    const validModes = ["control", "hybrid", "flashpoint", "push", "escort"];
    const availableModes = validModes.filter((item) => (mapPoolByMode[item] || []).length > 0);
    if (availableModes.length === 0) return { availableModes, cycleSet: new Set() };

    const cycleSet = new Set();
    history.forEach((game) => {
      if (!availableModes.includes(game.mapMode)) return;
      cycleSet.add(game.mapMode);
      if (cycleSet.size === availableModes.length) {
        cycleSet.clear();
      }
    });
    return { availableModes, cycleSet };
  }

  function isMapSelectable(map) {
    if (!state.settings.enableMapPick) return true;
    if (!map || !map.mode) return false;
    const mapPoolByMode = state.settings.mapPool || {};
    const pool = mapPoolByMode[map.mode] || [];
    if (!pool.includes(map.id)) return false;

    const usedInMode = state.history
      .filter((game) => game.mapMode === map.mode)
      .map((game) => game.mapId)
      .filter(Boolean);

    const isExhausted = pool.length > 0 && pool.every((id) => usedInMode.includes(id));
    if (!isExhausted && usedInMode.includes(map.id)) return false;

    const { availableModes, cycleSet } = computeAvailableModes(state.settings, state.history);
    if (availableModes.length > 0 && cycleSet.has(map.mode)) return false;

    return true;
  }

  function getSelectableMaps() {
    return state.assets.maps.filter((map) => isMapSelectable(map));
  }

  const getHeroById = (heroId) => heroId ? state.assets.heroes.find((hero) => hero.id === heroId) || null : null;
  const getHeroByInputValue = (inputId) => heroByName(document.getElementById(inputId)?.value?.trim() || "");
  const getHeroFromCurrentState = (teamId) => getHeroById(state.current?.bans?.[teamId]);

  function getSnapshot() {
    return {
      mapInput: getMapInputValue(),
      side: getSelectedSide(),
      banTeam1: document.getElementById("ban-team1")?.value?.trim() || "",
      banTeam2: document.getElementById("ban-team2")?.value?.trim() || ""
    };
  }

  function isHeroSelectable(teamId, hero) {
    if (!state.settings.enableHeroBan || !hero) return !state.settings.enableHeroBan;

    const usedBans = state.history.map((game) => game.bans?.[teamId]).filter(Boolean);
    if (usedBans.includes(hero.id)) return false;

    const otherTeamId = teamId === "team1" ? "team2" : "team1";
    const otherHero = getHeroByInputValue(otherTeamId === "team1" ? "ban-team1" : "ban-team2");
    
    return !otherHero || (otherHero.id !== hero.id && otherHero.role !== hero.role);
  }

  function getSelectableHeroes(teamId) {
    return state.assets.heroes.filter((hero) => isHeroSelectable(teamId, hero));
  }

  function updateSideArea(mode) {
    const sideArea = document.getElementById("sideArea");
    const isSideMode = mode === "hybrid" || mode === "escort";
    sideArea.style.display = isSideMode ? "block" : "none";
  }

  function setSideSelection(value) {
    const radios = document.querySelectorAll("input[name='side']");
    radios.forEach((radio) => {
      radio.checked = radio.value === value;
    });
  }

  function getSelectedSide() {
    const selected = document.querySelector("input[name='side']:checked");
    return selected ? selected.value : "";
  }

  function ensureOverlaySwapState() {
    if (typeof state.current.overlayTeamSwap !== "boolean") {
      state.current.overlayTeamSwap = false;
    }
    if (typeof state.current.overlayRoleSwap !== "boolean") {
      state.current.overlayRoleSwap = false;
    }
  }

  function computeAttackTeamFromCurrentSelection() {
    if (!state.current.sidePickOwner || !state.current.side) return "";
    if (state.current.side === "attack") return state.current.sidePickOwner;
    if (state.current.side === "defense") {
      return state.current.sidePickOwner === "team1" ? "team2" : "team1";
    }
    return "";
  }

  function computeStandardOverlayView() {
    const attackTeam = computeAttackTeamFromCurrentSelection() || (state.current.side ? state.current.attackTeam : "");
    const hasAttack = ["team1", "team2"].includes(attackTeam);
    const leftTeamId = hasAttack && attackTeam === "team1" ? "team2" : "team1";
    const rightTeamId = hasAttack ? attackTeam : "team2";
    
    return {
      hasAttack,
      attackTeam,
      leftTeamId,
      rightTeamId,
      leftRole: hasAttack ? "defense" : "",
      rightRole: hasAttack ? "attack" : ""
    };
  }

  function computeCurrentOverlayView() {
    ensureOverlaySwapState();
    const standard = computeStandardOverlayView();
    const teamSwapped = state.current.overlayTeamSwap;
    const roleSwapped = state.current.overlayRoleSwap;
    
    return {
      ...standard,
      leftTeamId: teamSwapped ? standard.rightTeamId : standard.leftTeamId,
      rightTeamId: teamSwapped ? standard.leftTeamId : standard.rightTeamId,
      leftRole: roleSwapped ? standard.rightRole : standard.leftRole,
      rightRole: roleSwapped ? standard.leftRole : standard.rightRole
    };
  }

  function teamName(teamId) {
    return teamId === "team2" ? state.teams.team2.name : state.teams.team1.name;
  }

  function formatOverlaySummary(view) {
    if (!view.hasAttack) {
      return "왼쪽 - / 오른쪽 - (공/수 선택 시 자동 표시)";
    }
    const leftRoleLabel = view.leftRole === "attack" ? "공격" : "수비";
    const rightRoleLabel = view.rightRole === "attack" ? "공격" : "수비";
    return `왼쪽 ${leftRoleLabel} ${teamName(view.leftTeamId)} · 오른쪽 ${rightRoleLabel} ${teamName(view.rightTeamId)}`;
  }

  function renderSwapManager() {
    ensureOverlaySwapState();
    const standardSummary = document.getElementById("swap-standard-summary");
    const currentSummary = document.getElementById("swap-current-summary");
    const teamSwapBtn = document.getElementById("swap-team-btn");
    const roleSwapBtn = document.getElementById("swap-role-btn");
    const sideArea = document.getElementById("sideArea");
    if (!standardSummary || !currentSummary || !teamSwapBtn || !roleSwapBtn || !sideArea) return;
    const isVisible = sideArea.style.display !== "none";
    if (!isVisible) return;

    const standard = computeStandardOverlayView();
    const current = computeCurrentOverlayView();

    standardSummary.textContent = formatOverlaySummary(standard);
    currentSummary.textContent = formatOverlaySummary(current);
    teamSwapBtn.classList.toggle("active", !!state.current.overlayTeamSwap);
    roleSwapBtn.classList.toggle("active", !!state.current.overlayRoleSwap);
    teamSwapBtn.textContent = state.current.overlayTeamSwap
      ? "좌우 팀 교체 (ON)"
      : "좌우 팀 교체";
    roleSwapBtn.textContent = state.current.overlayRoleSwap
      ? "좌우 공수 아이콘 교체 (ON)"
      : "좌우 공수 아이콘 교체";
  }

  function applyStandardSwapState() {
    ensureOverlaySwapState();
    state.current.overlayTeamSwap = false;
    state.current.overlayRoleSwap = false;
  }

  function getSelectedBanOrder() {
    const selected = document.querySelector("input[name='ban-order']:checked");
    return selected ? selected.value : "";
  }

  function renderBanPriority() {
    const info = document.getElementById("banPriorityInfo");
    const controls = document.getElementById("banPriorityControls");
    const caption = document.getElementById("ban-order-caption");
    if (!state.settings.enableHeroBan) {
      if (info) info.style.display = "none";
      if (controls) controls.style.display = "none";
      return;
    }

    const owner = state.current.banChoiceOwner || state.current.banChoiceOwnerAuto;
    const ownerName = owner === "team2" ? state.teams.team2.name : state.teams.team1.name;
    const reason = state.current.banChoiceOwnerReason === "PREV_LOSER"
      ? "전 경기 패배팀"
      : state.current.banChoiceOwnerReason === "LAST_LOSER_AFTER_DRAW"
        ? "직전 무승부로 마지막 패배팀 유지"
        : state.current.banChoiceOwnerReason === "FALLBACK"
          ? "기록 누락으로 기본값 적용"
          : "맵1: 시리즈 시작 선택권 팀";
    if (info) {
      info.textContent = `영웅밴 선택권 팀: ${ownerName} (${reason})`;
      info.style.display = "block";
    }

    if (controls) {
      controls.style.display = "grid";
    }
    if (caption) {
      caption.textContent = `선밴/후밴 선택(권한: ${ownerName})`;
    }

    const autoToggle = document.getElementById("ban-auto");
    const manualSelect = document.getElementById("ban-choice-owner");
    if (autoToggle) {
      autoToggle.checked = !state.current.banChoiceOwnerManual;
    }
    if (manualSelect) {
      manualSelect.disabled = !state.current.banChoiceOwnerManual;
      manualSelect.value = state.current.banChoiceOwnerManual || owner || "team1";
    }

    const order = state.current.banOrder || state.current.banOrderAuto || "A_FIRST";
    document.querySelectorAll("input[name='ban-order']").forEach((radio) => {
      radio.checked = radio.value === order;
    });
  }

  function renderSidePickOwner() {
    const bar = document.getElementById("sideOwnerBar");
    if (!bar) return;
    const owner = state.current.sidePickOwner;
    const reason = state.current.sidePickReason;
    const ownerName = owner === "team2" ? state.teams.team2.name : state.teams.team1.name;
    const reasonText = reason === "PREV_LOSER"
      ? "전 경기 패배팀"
      : reason === "LAST_LOSER_AFTER_DRAW"
        ? "직전 무승부로 마지막 패배팀 유지"
      : reason === "FALLBACK"
        ? "기록 누락으로 기본값 적용"
        : "맵1: 시리즈 시작 선택권 팀";
    bar.textContent = `공/수 선택팀: ${ownerName} (${reasonText})`;
    bar.style.display = "block";
  }

  function updateBanControlState() {
    const autoToggle = document.getElementById("ban-auto");
    const manualSelect = document.getElementById("ban-choice-owner");
    const manualEnabled = autoToggle ? !autoToggle.checked : false;
    state.current.banChoiceOwnerManual = manualEnabled ? manualSelect.value : "";
    state.current.banOrderManual = getSelectedBanOrder();
  }

  async function publishInGameState(message, extraPayload = {}, toastType = "success") {
    const result = await wsPublish({
      context: "ingame",
      gameIndex: state.current.currentMatchIndex,
      settings: state.settings,
      teams: state.teams,
      state: state.current,
      history: state.history,
      ...extraPayload
    });
    if (!result?.ok) return;
    ctx.refreshStateFromServer().then(() => {
      render();
      ctx.unsaved?.sync("ingame");
      if (message) showToast(message, toastType);
    });
  }

  function publishSwapState(message, toastType = "success") {
    publishInGameState(message, {
      skipMapPick: true,
      skipHeroBan: true
    }, toastType);
  }

  function validateHeroBan(teamId, rawValue) {
    if (!state.settings.enableHeroBan) {
      return { error: "영웅밴이 비활성화 상태입니다." };
    }
    
    const hero = rawValue ? heroByName(rawValue) : null;
    const teamName = teamId === "team1" ? "Team 1" : "Team 2";
    
    if (rawValue && !hero) {
      return { error: `${teamName}의 밴 영웅을 목록에서 다시 선택해주세요.` };
    }
    
    if (hero && !isHeroSelectable(teamId, hero)) {
      return { error: `${teamName}이 선택할 수 없는 영웅입니다.` };
    }
    
    const otherTeamId = teamId === "team1" ? "team2" : "team1";
    const otherInputId = otherTeamId === "team1" ? "ban-team1" : "ban-team2";
    const otherHero = heroByName(document.getElementById(otherInputId).value.trim()) || getHeroFromCurrentState(otherTeamId);
    
    if (hero && otherHero) {
      if (otherHero.id === hero.id) {
        return { error: "동일한 영웅을 선택할 수 없습니다." };
      }
      if (otherHero.role === hero.role) {
        return { error: "동일한 역할군의 영웅을 선택할 수 없습니다." };
      }
    }
    
    return { hero };
  }

  function render() {
    const map = state.assets.maps.find((item) => item.id === state.current.currentMapId);
    const mode = state.current.currentMapMode || (map ? map.mode : "");
    document.getElementById("map-input").value = map ? map.name : "";
    const ban1 = state.assets.heroes.find((item) => item.id === state.current.bans.team1);
    const ban2 = state.assets.heroes.find((item) => item.id === state.current.bans.team2);
    document.getElementById("ban-team1").value = ban1 ? ban1.name : "";
    document.getElementById("ban-team2").value = ban2 ? ban2.name : "";
    updateSideArea(mode);
    setSideSelection(state.current.side);
    renderSidePickOwner();
    renderBanPriority();
    renderSwapManager();
  }

  function bind() {
    document.querySelectorAll(".search-input").forEach((wrapper) => {
      const input = wrapper.querySelector("input");
      const clearBtn = wrapper.querySelector(".clear-btn");
      if (!input || !clearBtn) return;
      const toggleClear = () => {
        clearBtn.classList.toggle("hidden", input.value.length === 0);
      };
      input.addEventListener("input", toggleClear);
      toggleClear();
    });

    document.querySelectorAll(".clear-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.clear;
        const input = document.getElementById(targetId);
        if (!input) return;
        input.value = "";
        input.dispatchEvent(new Event("input"));
        if (targetId === "map-input") {
          updateSideArea("");
          setSideSelection("");
          state.current.side = "";
          state.current.attackTeam = "";
          applyStandardSwapState();
          renderSwapManager();
        }
      });
    });

    document.getElementById("map-input").addEventListener("change", () => {
      const map = getSelectedMapFromInput();
      updateSideArea(map ? map.mode : "");
      renderSidePickOwner();
      renderSwapManager();
    });

    document.querySelectorAll("input[name='side']").forEach((radio) => {
      radio.addEventListener("change", (event) => {
        if (!isSelectedMapApplied()) {
          showToast("맵 적용 전 공/수 선택은 임시 상태입니다. 맵 적용을 눌러 반영해주세요.", "warning");
          return;
        }
        state.current.side = event.target.value;
        state.current.attackTeam = computeAttackTeamFromCurrentSelection();
        applyStandardSwapState();
        renderSwapManager();
        publishSwapState("공/수 선택이 적용되었습니다. (기본 스왑 적용)");
      });
    });

    document.getElementById("swap-team-btn").addEventListener("click", () => {
      if (!isSelectedMapApplied()) {
        showToast("맵 적용 후 팀 스왑을 사용할 수 있습니다.", "warning");
        return;
      }
      ensureOverlaySwapState();
      state.current.overlayTeamSwap = !state.current.overlayTeamSwap;
      renderSwapManager();
      publishSwapState("팀 스왑이 적용되었습니다.");
    });

    document.getElementById("swap-role-btn").addEventListener("click", () => {
      if (!isSelectedMapApplied()) {
        showToast("맵 적용 후 공수 로고 스왑을 사용할 수 있습니다.", "warning");
        return;
      }
      ensureOverlaySwapState();
      state.current.overlayRoleSwap = !state.current.overlayRoleSwap;
      renderSwapManager();
      publishSwapState("공수 로고 스왑이 적용되었습니다.");
    });

    document.getElementById("ban-auto").addEventListener("change", (event) => {
      const manualSelect = document.getElementById("ban-choice-owner");
      const manualEnabled = !event.target.checked;
      manualSelect.disabled = !manualEnabled;
      state.current.banChoiceOwnerManual = manualEnabled ? manualSelect.value : "";
      renderBanPriority();
      updateBanControlState();
      publishInGameState("영웅밴 우선 설정이 적용되었습니다.", {
        skipMapPick: true,
        skipHeroBan: true
      });
    });

    document.getElementById("ban-choice-owner").addEventListener("change", (event) => {
      state.current.banChoiceOwnerManual = event.target.value;
      renderBanPriority();
      updateBanControlState();
      publishInGameState("영웅밴 우선 설정이 적용되었습니다.", {
        skipMapPick: true,
        skipHeroBan: true
      });
    });

    document.querySelectorAll("input[name='ban-order']").forEach((radio) => {
      radio.addEventListener("change", (event) => {
        state.current.banOrderManual = event.target.value;
        updateBanControlState();
        publishInGameState("선밴/후밴 설정이 적용되었습니다.", {
          skipMapPick: true,
          skipHeroBan: true
        });
      });
    });

    document.getElementById("applyMap").addEventListener("click", async () => {
      const map = getSelectedMapFromInput();
      if (state.settings.enableMapPick && !map) {
        return alert("맵을 선택해주세요.");
      }
      if (state.settings.enableMapPick && map && !isMapSelectable(map)) {
        return alert("현재 규칙상 선택할 수 없는 맵입니다.");
      }

      state.current.currentMapId = map ? map.id : "";
      state.current.currentMapName = map ? map.name : "";
      state.current.currentMapMode = map ? map.mode : "";
      if (map && (map.mode === "hybrid" || map.mode === "escort")) {
        state.current.side = getSelectedSide();
        state.current.attackTeam = computeAttackTeamFromCurrentSelection();
        applyStandardSwapState();
      } else {
        state.current.side = "";
        state.current.attackTeam = "";
        applyStandardSwapState();
      }
      renderSwapManager();

      publishInGameState("맵이 적용되었습니다.", { skipHeroBan: true });
    });

    document.getElementById("applyBanTeam1").addEventListener("click", async () => {
      const rawValue = document.getElementById("ban-team1").value.trim();
      const result = validateHeroBan("team1", rawValue);
      
      if (result.error) return alert(result.error);
      
      state.current.bans.team1 = result.hero ? result.hero.id : "";
      updateBanControlState();
      publishInGameState(result.hero ? "Team 1 밴이 적용되었습니다." : "Team 1 밴이 초기화되었습니다.");
    });

    document.getElementById("applyBanTeam2").addEventListener("click", async () => {
      const rawValue = document.getElementById("ban-team2").value.trim();
      const result = validateHeroBan("team2", rawValue);
      
      if (result.error) return alert(result.error);
      
      state.current.bans.team2 = result.hero ? result.hero.id : "";
      updateBanControlState();
      publishInGameState(result.hero ? "Team 2 밴이 적용되었습니다." : "Team 2 밴이 초기화되었습니다.");
    });

    document.getElementById("resetBanTeam1").addEventListener("click", () => {
      document.getElementById("ban-team1").value = "";
      document.getElementById("ban-team1").dispatchEvent(new Event("input"));
      state.current.bans.team1 = "";
      updateBanControlState();
      publishInGameState("Team 1 밴이 초기화되었습니다.");
    });

    document.getElementById("resetBanTeam2").addEventListener("click", () => {
      document.getElementById("ban-team2").value = "";
      document.getElementById("ban-team2").dispatchEvent(new Event("input"));
      state.current.bans.team2 = "";
      updateBanControlState();
      publishInGameState("Team 2 밴이 초기화되었습니다.");
    });

    document.getElementById("resetInGameAll").addEventListener("click", async () => {
      document.getElementById("map-input").value = "";
      document.getElementById("map-input").dispatchEvent(new Event("input"));
      document.getElementById("ban-team1").value = "";
      document.getElementById("ban-team1").dispatchEvent(new Event("input"));
      document.getElementById("ban-team2").value = "";
      document.getElementById("ban-team2").dispatchEvent(new Event("input"));

      updateSideArea("");
      setSideSelection("");

      state.current.currentMapId = "";
      state.current.currentMapName = "";
      state.current.currentMapMode = "";
      state.current.side = "";
      state.current.attackTeam = "";
      state.current.bans.team1 = "";
      state.current.bans.team2 = "";
      updateBanControlState();
      applyStandardSwapState();
      renderSwapManager();

      publishInGameState("현재 경기 데이터가 초기화되었습니다.", { reset: true });
    });

    document.getElementById("finishMatch").addEventListener("click", () => {
      const summary = document.getElementById("finishSummary");
      const ban1 = state.assets.heroes.find((hero) => hero.id === state.current.bans.team1);
      const ban2 = state.assets.heroes.find((hero) => hero.id === state.current.bans.team2);
      const sideLabel = state.current.side === "attack" ? "공격" : state.current.side === "defense" ? "수비" : "-";
      summary.textContent = `${state.current.currentMapName || "-"} / 사이드: ${sideLabel} / 밴: ${ban1 ? ban1.name : "-"}, ${ban2 ? ban2.name : "-"}`;
      document.getElementById("finishModal").classList.add("active");
    });

    document.getElementById("cancelFinish").addEventListener("click", () => {
      document.getElementById("finishModal").classList.remove("active");
    });

    document.getElementById("confirmFinish").addEventListener("click", async () => {
      const winner = document.getElementById("finishWinner").value;
      const currentOverlayView = computeCurrentOverlayView();
      state.history.push({
        index: state.current.currentMatchIndex,
        mapId: state.current.currentMapId,
        mapName: state.current.currentMapName,
        mapMode: state.current.currentMapMode,
        side: state.current.side || "",
        sidePickOwner: state.current.sidePickOwner || "",
        sidePickReason: state.current.sidePickReason || "",
        attackTeam: state.current.attackTeam || "",
        overlayTeamSwap: !!state.current.overlayTeamSwap,
        overlayRoleSwap: !!state.current.overlayRoleSwap,
        layoutSwap: currentOverlayView.leftTeamId === "team2",
        banChoiceOwner: state.current.banChoiceOwner || "",
        banOrder: state.current.banOrder || "",
        bans: { ...state.current.bans },
        winner
      });
      state.current.currentMatchIndex += 1;
      state.current.lastWinnerTeamId = winner === "team1" || winner === "team2" ? winner : "";
      state.current.currentMapId = "";
      state.current.currentMapName = "";
      state.current.currentMapMode = "";
      state.current.side = "";
      state.current.bans = { team1: "", team2: "" };

      await fetchJSON("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: state.history })
      });

      await fetchJSON("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: state.current })
      });

      await ctx.refreshStateFromServer();

      wsPublish({
        context: "finish",
        settings: state.settings,
        teams: state.teams,
        state: state.current,
        history: state.history
      });
      if (ctx.views?.renderHistory) ctx.views.renderHistory();
      render();
      ctx.unsaved?.sync("ingame");
      ctx.unsaved?.sync("history");
      document.getElementById("finishModal").classList.remove("active");
      showToast("경기 결과가 저장되었습니다.");
    });
  }

  return {
    render,
    bind,
    getSnapshot,
    getSelectableMaps,
    getSelectableHeroes,
    updateSideArea,
    renderSidePickOwner
  };
}
