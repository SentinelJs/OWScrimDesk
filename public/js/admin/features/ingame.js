export function createInGameModule(ctx) {
  const { state, wsPublish, showToast, fetchJSON } = ctx;

  function mapByName(name) {
    return state.assets.maps.find((map) => map.name === name) || null;
  }

  function heroByName(name) {
    return state.assets.heroes.find((hero) => hero.name === name) || null;
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

  function getHeroByInputValue(inputId) {
    const value = document.getElementById(inputId)?.value?.trim() || "";
    if (!value) return null;
    return heroByName(value);
  }

  function isHeroSelectable(teamId, hero) {
    if (!state.settings.enableHeroBan) return true;
    if (!hero) return false;

    const usedBans = state.history.map((game) => game.bans?.[teamId]).filter(Boolean);
    if (usedBans.includes(hero.id)) return false;

    const otherTeamId = teamId === "team1" ? "team2" : "team1";
    const otherHero = getHeroByInputValue(otherTeamId === "team1" ? "ban-team1" : "ban-team2");
    if (otherHero) {
      if (otherHero.id === hero.id) return false;
      if (otherHero.role === hero.role) return false;
    }

    return true;
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

  function computeLayoutSwapForAttackRight(attackTeam) {
    if (attackTeam === "team1") return true;
    if (attackTeam === "team2") return false;
    return state.current.layoutSwap;
  }

  function renderLayoutSwap() {
    const autoToggle = document.getElementById("layout-auto");
    const swapToggle = document.getElementById("layout-swap");
    if (!autoToggle || !swapToggle) return;
    autoToggle.checked = state.current.layoutSwapAuto !== false;
    swapToggle.checked = !!state.current.layoutSwap;
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

  async function publishInGameState(message, extraPayload = {}) {
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
      if (message) showToast(message);
    });
  }

  function getHeroFromCurrentState(teamId) {
    const heroId = state.current?.bans?.[teamId];
    if (!heroId) return null;
    return state.assets.heroes.find((hero) => hero.id === heroId) || null;
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
    renderLayoutSwap();
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
        }
      });
    });

    document.getElementById("map-input").addEventListener("change", () => {
      const map = mapByName(document.getElementById("map-input").value.trim());
      updateSideArea(map ? map.mode : "");
      renderSidePickOwner();
    });

    document.querySelectorAll("input[name='side']").forEach((radio) => {
      radio.addEventListener("change", (event) => {
        state.current.side = event.target.value;
        const owner = state.current.sidePickOwner;
        const attackTeam = owner
          ? event.target.value === "attack"
            ? owner
            : owner === "team1"
              ? "team2"
              : "team1"
          : "";
        state.current.attackTeam = attackTeam;
        if (state.current.layoutSwapAuto !== false) {
          state.current.layoutSwap = computeLayoutSwapForAttackRight(attackTeam);
          renderLayoutSwap();
        }
      });
    });

    document.getElementById("layout-swap").addEventListener("change", (event) => {
      state.current.layoutSwap = event.target.checked;
      state.current.layoutSwapAuto = false;
      renderLayoutSwap();
    });

    document.getElementById("layout-auto").addEventListener("change", (event) => {
      state.current.layoutSwapAuto = event.target.checked;
      if (state.current.layoutSwapAuto) {
        state.current.layoutSwap = computeLayoutSwapForAttackRight(state.current.attackTeam);
      }
      renderLayoutSwap();
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
      const map = mapByName(document.getElementById("map-input").value.trim());
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
        const owner = state.current.sidePickOwner;
        state.current.attackTeam = owner
          ? state.current.side === "attack"
            ? owner
            : owner === "team1"
              ? "team2"
              : "team1"
          : "";
      } else {
        state.current.side = "";
        state.current.attackTeam = "";
      }

      const layoutAuto = document.getElementById("layout-auto").checked;
      const layoutSwap = document.getElementById("layout-swap").checked;
      state.current.layoutSwapAuto = layoutAuto;
      state.current.layoutSwap = layoutAuto
        ? computeLayoutSwapForAttackRight(state.current.attackTeam)
        : layoutSwap;

      publishInGameState("맵이 적용되었습니다.", { skipHeroBan: true });
    });

    document.getElementById("applyBanTeam1").addEventListener("click", async () => {
      if (!state.settings.enableHeroBan) {
        return alert("영웅밴이 비활성화 상태입니다.");
      }
      const rawValue = document.getElementById("ban-team1").value.trim();
      const hero1 = rawValue ? heroByName(rawValue) : null;
      if (rawValue && !hero1) {
        return alert("Team 1의 밴 영웅을 목록에서 다시 선택해주세요.");
      }
      if (hero1 && !isHeroSelectable("team1", hero1)) {
        return alert("Team 1이 선택할 수 없는 영웅입니다.");
      }

      const otherHero = heroByName(document.getElementById("ban-team2").value.trim()) || getHeroFromCurrentState("team2");
      if (hero1 && otherHero) {
        if (otherHero.id === hero1.id) {
          return alert("동일한 영웅을 선택할 수 없습니다.");
        }
        if (otherHero.role === hero1.role) {
          return alert("동일한 역할군의 영웅을 선택할 수 없습니다.");
        }
      }

      state.current.bans.team1 = hero1 ? hero1.id : "";
      updateBanControlState();

      publishInGameState(hero1 ? "Team 1 밴이 적용되었습니다." : "Team 1 밴이 초기화되었습니다.");
    });

    document.getElementById("applyBanTeam2").addEventListener("click", async () => {
      if (!state.settings.enableHeroBan) {
        return alert("영웅밴이 비활성화 상태입니다.");
      }
      const rawValue = document.getElementById("ban-team2").value.trim();
      const hero2 = rawValue ? heroByName(rawValue) : null;
      if (rawValue && !hero2) {
        return alert("Team 2의 밴 영웅을 목록에서 다시 선택해주세요.");
      }
      if (hero2 && !isHeroSelectable("team2", hero2)) {
        return alert("Team 2가 선택할 수 없는 영웅입니다.");
      }

      const otherHero = heroByName(document.getElementById("ban-team1").value.trim()) || getHeroFromCurrentState("team1");
      if (hero2 && otherHero) {
        if (otherHero.id === hero2.id) {
          return alert("동일한 영웅을 선택할 수 없습니다.");
        }
        if (otherHero.role === hero2.role) {
          return alert("동일한 역할군의 영웅을 선택할 수 없습니다.");
        }
      }

      state.current.bans.team2 = hero2 ? hero2.id : "";
      updateBanControlState();

      publishInGameState(hero2 ? "Team 2 밴이 적용되었습니다." : "Team 2 밴이 초기화되었습니다.");
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

      const layoutAuto = document.getElementById("layout-auto").checked;
      const layoutSwap = document.getElementById("layout-swap").checked;
      state.current.layoutSwapAuto = layoutAuto;
      state.current.layoutSwap = layoutAuto
        ? computeLayoutSwapForAttackRight(state.current.attackTeam)
        : layoutSwap;

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
      state.history.push({
        index: state.current.currentMatchIndex,
        mapId: state.current.currentMapId,
        mapName: state.current.currentMapName,
        mapMode: state.current.currentMapMode,
        side: state.current.side || "",
        sidePickOwner: state.current.sidePickOwner || "",
        sidePickReason: state.current.sidePickReason || "",
        attackTeam: state.current.attackTeam || "",
        layoutSwap: !!state.current.layoutSwap,
        banChoiceOwner: state.current.banChoiceOwner || "",
        banOrder: state.current.banOrder || "",
        bans: { ...state.current.bans },
        winner
      });
      state.current.currentMatchIndex += 1;
      state.current.lastWinnerTeamId = winner;
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
      document.getElementById("finishModal").classList.remove("active");
      showToast("경기 결과가 저장되었습니다.");
    });
  }

  return {
    render,
    bind,
    getSelectableMaps,
    getSelectableHeroes,
    updateSideArea,
    renderSidePickOwner
  };
}
