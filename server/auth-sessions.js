import crypto from "node:crypto";

export const PRODUCTION_SESSION_COOKIE = "__Host-sc_session";
export const DEVELOPMENT_SESSION_COOKIE = "sc_session";
export const DEFAULT_SESSION_TTL_SECONDS = 12 * 60 * 60;
export const MIN_SESSION_TTL_SECONDS = 5 * 60;
export const MAX_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const AUTH_SESSIONS_SCHEMA_SQL = `
  create table if not exists auth_sessions (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references accounts(id) on delete cascade,
    token_hash text not null unique check (char_length(token_hash)=64),
    client_type text not null check (client_type in ('web','native')),
    device_id text,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    revoked_reason text,
    check (expires_at>created_at)
  );
  create index if not exists auth_sessions_account_active_idx
    on auth_sessions(account_id,expires_at desc)
    where revoked_at is null;
  create index if not exists auth_sessions_expiry_idx
    on auth_sessions(expires_at)
    where revoked_at is null;
`;

const SESSION_TOKEN_BYTES = 32;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_CLIENT_TYPES = new Set(["web", "native"]);
const TOKEN_COLLISION_RETRIES = 3;

const insertSessionSql = `
  insert into auth_sessions(account_id,token_hash,client_type,device_id,expires_at)
  values($1,$2,$3,$4,$5)
  returning id,account_id,client_type,device_id,created_at,expires_at,revoked_at
`;

const findSessionSql = `
  select
    session.id,
    session.account_id,
    session.client_type,
    session.device_id,
    session.created_at,
    session.expires_at,
    session.revoked_at,
    account.role
  from auth_sessions session
  join accounts account on account.id=session.account_id
  where session.token_hash=$1
    and session.revoked_at is null
    and session.expires_at>$2
  limit 1
`;

const revokeSessionSql = `
  update auth_sessions
  set revoked_at=coalesce(revoked_at,$2),
      revoked_reason=coalesce(revoked_reason,$3)
  where token_hash=$1
  returning id,account_id,client_type,device_id,created_at,expires_at,revoked_at
`;

/**
 * Invalid configuration falls back to the default, while valid values are
 * clamped so an environment mistake cannot create near-eternal sessions.
 */
export function normalizeSessionTtlSeconds(value, fallback = DEFAULT_SESSION_TTL_SECONDS) {
  const fallbackNumber = Number(fallback);
  const safeFallback = Number.isFinite(fallbackNumber) && fallbackNumber > 0
    ? Math.trunc(fallbackNumber)
    : DEFAULT_SESSION_TTL_SECONDS;
  const parsed = value === undefined || value === null || value === ""
    ? safeFallback
    : Number(value);
  const candidate = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : safeFallback;
  return Math.min(MAX_SESSION_TTL_SECONDS, Math.max(MIN_SESSION_TTL_SECONDS, candidate));
}

export function generateSessionToken(randomBytes = crypto.randomBytes) {
  const bytes = randomBytes(SESSION_TOKEN_BYTES);
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new TypeError("Le générateur de session doit retourner 32 octets.");
  }
  if (bytes.byteLength !== SESSION_TOKEN_BYTES) {
    throw new TypeError("Un jeton de session exige exactement 256 bits d’aléa.");
  }
  return Buffer.from(bytes).toString("base64url");
}

export function isSessionToken(value) {
  return typeof value === "string" && SESSION_TOKEN_PATTERN.test(value);
}

