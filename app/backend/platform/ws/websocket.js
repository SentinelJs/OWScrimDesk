const WebSocket = require("ws");
const { HttpError, parseAdminPublishPayload } = require("../../shared/contracts/schemas");

function createMessageSender(wss) {
  function send(client, type, payload) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, payload }));
    }
  }

  function broadcast(type, payload) {
    wss.clients.forEach((client) => send(client, type, payload));
  }

  return { send, broadcast };
}

function registerWebSocket(server, deps) {
  const {
    overlayService,
    adminPublishService
  } = deps;

  const wss = new WebSocket.Server({ server });
  const { send, broadcast } = createMessageSender(wss);

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "overlay:hello") {
          const snapshot = overlayService.buildOverlaySnapshot();
          send(ws, "overlay:update", snapshot);
          return;
        }

        if (data.type === "admin:publish") {
          const payload = parseAdminPublishPayload(data.payload);
          const result = adminPublishService.publish(payload);
          broadcast("overlay:update", result.snapshot);
          send(ws, "admin:ok", { ok: true });
          return;
        }
      } catch (error) {
        if (error instanceof HttpError) {
          send(ws, "admin:error", { message: error.message });
          return;
        }
        send(ws, "admin:error", { message: "요청 처리 중 오류가 발생했습니다." });
      }
    });
  });

  return { wss, send, broadcast };
}

module.exports = {
  registerWebSocket,
  createMessageSender
};
