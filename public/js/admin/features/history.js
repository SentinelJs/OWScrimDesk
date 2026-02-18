export function createHistoryModule(ctx) {
  const { state, fetchJSON, wsPublish, showToast } = ctx;

  function render() {
    const tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML = "";
    state.history.forEach((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td class="map-col">
          <select data-field="mapId">
            <option value="">-</option>
            ${state.assets.maps
              .map((map) => `<option value="${map.id}" ${map.id === item.mapId ? "selected" : ""}>${map.name}</option>`)
              .join("")}
          </select>
        </td>
        <td class="ban-col">
          <select data-field="ban1">
            <option value="">-</option>
            ${state.assets.heroes
              .map((hero) => `<option value="${hero.id}" ${hero.id === item.bans?.team1 ? "selected" : ""}>${hero.name}</option>`)
              .join("")}
          </select>
        </td>
        <td class="ban-col">
          <select data-field="ban2">
            <option value="">-</option>
            ${state.assets.heroes
              .map((hero) => `<option value="${hero.id}" ${hero.id === item.bans?.team2 ? "selected" : ""}>${hero.name}</option>`)
              .join("")}
          </select>
        </td>
        <td>
          <select data-field="winner">
            <option value="team1" ${item.winner === "team1" ? "selected" : ""}>Team1</option>
            <option value="team2" ${item.winner === "team2" ? "selected" : ""}>Team2</option>
          </select>
        </td>
        <td><button class="secondary" data-action="delete">삭제</button></td>
      `;
      row.querySelector("[data-action='delete']").addEventListener("click", () => {
        state.history.splice(index, 1);
        render();
      });
      tbody.appendChild(row);
    });

    const banCols = document.querySelectorAll(".ban-col");
    banCols.forEach((col) => {
      col.style.display = state.settings.enableHeroBan ? "table-cell" : "none";
    });
    const mapCols = document.querySelectorAll(".map-col");
    mapCols.forEach((col) => {
      col.style.display = state.settings.enableMapPick ? "table-cell" : "none";
    });
  }

  function bind() {
    document.getElementById("saveHistory").addEventListener("click", async () => {
      const rows = Array.from(document.querySelectorAll("#historyTable tbody tr"));
      const nextHistory = rows.map((row, index) => {
        const mapId = row.querySelector("[data-field='mapId']").value;
        const ban1 = row.querySelector("[data-field='ban1']")?.value || "";
        const ban2 = row.querySelector("[data-field='ban2']")?.value || "";
        const winner = row.querySelector("[data-field='winner']").value;
        const map = state.assets.maps.find((item) => item.id === mapId);
        const prev = state.history[index];
        return {
          index: index + 1,
          mapId,
          mapName: map ? map.name : "",
          mapMode: map ? map.mode : "",
          side: prev?.side || "",
          sidePickOwner: prev?.sidePickOwner || "",
          sidePickReason: prev?.sidePickReason || "",
          attackTeam: prev?.attackTeam || "",
          layoutSwap: prev?.layoutSwap || false,
          banChoiceOwner: prev?.banChoiceOwner || "",
          banOrder: prev?.banOrder || "",
          bans: { team1: ban1, team2: ban2 },
          winner
        };
      });
      state.history = nextHistory;

      await fetchJSON("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: state.history })
      });

      await ctx.refreshStateFromServer();

      wsPublish({
        context: "history",
        settings: state.settings,
        teams: state.teams,
        state: state.current,
        history: state.history
      });
      render();
      showToast("기록이 저장되었습니다.");
    });
  }

  return { render, bind };
}