export function hashSessionToken(token) {
  if (!isSessionToken(token)) throw new TypeError("Jeton de session invalide.");
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export async function initializeAuthSessionStore(executor) {
  assertExecutor(executor);
  await executor.query(AUTH_SESSIONS_SCHEMA_SQL);
}

export function sessionCookieName({ production = process.env.NODE_ENV === "production" } = {}) {
  return production ? PRODUCTION_SESSION_COOKIE : DEVELOPMENT_SESSION_COOKIE;
}

export function serializeSessionCookie(token, options = {}) {
  if (!isSessionToken(token)) throw new TypeError("Jeton de session invalide.");
  const production = options.production ?? process.env.NODE_ENV === "production";
  const ttlSeconds = normalizeSessionTtlSeconds(
    options.ttlSeconds ?? process.env.AUTH_SESSION_TTL_SECONDS,
  );
  const attributes = [
    `${sessionCookieName({ production })}=${token}`,
    `Max-Age=${ttlSeconds}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (production) attributes.push("Secure");
  return attributes.join("; ");
}

export function serializeClearedSessionCookie(options = {}) {
  const production = options.production ?? process.env.NODE_ENV === "production";
  const attributes = [
    `${sessionCookieName({ production })}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (production) attributes.push("Secure");
  return attributes.join("; ");
}

export function setSessionCookie(response, token, options = {}) {
  appendSetCookie(response, serializeSessionCookie(token, options));
}

export function clearSessionCookie(response, options = {}) {
  appendSetCookie(response, serializeClearedSessionCookie(options));
}

export function extractBearerSessionToken(source) {
  const authorization = readHeader(source, "authorization");
  if (!authorization) return null;
  const match = authorization.match(/^Bearer[ \t]+([A-Za-z0-9_-]{43})[ \t]*$/i);
  return match ? match[1] : null;
}

export function extractCookieSessionToken(source, options = {}) {
  const cookieHeader = readHeader(source, "cookie");
  if (!cookieHeader) return null;
  const expectedName = sessionCookieName({
    production: options.production ?? process.env.NODE_ENV === "production",
  });
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (name === expectedName && isSessionToken(value)) return value;
  }
  return null;
}

export function extractSessionCredential(source, options = {}) {
  const cookieToken = extractCookieSessionToken(source, options);
  const bearerToken = options.allowBearer === false ? null : extractBearerSessionToken(source);
  const expectedClientType = normalizeExpectedClientType(options.expectedClientType);

  // Une requête qui présente deux identités possibles est toujours refusée.
  if (cookieToken && bearerToken) return null;
  if (expectedClientType === "web") {
    return cookieToken ? { token: cookieToken, transport: "cookie" } : null;
  }
  if (expectedClientType === "native") {
    return bearerToken ? { token: bearerToken, transport: "bearer" } : null;
  }
  if (cookieToken) return { token: cookieToken, transport: "cookie" };
  return bearerToken ? { token: bearerToken, transport: "bearer" } : null;
}

export async function createAuthSession(executor, options = {}) {
  assertExecutor(executor);
  const accountId = String(options.accountId ?? "").trim();
  if (!accountId) throw new TypeError("accountId est requis.");
  const clientType = String(options.clientType ?? "web").trim().toLowerCase();
  if (!SESSION_CLIENT_TYPES.has(clientType)) {
    throw new TypeError("clientType doit être web ou native.");
  }
  const deviceId = normalizeDeviceId(options.deviceId);
  const now = normalizeDate(options.now ?? new Date(), "now");
  const ttlSeconds = normalizeSessionTtlSeconds(
    options.ttlSeconds ?? process.env.AUTH_SESSION_TTL_SECONDS,
  );
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const randomBytes = options.randomBytes ?? crypto.randomBytes;

  for (let attempt = 0; attempt < TOKEN_COLLISION_RETRIES; attempt += 1) {
    const token = generateSessionToken(randomBytes);
    const tokenHash = hashSessionToken(token);
    try {
      const result = await executor.query(insertSessionSql, [
        accountId,
        tokenHash,
        clientType,
        deviceId,
        expiresAt,
      ]);
      const row = result.rows?.[0] ?? {
        account_id: accountId,
        client_type: clientType,
        device_id: deviceId,
        created_at: now,
        expires_at: expiresAt,
        revoked_at: null,
      };
      return {
        token,
        session: normalizeSessionRow(row),
        ttlSeconds,
      };
    } catch (error) {
      if (!isTokenHashCollision(error) || attempt === TOKEN_COLLISION_RETRIES - 1) throw error;
    }
  }
  throw new Error("Impossible de créer la session.");
}

export async function issueWebSession(executor, response, options = {}) {
  const created = await createAuthSession(executor, { ...options, clientType: "web" });
  setSessionCookie(response, created.token, {
    production: options.production,
    ttlSeconds: created.ttlSeconds,
  });
  return created.session;
}

export async function issueNativeSession(executor, options = {}) {
  return createAuthSession(executor, { ...options, clientType: "native" });
}

export async function findAuthSession(executor, token, options = {}) {
  assertExecutor(executor);
  if (!isSessionToken(token)) return null;
  const now = normalizeDate(options.now ?? new Date(), "now");
  const result = await executor.query(findSessionSql, [hashSessionToken(token), now]);
  return result.rows?.[0] ? normalizeSessionRow(result.rows[0]) : null;
}

export async function authenticateSessionRequest(executor, source, options = {}) {
  const credential = extractSessionCredential(source, options);
  if (!credential) return null;
  const session = await findAuthSession(executor, credential.token, options);
  if (!session) return null;
  const transportClientType = credential.transport === "cookie" ? "web" : "native";
  const expectedClientType = normalizeExpectedClientType(options.expectedClientType);
  if (session.clientType !== transportClientType
    || (expectedClientType && session.clientType !== expectedClientType)) {
    return null;
  }
  return { ...session, transport: credential.transport };
}

export async function revokeAuthSession(executor, token, options = {}) {
  assertExecutor(executor);
  if (!isSessionToken(token)) return null;
  const now = normalizeDate(options.now ?? new Date(), "now");
  const reason = normalizeRevocationReason(options.reason);
  const result = await executor.query(revokeSessionSql, [
    hashSessionToken(token),
    now,
    reason,
  ]);
  return result.rows?.[0] ? normalizeSessionRow(result.rows[0]) : null;
}

/**
 * Idempotent logout helper for an Express-like request/response pair.
 * The cookie is expired even if the presented credential is absent or stale.
 */
export async function logoutAuthSession(executor, source, response, options = {}) {
  const credential = extractSessionCredential(source, options);
  const revoked = credential
    ? await revokeAuthSession(executor, credential.token, {
        now: options.now,
        reason: options.reason ?? "logout",
      })
    : null;
  clearSessionCookie(response, options);
  return { revoked: Boolean(revoked), session: revoked };
}

function normalizeSessionRow(row) {
  return {
    id: row.id ?? null,
    accountId: row.account_id,
    role: row.role ?? null,
    clientType: row.client_type,
    deviceId: row.device_id ?? null,
    createdAt: row.created_at ?? null,
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
  };
}

function normalizeDeviceId(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 160) throw new TypeError("deviceId invalide.");
  return normalized;
}

