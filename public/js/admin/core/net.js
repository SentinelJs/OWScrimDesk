let ws;
let publishQueue = [];

function flushPublishQueue(result) {
  if (!publishQueue.length) return;
  const item = publishQueue.shift();
  clearTimeout(item.timer);
  item.resolve(result);
}

function clearPublishQueueOnDisconnect() {
  if (!publishQueue.length) return;
  publishQueue.forEach((item) => {
    clearTimeout(item.timer);
    item.resolve({ ok: false, message: "웹소켓 연결이 끊어졌습니다." });
  });
  publishQueue = [];
}

export function connectWS(onError) {
  const wsStatus = document.getElementById("wsStatus");
  ws = new WebSocket(`ws://${location.host}`);
  ws.addEventListener("open", () => {
    if (wsStatus) wsStatus.textContent = "WS 연결됨";
  });
  ws.addEventListener("close", () => {
    if (wsStatus) wsStatus.textContent = "WS 연결 끊김";
    clearPublishQueueOnDisconnect();
    setTimeout(() => connectWS(onError), 1500);
  });
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "admin:ok") {
      flushPublishQueue({ ok: true });
      return;
    }
    if (data.type === "admin:error") {
      const message = data.payload?.message || "알 수 없는 오류";
      flushPublishQueue({ ok: false, message });
      if (typeof onError === "function") {
        onError(message);
      }
    }
  });
}

export function wsPublish(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert("웹소켓 연결이 필요합니다.");
    return Promise.resolve({ ok: false, message: "웹소켓 연결이 필요합니다." });
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const index = publishQueue.findIndex((item) => item.resolve === resolve);
      if (index >= 0) publishQueue.splice(index, 1);
      resolve({ ok: false, message: "서버 응답이 지연되고 있습니다." });
    }, 2500);
    publishQueue.push({ resolve, timer });
    ws.send(JSON.stringify({ type: "admin:publish", payload }));
  });
}

export async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
