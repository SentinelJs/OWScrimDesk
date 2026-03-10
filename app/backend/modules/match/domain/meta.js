const { getSidePickOwner } = require("./rules");

function normalizeMatchIndex(state, history) {
  const maxIndex = history.length + 1;
  if (!state.currentMatchIndex || state.currentMatchIndex < 1) {
    state.currentMatchIndex = 1;
  }
  if (state.currentMatchIndex > maxIndex) {
    state.currentMatchIndex = maxIndex;
  }
}

function applySidePickMeta({ settings, state, history }) {
  normalizeMatchIndex(state, history);
  const { ownerTeam, reason } = getSidePickOwner({
    gameIndex: state.currentMatchIndex,
    initialLeadTeam: settings.firstPickTeamId,
    historyGames: history
  });
  state.sidePickOwner = ownerTeam;
  state.sidePickReason = reason;
}

function applyBanPriorityMeta({ settings, state, history }) {
  if (!settings.enableHeroBan) {
    Object.assign(state, {
      banChoiceOwnerAuto: "",
      banChoiceOwner: "",
      banChoiceOwnerReason: "",
      banOrderAuto: "",
      banOrder: ""
    });
    return;
  }

  normalizeMatchIndex(state, history);
  const gameIndex = state.currentMatchIndex;
  const initialLeadTeam = settings.firstPickTeamId;
  const prev = gameIndex > 1 ? history.find((game) => game.index === gameIndex - 1) : null;

  if (gameIndex === 1 || !prev || !prev.winner) {
    state.banChoiceOwnerAuto = initialLeadTeam;
    state.banChoiceOwnerReason = "MAP1_INITIAL";
  } else {
    state.banChoiceOwnerAuto = prev.winner === "team1" ? "team2" : "team1";
    state.banChoiceOwnerReason = "PREV_LOSER";
  }

  state.banChoiceOwner = ["team1", "team2"].includes(state.banChoiceOwnerManual)
    ? state.banChoiceOwnerManual
    : state.banChoiceOwnerAuto;

  state.banOrderAuto = state.banChoiceOwnerAuto === "team1" ? "A_FIRST" : "B_FIRST";
  state.banOrder = ["A_FIRST", "B_FIRST"].includes(state.banOrderManual)
    ? state.banOrderManual
    : state.banOrderAuto;
}

function applyLayoutSwapMeta({ state }) {
  state.attackTeam = state.sidePickOwner
    ? (state.side === "attack" ? state.sidePickOwner : (state.side === "defense" ? (state.sidePickOwner === "team1" ? "team2" : "team1") : ""))
    : "";

  state.overlayTeamSwap = !!state.overlayTeamSwap;
  state.overlayRoleSwap = !!state.overlayRoleSwap;

  const hasAttack = ["team1", "team2"].includes(state.attackTeam);
  const standardLeftTeamId = hasAttack && state.attackTeam === "team1" ? "team2" : "team1";
  const currentLeftTeamId = state.overlayTeamSwap ? (standardLeftTeamId === "team1" ? "team2" : "team1") : standardLeftTeamId;
  state.layoutSwap = currentLeftTeamId === "team2";
}

function applyAllMeta(data) {
  applySidePickMeta(data);
  applyBanPriorityMeta(data);
  applyLayoutSwapMeta(data);
}

module.exports = {
  normalizeMatchIndex,
  applySidePickMeta,
  applyBanPriorityMeta,
  applyLayoutSwapMeta,
  applyAllMeta
};
