import crypto from "node:crypto";

export const loginRateLimits = Object.freeze({
  windowSeconds: 15 * 60,
  blockSeconds: 15 * 60,
  identityFailures: 5,
  ipFailures: 25,
});

export const registrationRateLimits = Object.freeze({
  windowSeconds: 15 * 60,
  blockSeconds: 15 * 60,
  ipAttempts: 10,
});

const hashScope = (secret, scope, value) => crypto
  .createHmac("sha256", secret)
  .update(`login:${scope}:${value}`)
  .digest("hex");

const normalizeClientAddress = (clientAddress) => (
  String(clientAddress ?? "unknown").trim().slice(0, 128) || "unknown"
);

export function normalizeLoginIdentity({ email, username } = {}) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase().slice(0, 320);
  if (normalizedEmail) return `parent:${normalizedEmail}`;
  return `child:${String(username ?? "").trim().toLowerCase().slice(0, 64)}`;
}

export function createLoginScopeKeys({ email, username, clientAddress, secret }) {
  const identity = normalizeLoginIdentity({ email, username });
  const normalizedAddress = normalizeClientAddress(clientAddress);
  return {
    identityHash: hashScope(secret, "identity", identity),
    ipHash: hashScope(secret, "ip", normalizedAddress),
  };
}

export function createRegistrationIpScopeKey({ clientAddress, secret }) {
  return {
    ipHash: hashScope(secret, "registration_ip", normalizeClientAddress(clientAddress)),
  };
}

export async function getActiveLoginBlock(executor, { identityHash, ipHash }) {
  const result = await executor.query(
    `select blocked_until
     from login_rate_limits
     where (
       (scope='identity' and key_hash=$1)
       or (scope='ip' and key_hash=$2)
     )
       and blocked_until > now()
     order by blocked_until desc
     limit 1`,
    [identityHash, ipHash],
  );
  return result.rows[0]?.blocked_until ?? null;
}

async function recordScopeFailure(executor, scope, keyHash, maxFailures) {
  const { windowSeconds, blockSeconds } = loginRateLimits;
  const result = await executor.query(
    `insert into login_rate_limits(scope,key_hash,failure_count,window_started_at,blocked_until,updated_at)
     values($1,$2,1,now(),null,now())
     on conflict(scope,key_hash) do update set
       failure_count=case
         when login_rate_limits.window_started_at <= now() - make_interval(secs => $3::int) then 1
         else login_rate_limits.failure_count + 1
       end,
       window_started_at=case
         when login_rate_limits.window_started_at <= now() - make_interval(secs => $3::int) then now()
         else login_rate_limits.window_started_at
       end,
       blocked_until=case
         when login_rate_limits.blocked_until > now() then login_rate_limits.blocked_until
         when (
           case
             when login_rate_limits.window_started_at <= now() - make_interval(secs => $3::int) then 1
             else login_rate_limits.failure_count + 1
           end
         ) >= $4::int then now() + make_interval(secs => $5::int)
         else null
       end,
       updated_at=now()
     returning blocked_until`,
    [scope, keyHash, windowSeconds, maxFailures, blockSeconds],
  );
  return result.rows[0]?.blocked_until ?? null;
}

export async function recordLoginFailure(executor, { identityHash, ipHash }) {
  const blocks = await Promise.all([
    recordScopeFailure(executor, "identity", identityHash, loginRateLimits.identityFailures),
    recordScopeFailure(executor, "ip", ipHash, loginRateLimits.ipFailures),
  ]);
  return blocks
    .filter(Boolean)
    .sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0] ?? null;
}

export async function consumeRegistrationIpAttempt(executor, { ipHash }) {
  const { windowSeconds, blockSeconds, ipAttempts } = registrationRateLimits;
  const result = await executor.query(
    `insert into login_rate_limits(scope,key_hash,failure_count,window_started_at,blocked_until,updated_at)
     values('registration_ip',$1,1,now(),null,now())
     on conflict(scope,key_hash) do update set
       failure_count=case
         when login_rate_limits.blocked_until > now() then login_rate_limits.failure_count
         when login_rate_limits.window_started_at <= now() - make_interval(secs => $2::int) then 1
         else login_rate_limits.failure_count + 1
       end,
       window_started_at=case
         when login_rate_limits.blocked_until > now() then login_rate_limits.window_started_at
         when login_rate_limits.window_started_at <= now() - make_interval(secs => $2::int) then now()
         else login_rate_limits.window_started_at
       end,
       blocked_until=case
         when login_rate_limits.blocked_until > now() then login_rate_limits.blocked_until
         when (
           case
             when login_rate_limits.window_started_at <= now() - make_interval(secs => $2::int) then 1
             else login_rate_limits.failure_count + 1
           end
         ) > $3::int then now() + make_interval(secs => $4::int)
         else null
       end,
       updated_at=now()
     returning blocked_until`,
    [ipHash, windowSeconds, ipAttempts, blockSeconds],
  );
  return result.rows[0]?.blocked_until ?? null;
}

export async function clearSuccessfulLogin(executor, { identityHash }) {
  await executor.query(
    "delete from login_rate_limits where scope='identity' and key_hash=$1",
    [identityHash],
  );
}

export async function pruneLoginRateLimits(executor) {
  await executor.query(
    "delete from login_rate_limits where updated_at < now() - interval '48 hours'",
  );
}

export function loginRetryAfterSeconds(blockedUntil, now = Date.now()) {
  return Math.max(1, Math.ceil((new Date(blockedUntil).getTime() - now) / 1000));
}
