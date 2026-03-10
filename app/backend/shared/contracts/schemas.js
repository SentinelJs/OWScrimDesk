// @ts-check

/**
 * @typedef {import("./types").AdminPublishPayload} AdminPublishPayload
 */

class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {string} message
 * @returns {Record<string, unknown>}
 */
function requireRecord(value, message) {
  if (!isRecord(value)) {
    throw new HttpError(400, message);
  }
  return value;
}

/**
 * @param {unknown} value
 * @returns {AdminPublishPayload}
 */
function parseAdminPublishPayload(value) {
  const payload = requireRecord(value, "admin publish payload가 필요합니다.");
  if (payload.gameIndex != null && !Number.isFinite(Number(payload.gameIndex))) {
    throw new HttpError(400, "gameIndex 값이 올바르지 않습니다.");
  }
  return /** @type {AdminPublishPayload} */ ({
    ...payload,
    gameIndex: payload.gameIndex == null ? undefined : Number(payload.gameIndex)
  });
}

/**
 * @param {unknown} body
 */
function parseHistoryBody(body) {
  const data = requireRecord(body, "요청 본문이 필요합니다.");
  if (!Array.isArray(data.history)) {
    throw new HttpError(400, "history 배열이 필요합니다.");
  }
  return { history: data.history };
}

/**
 * @param {unknown} body
 */
function parseTeamsBody(body) {
  const data = requireRecord(body, "요청 본문이 필요합니다.");
  if (!isRecord(data.teams)) {
    throw new HttpError(400, "teams 데이터가 필요합니다.");
  }
  return { teams: data.teams };
}

/**
 * @param {unknown} body
 */
function parseSettingsBody(body) {
  const data = requireRecord(body, "요청 본문이 필요합니다.");
  if (!isRecord(data.settings)) {
    throw new HttpError(400, "settings 데이터가 필요합니다.");
  }
  return { settings: data.settings };
}

/**
 * @param {unknown} body
 */
function parseStateBody(body) {
  const data = requireRecord(body, "요청 본문이 필요합니다.");
  if (!isRecord(data.state)) {
    throw new HttpError(400, "state 데이터가 필요합니다.");
  }
  return { state: data.state };
}

/**
 * @param {unknown} body
 */
function parseDominantColorBody(body) {
  const data = requireRecord(body, "요청 본문이 필요합니다.");
  if (typeof data.logo !== "string" || !data.logo) {
    throw new HttpError(400, "logo 데이터가 필요합니다.");
  }
  return { logo: data.logo };
}

/**
 * @param {unknown} videoId
 */
function parseVideoId(videoId) {
  if (typeof videoId !== "string" || !videoId.trim()) {
    throw new HttpError(400, "videoId 파라미터가 필요합니다.");
  }
  return videoId.trim();
}

module.exports = {
  HttpError,
  parseAdminPublishPayload,
  parseHistoryBody,
  parseTeamsBody,
  parseSettingsBody,
  parseStateBody,
  parseDominantColorBody,
  parseVideoId
};
