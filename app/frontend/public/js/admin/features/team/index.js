import { readImageAsDataUrl } from "../../core/utils.js";

const DEFAULT_TEAM_LOGO = "/img/icon/primary-logo.png";

export function createTeamModule(ctx) {
  const { state, fetchJSON, wsPublish, showToast } = ctx;

  function getSnapshot() {
    return {
      team1: {
        name: document.getElementById("team1-name")?.value ?? "",
        color: document.getElementById("team1-color")?.value ?? "",
        logo: state.teams?.team1?.logo || ""
      },
      team2: {
        name: document.getElementById("team2-name")?.value ?? "",
        color: document.getElementById("team2-color")?.value ?? "",
        logo: state.teams?.team2?.logo || ""
      }
    };
  }

  function updateLogoPreview(teamId) {
    const preview = document.getElementById(`${teamId}-logo-preview`);
    if (!preview) return;
    preview.innerHTML = "";
    const logo = state.teams[teamId].logo;
    if (logo) {
      const img = document.createElement("img");
      img.src = logo;
      preview.appendChild(img);
    }
  }

  function syncLogoUrlInput(teamId) {
    const input = document.getElementById(`${teamId}-logo-url`);
    if (!input) return;
    const logo = state.teams[teamId].logo || "";
    input.value = logo.startsWith("data:") ? "" : logo;
  }

  function setTeamLogo(teamId, logo) {
    state.teams[teamId].logo = logo;
    updateLogoPreview(teamId);
    syncLogoUrlInput(teamId);
  }

  function updateColorLabel(teamId) {
    const color = document.getElementById(`${teamId}-color`).value;
    document.getElementById(`${teamId}-color-swatch`).style.background = color;
  }

  async function applyDominantColor(teamId) {
    const logo = state.teams[teamId].logo;
    if (!logo) {
      alert("먼저 로고를 업로드해주세요.");
      return;
    }
    try {
      const result = await fetchJSON("/api/teams/dominant-color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo })
      });
      if (!result.ok || !result.color) {
        throw new Error(result.message || "색상 추출 실패");
      }
      state.teams[teamId].color = result.color;
      document.getElementById(`${teamId}-color`).value = result.color;
      updateColorLabel(teamId);
      showToast("로고 색상이 적용되었습니다.", "success");
    } catch (error) {
      alert(error.message || "색상 추출 중 오류가 발생했습니다.");
    }
  }

  function renderTeamIdentity() {
    const el = document.getElementById("teamIdentity");
    if (!el || !state.teams) return;
    const team1 = state.teams.team1?.name || "Team 1";
    const team2 = state.teams.team2?.name || "Team 2";
    el.textContent = `Team 1: ${team1}  |  Team 2: ${team2}`;
  }

  function render() {
    document.getElementById("team1-name").value = state.teams.team1.name;
    document.getElementById("team2-name").value = state.teams.team2.name;
    document.getElementById("team1-color").value = state.teams.team1.color;
    document.getElementById("team2-color").value = state.teams.team2.color;
    document.getElementById("team1-color-swatch").style.background = state.teams.team1.color;
    document.getElementById("team2-color-swatch").style.background = state.teams.team2.color;
    updateLogoPreview("team1");
    updateLogoPreview("team2");
    syncLogoUrlInput("team1");
    syncLogoUrlInput("team2");
    renderTeamIdentity();
  }

  function bind() {
    document.getElementById("team1-color").addEventListener("input", () => updateColorLabel("team1"));
    document.getElementById("team2-color").addEventListener("input", () => updateColorLabel("team2"));

    document.getElementById("team1-logo-file").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setTeamLogo("team1", await readImageAsDataUrl(file));
    });

    document.getElementById("team2-logo-file").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setTeamLogo("team2", await readImageAsDataUrl(file));
    });

    const applyLogoUrl = async (teamId) => {
      const input = document.getElementById(`${teamId}-logo-url`);
      const raw = input?.value || "";
      const logo = raw.trim();
      if (!logo) {
        alert("로고 링크를 입력해주세요.");
        input?.focus();
        return;
      }

      try {
        const result = await fetchJSON("/api/assets/image-data-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: logo })
        });

        if (!result?.ok || typeof result.dataUrl !== "string" || !result.dataUrl) {
          throw new Error(result?.message || "이미지 변환 실패");
        }

        setTeamLogo(teamId, result.dataUrl);
        showToast("링크 로고가 적용되었습니다.", "success");
      } catch (error) {
        alert(error.message || "링크 로고 적용 중 오류가 발생했습니다.");
      }
    };

    document.getElementById("team1-logo-url-apply").addEventListener("click", async () => {
      await applyLogoUrl("team1");
    });

    document.getElementById("team2-logo-url-apply").addEventListener("click", async () => {
      await applyLogoUrl("team2");
    });

    document.getElementById("team1-logo-url").addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      await applyLogoUrl("team1");
    });

    document.getElementById("team2-logo-url").addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      await applyLogoUrl("team2");
    });

    document.getElementById("team1-logo-default").addEventListener("click", () => {
      setTeamLogo("team1", DEFAULT_TEAM_LOGO);
      showToast("기본 로고가 적용되었습니다.", "info");
    });

    document.getElementById("team2-logo-default").addEventListener("click", () => {
      setTeamLogo("team2", DEFAULT_TEAM_LOGO);
      showToast("기본 로고가 적용되었습니다.", "info");
    });

    document.getElementById("team1-logo-clear").addEventListener("click", () => {
      setTeamLogo("team1", "");
    });

    document.getElementById("team2-logo-clear").addEventListener("click", () => {
      setTeamLogo("team2", "");
    });

    document.getElementById("team1-logo-color").addEventListener("click", () => {
      applyDominantColor("team1");
    });

    document.getElementById("team2-logo-color").addEventListener("click", () => {
      applyDominantColor("team2");
    });

    document.getElementById("saveTeams").addEventListener("click", async () => {
      state.teams.team1.name = document.getElementById("team1-name").value || "Team 1";
      state.teams.team2.name = document.getElementById("team2-name").value || "Team 2";
      state.teams.team1.color = document.getElementById("team1-color").value;
      state.teams.team2.color = document.getElementById("team2-color").value;

      await fetchJSON("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: state.teams })
      });

      wsPublish({
        context: "teams",
        teams: state.teams,
        settings: state.settings,
        state: state.current,
        history: state.history
      });
      renderTeamIdentity();
      ctx.unsaved?.sync("team");
      showToast("팀 정보가 저장되었습니다.", "success");
    });
  }

  return { render, bind, getSnapshot };
}
