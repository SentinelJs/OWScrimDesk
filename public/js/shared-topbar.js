(() => {
  function getPickingTeam(settings = {}, history = [], gameIndex = 1) {
    const initial = settings.firstPickTeamId || "team1";
    if (gameIndex <= 1) return initial;
    const prev = history.find((game) => game.index === gameIndex - 1);
    if (!prev || !prev.winner) return initial;
    return prev.winner === "team1" ? "team2" : "team1";
  }

  function updateLogo(container, logoUrl) {
    if (!container) return;
    const teamBlock = container.closest(".team-block");
    container.innerHTML = "";
    if (!logoUrl) {
      container.style.display = "none";
      if (teamBlock) teamBlock.classList.add("no-logo");
      return;
    }
    container.style.display = "grid";
    if (teamBlock) teamBlock.classList.remove("no-logo");
    const img = document.createElement("img");
    img.src = encodeURI(logoUrl);
    img.alt = "";
    container.appendChild(img);
  }

  function fitMatchNameText(matchName, matchMetaContent) {
    if (!matchName || !matchMetaContent) return;

    const hasLogo = matchMetaContent.classList.contains("with-logo");
    const maxFont = 28;
    const minFont = 14;

    matchName.style.fontSize = `${maxFont}px`;

    let currentFont = maxFont;
    while (
      currentFont > minFont
      && (matchName.scrollWidth > matchName.clientWidth || matchName.scrollHeight > matchName.clientHeight)
    ) {
      currentFont -= 1;
      matchName.style.fontSize = `${currentFont}px`;
    }
  }

  function setMatchMeta(matchName, matchLogo, matchMetaContent, settings = {}) {
    const rawMatchName = settings.matchName ?? "";
    const normalizedMatchName = String(rawMatchName);
    const matchLogoSrc = settings.matchLogo || "";

    matchName.textContent = normalizedMatchName;
    matchMetaContent.classList.toggle("has-linebreak", /\r?\n/.test(normalizedMatchName));

    if (matchLogoSrc) {
      matchLogo.src = encodeURI(matchLogoSrc);
      matchLogo.style.display = "block";
      matchMetaContent.classList.add("with-logo");

      if (normalizedMatchName.trim().length < 1) {
        matchLogo.style.height = "100px";
        matchLogo.style.width = "auto";
      } else {
        matchLogo.style.removeProperty("height");
        matchLogo.style.removeProperty("width");
      }
    } else {
      matchLogo.removeAttribute("src");
      matchLogo.style.display = "none";
      matchLogo.style.removeProperty("height");
      matchLogo.style.removeProperty("width");
      matchMetaContent.classList.remove("with-logo");
    }

    fitMatchNameText(matchName, matchMetaContent);
  }

  function setPickIndicators(pickLeft, pickRight, options = {}) {
    if (!pickLeft || !pickRight) return;

    const {
      settings = {},
      history = [],
      currentMatchIndex = 1,
      showPickIndicator = false,
      pickLabel = "MAP PICK"
    } = options;

    if (!showPickIndicator) {
      pickLeft.textContent = "";
      pickRight.textContent = "";
      return;
    }

    const pickingTeam = getPickingTeam(settings, history, currentMatchIndex);
    if (pickingTeam === "team1") {
      pickLeft.textContent = pickLabel;
      pickRight.textContent = "";
      return;
    }
    if (pickingTeam === "team2") {
      pickLeft.textContent = "";
      pickRight.textContent = pickLabel;
      return;
    }

    pickLeft.textContent = "";
    pickRight.textContent = "";
  }

  function cacheTopbarElements(root = document) {
    return {
      team1Name: root.getElementById("team1-name"),
      team2Name: root.getElementById("team2-name"),
      team1Logo: root.getElementById("team1-logo"),
      team2Logo: root.getElementById("team2-logo"),
      scoreTeam1: root.getElementById("score-team1"),
      scoreTeam2: root.getElementById("score-team2"),
      matchName: root.getElementById("match-name"),
      matchLogo: root.getElementById("match-logo"),
      matchMetaContent: root.getElementById("match-meta-content"),
      pickLeft: root.getElementById("pick-left"),
      pickRight: root.getElementById("pick-right"),
      pickingText: root.getElementById("picking-text")
    };
  }

  async function mount(slot, options = {}) {
    const target = typeof slot === "string" ? document.querySelector(slot) : slot;
    if (!target) {
      throw new Error("상단바 슬롯을 찾을 수 없습니다.");
    }

    const partialUrl = options.partialUrl || "/partials/shared-topbar.html";
    const res = await fetch(partialUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("공통 상단바를 불러오지 못했습니다.");
    }
    target.innerHTML = await res.text();

    const els = cacheTopbarElements(document);

    return {
      update({
        teams = {},
        score = {},
        settings = {},
        history = [],
        currentMatchIndex = 1,
        showPickIndicator = false,
        pickLabel = "MAP PICK"
      } = {}) {
        const safeTeams = {
          team1: { name: "Team 1", logo: "", ...(teams.team1 || {}) },
          team2: { name: "Team 2", logo: "", ...(teams.team2 || {}) }
        };

        if (els.team1Name) els.team1Name.textContent = safeTeams.team1.name;
        if (els.team2Name) els.team2Name.textContent = safeTeams.team2.name;

        updateLogo(els.team1Logo, safeTeams.team1.logo || "");
        updateLogo(els.team2Logo, safeTeams.team2.logo || "");

        if (els.scoreTeam1) els.scoreTeam1.textContent = score.team1 ?? 0;
        if (els.scoreTeam2) els.scoreTeam2.textContent = score.team2 ?? 0;

        if (els.matchName && els.matchLogo && els.matchMetaContent) {
          setMatchMeta(els.matchName, els.matchLogo, els.matchMetaContent, settings);
        }

        if (els.pickingText) {
          els.pickingText.textContent = "";
        }

        setPickIndicators(els.pickLeft, els.pickRight, {
          settings,
          history,
          currentMatchIndex,
          showPickIndicator,
          pickLabel
        });
      },

      fitMatchNameText() {
        fitMatchNameText(els.matchName, els.matchMetaContent);
      }
    };
  }

  window.SharedTopbar = {
    mount,
    getPickingTeam
  };
})();
