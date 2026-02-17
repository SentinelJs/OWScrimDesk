let assets = { maps: [], heroes: [] };
let ws;

function connectWS() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "overlay:hello" }));
  });
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "overlay:update") {
      render(data.payload);
    }
  });
  ws.addEventListener("close", () => {
    setTimeout(connectWS, 1500);
  });
}

function heroById(id) {
  return assets.heroes.find((hero) => hero.id === id);
}

function mapById(id) {
  return assets.maps.find((map) => map.id === id);
}

function render(payload) {
  if (!payload) return;
  const { settings, teams, state, history, score } = payload;
  assets = payload.assets || assets;

  document.getElementById("match-name").textContent = settings.matchName;
  const matchLogo = document.getElementById("match-logo");
  matchLogo.src = settings.matchLogo || "";
  matchLogo.style.display = settings.matchLogo ? "block" : "none";
  document.getElementById("team1-name").textContent = teams.team1.name;
  document.getElementById("team2-name").textContent = teams.team2.name;
  document.getElementById("team1-score").textContent = score.team1 ?? 0;
  document.getElementById("team2-score").textContent = score.team2 ?? 0;

  const team1Logo = document.getElementById("team1-logo");
  const team2Logo = document.getElementById("team2-logo");
  team1Logo.src = teams.team1.logo || "";
  team2Logo.src = teams.team2.logo || "";
  team1Logo.style.display = teams.team1.logo ? "block" : "none";
  team2Logo.style.display = teams.team2.logo ? "block" : "none";

  document.getElementById("team1").style.border = `2px solid ${teams.team1.color}`;
  document.getElementById("team2").style.border = `2px solid ${teams.team2.color}`;

  const map = mapById(state.currentMapId);
  document.getElementById("map-name").textContent = map ? map.name : "-";
  const mapImage = document.getElementById("map-image");
  mapImage.src = map ? map.image : "";
  mapImage.style.display = map ? "block" : "none";

  const banArea = document.getElementById("ban-area");
  banArea.style.display = settings.enableHeroBan ? "flex" : "none";
  if (settings.enableHeroBan) {
    const ban1 = heroById(state.bans.team1);
    const ban2 = heroById(state.bans.team2);
    const ban1Img = document.getElementById("ban1-img");
    const ban2Img = document.getElementById("ban2-img");
    ban1Img.src = ban1 ? ban1.image : "";
    ban2Img.src = ban2 ? ban2.image : "";
    ban1Img.style.display = ban1 ? "block" : "none";
    ban2Img.style.display = ban2 ? "block" : "none";
  }
}

connectWS();
