import crypto from "node:crypto";

export const PRODUCTION_SESSION_COOKIE = "__Host-sc_session";
export const DEVELOPMENT_SESSION_COOKIE = "sc_session";
export const DEFAULT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const DEFAULT_SESSION_RENEWAL_INTERVAL_SECONDS = 24 * 60 * 60;
export const DEFAULT_SESSION_ACTIVITY_INTERVAL_SECONDS = 15 * 60;
export const MIN_SESSION_TTL_SECONDS = 5 * 60;
export const MAX_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const AUTH_SESSIONS_SCHEMA_SQL = `
  create table if not exists auth_sessions (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references accounts(id) on delete cascade,
    token_hash text not null unique check (char_length(token_hash)=64),
    client_type text not null check (client_type in ('web','native')),
    device_id text,
    device_label text,
    created_at timestamptz not null default now(),
    last_used_at timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    revoked_reason text,
    check (expires_at>created_at)
  );
  alter table auth_sessions add column if not exists device_label text;
  alter table auth_sessions add column if not exists last_used_at timestamptz;
  update auth_sessions set last_used_at=created_at where last_used_at is null;
  alter table auth_sessions alter column last_used_at set default now();
  alter table auth_sessions alter column last_used_at set not null;
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
  insert into auth_sessions(account_id,token_hash,client_type,device_id,device_label,expires_at)
  values($1,$2,$3,$4,$5,$6)
  returning id,account_id,client_type,device_id,device_label,created_at,last_used_at,expires_at,revoked_at
`;

const findSessionSql = `
  select
    session.id,
    session.account_id,
    session.client_type,
    session.device_id,
    session.device_label,
    session.created_at,
    session.last_used_at,
    session.expires_at,
    session.revoked_at,
    account.role
  from auth_sessions session
  join accounts account on account.id=session.account_id
  where session.token_hash=$1
    and session.revoked_at is null
    and session.expires_at>$2
    and account.admin_suspended_at is null
  limit 1
`;

const revokeSessionSql = `
  update auth_sessions
  set revoked_at=coalesce(revoked_at,$2),
      revoked_reason=coalesce(revoked_reason,$3)
  where token_hash=$1
  returning id,account_id,client_type,device_id,device_label,created_at,last_used_at,expires_at,revoked_at
`;

const renewSessionSql = `
  update auth_sessions
  set expires_at=$3,
      last_used_at=$2
  where token_hash=$1
    and revoked_at is null
    and expires_at>$2
  returning id,account_id,client_type,device_id,device_label,created_at,last_used_at,expires_at,revoked_at
`;

const touchSessionSql = `
  update auth_sessions
  set last_used_at=$2
  where token_hash=$1
    and revoked_at is null
    and expires_at>$2
  returning id,account_id,client_type,device_id,device_label,created_at,last_used_at,expires_at,revoked_at
`;

const listAccountSessionsSql = `
  select id,account_id,client_type,device_label,created_at,last_used_at,expires_at
  from auth_sessions
  where account_id=$1
    and revoked_at is null
    and expires_at>$2
  order by (id=$3::uuid) desc,last_used_at desc,created_at desc
`;

const revokeAccountSessionByIdSql = `
  update auth_sessions
  set revoked_at=$4,
      revoked_reason=$5
  where id=$1
    and account_id=$2
    and id<>$3
    and revoked_at is null
    and expires_at>$4
`;

const revokeOtherAccountSessionsSql = `
  update auth_sessions
  set revoked_at=$3,
      revoked_reason=$4
  where account_id=$1
    and id<>$2
    and revoked_at is null
    and expires_at>$3
`;

const revokeAllAccountSessionsSql = `
  update auth_sessions
  set revoked_at=$2,
      revoked_reason=$3
  where account_id=$1
    and revoked_at is null
    and expires_at>$2
`;