function normalizeExpectedClientType(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (!SESSION_CLIENT_TYPES.has(normalized)) {
    throw new TypeError("expectedClientType doit être web ou native.");
  }
  return normalized;
}

function normalizeRevocationReason(value) {
  const normalized = String(value ?? "logout").trim();
  return normalized ? normalized.slice(0, 80) : "logout";
}

function normalizeDate(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${label} doit être une date valide.`);
  return date;
}

function assertExecutor(executor) {
  if (!executor || typeof executor.query !== "function") {
    throw new TypeError("Un exécuteur PostgreSQL est requis.");
  }
}

function isTokenHashCollision(error) {
  return error?.code === "23505"
    && String(error.constraint ?? "").includes("token_hash");
}

function readHeader(source, name) {
  if (!source) return "";
  if (typeof source.get === "function") {
    const value = source.get(name);
    if (value !== undefined && value !== null) return String(value).trim();
  }
  if (typeof source.getHeader === "function") {
    const value = source.getHeader(name);
    if (value !== undefined && value !== null) return String(value).trim();
  }
  const headers = source.headers ?? source;
  if (headers && typeof headers.get === "function") {
    const value = headers.get(name);
    if (value !== undefined && value !== null) return String(value).trim();
  }
  if (!headers || typeof headers !== "object") return "";
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const value = key ? headers[key] : undefined;
  return Array.isArray(value) ? value.join(", ") : String(value ?? "").trim();
}

function appendSetCookie(response, cookie) {
  if (!response) throw new TypeError("Une réponse HTTP est requise.");
  if (typeof response.append === "function") {
    response.append("Set-Cookie", cookie);
    return;
  }
  if (typeof response.setHeader !== "function") {
    throw new TypeError("La réponse HTTP ne permet pas de définir Set-Cookie.");
  }
  const existing = typeof response.getHeader === "function"
    ? response.getHeader("Set-Cookie")
    : undefined;
  if (!existing) {
    response.setHeader("Set-Cookie", cookie);
  } else if (Array.isArray(existing)) {
    response.setHeader("Set-Cookie", [...existing, cookie]);
  } else {
    response.setHeader("Set-Cookie", [String(existing), cookie]);
  }
}
