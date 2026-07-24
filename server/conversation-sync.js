const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const syncCursorPattern = /^\d{1,20}$/;

export const defaultMessagePageSize = 50;
export const maximumMessagePageSize = 100;
export const conversationSyncPageSize = 200;

export function normalizeMessagePageLimit(value) {
  if (value === undefined || value === null || value === "") return defaultMessagePageSize;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, maximumMessagePageSize);
}

export function encodeMessagePageCursor({ createdAt, id }) {
  const timestamp = new Date(createdAt);
  if (Number.isNaN(timestamp.getTime()) || !uuidPattern.test(String(id ?? ""))) return "";
  return Buffer.from(JSON.stringify([timestamp.toISOString(), String(id)]), "utf8").toString("base64url");
}

export function decodeMessagePageCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2) return false;
    const [createdAt, id] = parsed;
    const timestamp = new Date(createdAt);
    if (Number.isNaN(timestamp.getTime()) || !uuidPattern.test(String(id ?? ""))) return false;
    return { createdAt: timestamp.toISOString(), id: String(id) };
  } catch {
    return false;
  }
}

export function normalizeConversationSyncCursor(value) {
  const cursor = String(value ?? "0").trim();
  if (!syncCursorPattern.test(cursor)) return null;
  try {
    const parsed = BigInt(cursor);
    if (parsed < 0n || parsed > 9_223_372_036_854_775_807n) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeConversationMessageIds(value, maximum = conversationSyncPageSize) {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const normalized = [...new Set(value.map((id) => String(id ?? "").trim()))];
  if (normalized.some((id) => !uuidPattern.test(id))) return null;
  return normalized;
}