/**
 * Invalid configuration falls back to the default, while valid values are
 * clamped so an environment mistake cannot create near-eternal abandoned sessions.
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
  const deviceLabel = normalizeDeviceLabel(options.deviceLabel, clientType);
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
        deviceLabel,
        expiresAt,
      ]);
      const row = result.rows?.[0] ?? {
        account_id: accountId,
        client_type: clientType,
        device_id: deviceId,
        device_label: deviceLabel,
        created_at: now,
        last_used_at: now,
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

export async function renewAuthSession(executor, token, options = {}) {
  assertExecutor(executor);
  if (!isSessionToken(token)) return null;
  const now = normalizeDate(options.now ?? new Date(), "now");
  const ttlSeconds = normalizeSessionTtlSeconds(
    options.ttlSeconds ?? process.env.AUTH_SESSION_TTL_SECONDS,
  );
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const result = await executor.query(renewSessionSql, [
    hashSessionToken(token),
    now,
    expiresAt,
  ]);
  return result.rows?.[0] ? normalizeSessionRow(result.rows[0]) : null;
}

export async function touchAuthSession(executor, token, options = {}) {
  assertExecutor(executor);
  if (!isSessionToken(token)) return null;
  const now = normalizeDate(options.now ?? new Date(), "now");
  const result = await executor.query(touchSessionSql, [
    hashSessionToken(token),
    now,
  ]);
  return result.rows?.[0] ? normalizeSessionRow(result.rows[0]) : null;
}

export async function listAccountAuthSessions(executor, options = {}) {
  assertExecutor(executor);
  const accountId = normalizeRequiredId(options.accountId, "accountId");
  const currentSessionId = normalizeRequiredId(options.currentSessionId, "currentSessionId");
  const now = normalizeDate(options.now ?? new Date(), "now");
  const result = await executor.query(listAccountSessionsSql, [
    accountId,
    now,
    currentSessionId,
  ]);
  return (result.rows ?? []).map((row) => {
    const session = normalizeSessionRow(row);
    return {
      id: session.id,
      clientType: session.clientType,
      deviceLabel: session.deviceLabel,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      current: session.id === currentSessionId,
    };
  });
}

export async function revokeAccountAuthSessionById(executor, options = {}) {
  assertExecutor(executor);
  const accountId = normalizeRequiredId(options.accountId, "accountId");
  const sessionId = normalizeRequiredId(options.sessionId, "sessionId");
  const currentSessionId = normalizeRequiredId(options.currentSessionId, "currentSessionId");
  if (sessionId === currentSessionId) return false;
  const now = normalizeDate(options.now ?? new Date(), "now");
  const reason = normalizeRevocationReason(options.reason ?? "parent_device_revocation");
  const result = await executor.query(revokeAccountSessionByIdSql, [
    sessionId,
    accountId,
    currentSessionId,
    now,
    reason,
  ]);
  return Number(result.rowCount ?? 0) > 0;
}

export async function revokeOtherAccountAuthSessions(executor, options = {}) {
  assertExecutor(executor);
  const accountId = normalizeRequiredId(options.accountId, "accountId");
  const currentSessionId = normalizeRequiredId(options.currentSessionId, "currentSessionId");
  const now = normalizeDate(options.now ?? new Date(), "now");
  const reason = normalizeRevocationReason(options.reason ?? "parent_other_devices_revocation");
  const result = await executor.query(revokeOtherAccountSessionsSql, [
    accountId,
    currentSessionId,
    now,
    reason,
  ]);
  return Number(result.rowCount ?? 0);
}

export async function revokeAllAccountAuthSessions(executor, options = {}) {
  assertExecutor(executor);
  const accountId = normalizeRequiredId(options.accountId, "accountId");
  const now = normalizeDate(options.now ?? new Date(), "now");
  const reason = normalizeRevocationReason(options.reason ?? "account_security_change");
  const result = await executor.query(revokeAllAccountSessionsSql, [
    accountId,
    now,
    reason,
  ]);
  return Number(result.rowCount ?? 0);
}

export async function authenticateSessionRequest(executor, source, options = {}) {
  const credential = extractSessionCredential(source, options);
  if (!credential) return null;
  let session = await findAuthSession(executor, credential.token, options);
  if (!session) return null;
  const transportClientType = credential.transport === "cookie" ? "web" : "native";
  const expectedClientType = normalizeExpectedClientType(options.expectedClientType);
  if (session.clientType !== transportClientType
    || (expectedClientType && session.clientType !== expectedClientType)) {
    return null;
  }
  const now = normalizeDate(options.now ?? new Date(), "now");
  const ttlSeconds = normalizeSessionTtlSeconds(
    options.ttlSeconds ?? process.env.AUTH_SESSION_TTL_SECONDS,
  );
  const renewalIntervalSeconds = normalizeRenewalIntervalSeconds(
    options.renewalIntervalSeconds,
    ttlSeconds,
  );
  if (options.renew !== false
    && shouldRenewSession(session, now, ttlSeconds, renewalIntervalSeconds)) {
    const renewedSession = await renewAuthSession(executor, credential.token, {
      now,
      ttlSeconds,
    });
    if (!renewedSession) return null;
    session = { ...session, ...renewedSession };
    if (credential.transport === "cookie" && options.response) {
      setSessionCookie(options.response, credential.token, {
        production: options.production,
        ttlSeconds,
      });
    }
  } else if (options.touch !== false && shouldTouchSession(session, now, options.activityIntervalSeconds)) {
    const touchedSession = await touchAuthSession(executor, credential.token, { now });
    if (!touchedSession) return null;
    session = { ...session, ...touchedSession };
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
    deviceLabel: normalizeDeviceLabel(row.device_label, row.client_type),
    createdAt: row.created_at ?? null,
    lastUsedAt: row.last_used_at ?? row.created_at ?? null,
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

function normalizeDeviceLabel(value, clientType = "web") {
  const fallback = clientType === "native" ? "Application mobile" : "Navigateur web";
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).replace(/\s+/gu, " ").trim();
  if (!normalized) return fallback;
  return normalized.slice(0, 80);
}

function normalizeRequiredId(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new TypeError(`${label} est requis.`);
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

function normalizeRenewalIntervalSeconds(value, ttlSeconds) {
  const maximum = Math.max(1, ttlSeconds - 1);
  const fallback = Math.min(DEFAULT_SESSION_RENEWAL_INTERVAL_SECONDS, maximum);
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(parsed)));
}

function shouldRenewSession(session, now, ttlSeconds, renewalIntervalSeconds) {
  const expiresAt = normalizeDate(session.expiresAt, "expiresAt");
  const remainingMilliseconds = expiresAt.getTime() - now.getTime();
  const renewalThresholdMilliseconds = (ttlSeconds - renewalIntervalSeconds) * 1000;
  return remainingMilliseconds <= renewalThresholdMilliseconds;
}

function shouldTouchSession(session, now, intervalSeconds = DEFAULT_SESSION_ACTIVITY_INTERVAL_SECONDS) {
  const lastUsedAt = normalizeDate(session.lastUsedAt ?? session.createdAt, "lastUsedAt");
  const parsedInterval = Number(intervalSeconds);
  const safeInterval = Number.isFinite(parsedInterval) && parsedInterval > 0
    ? Math.trunc(parsedInterval)
    : DEFAULT_SESSION_ACTIVITY_INTERVAL_SECONDS;
  return now.getTime() - lastUsedAt.getTime() >= safeInterval * 1000;
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
