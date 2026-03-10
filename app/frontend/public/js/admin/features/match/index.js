import { readImageAsDataUrl, shuffle } from "../../core/utils.js";

export function createMatchModule(ctx) {
  const { state, fetchJSON, wsPublish, showToast } = ctx;

  function getSnapshot() {
    return {
      matchName: document.getElementById("match-name")?.value ?? "",
      matchLogo: state.settings?.matchLogo || "",
      series: document.getElementById("match-series")?.value ?? "",
      firstPickTeamId: document.getElementById("first-pick")?.value ?? "",
      enableHeroBan: !!document.getElementById("toggle-hero")?.checked,
      enableMapPick: !!document.getElementById("toggle-map")?.checked,
      mapPool: {
        control: [...(state.settings?.mapPool?.control || [])],
        hybrid: [...(state.settings?.mapPool?.hybrid || [])],
        flashpoint: [...(state.settings?.mapPool?.flashpoint || [])],
        push: [...(state.settings?.mapPool?.push || [])],
        escort: [...(state.settings?.mapPool?.escort || [])]
      }
    };
  }

  function updateMatchLogoPreview() {
    const preview = document.getElementById("match-logo-preview");
    if (!preview) return;
    preview.innerHTML = "";
    const logo = state.settings?.matchLogo || "";
    if (logo) {
      const img = document.createElement("img");
      img.src = logo;
      preview.appendChild(img);
    }
  }

  function renderMapPool() {
    const mapPool = document.getElementById("mapPool");
    mapPool.innerHTML = "";

    const modes = ["control", "hybrid", "flashpoint", "push", "escort"];

    modes.forEach((mode) => {
      const group = document.createElement("div");
      group.className = "map-pool-group";
      const options = state.assets.maps.filter((map) => map.mode === mode);
      const chips = (state.settings.mapPool[mode] || []).map((id) => {
        const map = state.assets.maps.find((item) => item.id === id);
        return `<span class="chip">${map ? map.name : id}<button data-remove="${id}">×</button></span>`;
      });

      group.innerHTML = `
        <strong>${mode.toUpperCase()}</strong>
        <div class="map-pool-chips">${chips.join("") || "<span class='muted'>선택 없음</span>"}</div>
        <div class="map-pool-actions">
          <select data-mode="${mode}">
            <option value="">맵 추가</option>
            ${options.map((map) => `<option value="${map.id}">${map.name}</option>`).join("")}
          </select>
          <button class="secondary" data-random="${mode}">랜덤 선택</button>
        </div>
      `;

      group.querySelector("select").addEventListener("change", (event) => {
        const mapId = event.target.value;
        if (!mapId) return;
        const list = state.settings.mapPool[mode] || [];
        if (!list.includes(mapId)) list.push(mapId);
        state.settings.mapPool[mode] = list;
        renderMapPool();
      });

      group.querySelector("[data-random]").addEventListener("click", () => {
        const picks = shuffle(options.map((map) => map.id)).slice(0, 4);
        state.settings.mapPool[mode] = picks;
        renderMapPool();
      });

      group.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.remove;
          state.settings.mapPool[mode] = (state.settings.mapPool[mode] || []).filter((item) => item !== id);
          renderMapPool();
        });
      });

      mapPool.appendChild(group);
    });
  }

  function toggleAreas() {
    document.getElementById("mapPickArea").style.display = state.settings.enableMapPick ? "block" : "none";
    document.getElementById("mapPoolCard").style.display = state.settings.enableMapPick ? "block" : "none";
    document.getElementById("heroBanArea").style.display = state.settings.enableHeroBan ? "block" : "none";
    if (ctx.views?.renderHistory) ctx.views.renderHistory();
    if (ctx.views?.renderInGame) ctx.views.renderInGame();
  }

  function render() {
    document.getElementById("match-name").value = state.settings.matchName;
    state.settings.matchLogo = state.settings.matchLogo || "";
    document.getElementById("match-series").value = state.settings.series;
    document.getElementById("first-pick").value = state.settings.firstPickTeamId;
    document.getElementById("toggle-hero").checked = state.settings.enableHeroBan;
    document.getElementById("toggle-map").checked = state.settings.enableMapPick;
    updateMatchLogoPreview();
    renderMapPool();
    toggleAreas();
  }

  function bind() {
    document.getElementById("match-logo-file").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      state.settings.matchLogo = await readImageAsDataUrl(file);
      updateMatchLogoPreview();
    });

    document.getElementById("match-logo-clear").addEventListener("click", () => {
      state.settings.matchLogo = "";
      updateMatchLogoPreview();
    });

    document.getElementById("match-logo-default").addEventListener("click", () => {
      state.settings.matchLogo = "/img/icon/primary-logo.png";
      updateMatchLogoPreview();
    });

    document.getElementById("saveMatch").addEventListener("click", async () => {
      state.settings.matchName = document.getElementById("match-name").value;
      state.settings.matchLogo = state.settings.matchLogo || "";
      state.settings.series = document.getElementById("match-series").value;
      state.settings.firstPickTeamId = document.getElementById("first-pick").value;
      state.settings.enableHeroBan = document.getElementById("toggle-hero").checked;
      state.settings.enableMapPick = document.getElementById("toggle-map").checked;

      await fetchJSON("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: state.settings })
      });

      wsPublish({
        context: "settings",
        settings: state.settings,
        teams: state.teams,
        state: state.current,
        history: state.history
      });
      toggleAreas();
      ctx.unsaved?.sync("match");
      showToast("매치 설정이 저장되었습니다.", "success");
    });

    document.getElementById("selectAllMaps").addEventListener("click", () => {
      const modes = ["control", "hybrid", "flashpoint", "push", "escort"];
      modes.forEach((mode) => {
        state.settings.mapPool[mode] = state.assets.maps
          .filter((map) => map.mode === mode)
          .map((map) => map.id);
      });
      renderMapPool();
      showToast("맵 풀을 전체 선택했습니다.", "info");
    });

    document.getElementById("resetAll").addEventListener("click", async () => {
      const confirmed = confirm("전체 초기화하시겠습니까?");
      if (!confirmed) return;
      await fetchJSON("/api/reset", { method: "POST" });
      await ctx.refreshAllData({ force: true });
      wsPublish({
        context: "settings",
        settings: state.settings,
        teams: state.teams,
        state: state.current,
        history: state.history
      });
      showToast("초기화 완료", "success");
    });

    document.getElementById("toggle-hero").addEventListener("change", () => {
      state.settings.enableHeroBan = document.getElementById("toggle-hero").checked;
      toggleAreas();
    });

    document.getElementById("toggle-map").addEventListener("change", () => {
      state.settings.enableMapPick = document.getElementById("toggle-map").checked;
      toggleAreas();
    });
  }

  return { render, bind, toggleAreas, getSnapshot };
}
