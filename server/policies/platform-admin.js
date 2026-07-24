const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function configuredPlatformAdminEmails(env = process.env) {
  return new Set(
    String(env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => emailPattern.test(email)),
  );
}

export async function authorizePlatformAdministrator(executor, accountId, options = {}) {
  if (!executor || typeof executor.query !== "function") {
    throw new TypeError("Un exécuteur PostgreSQL est requis.");
  }
  const configuredEmails = options.configuredEmails
    ?? configuredPlatformAdminEmails(options.env);
  const result = await executor.query(
    `select
       account.id,
       account.email,
       account.role,
       administrator.account_id is not null as already_authorized
     from accounts account
     left join platform_administrators administrator
       on administrator.account_id=account.id
     where account.id=$1
     limit 1`,
    [accountId],
  );
  const account = result.rows?.[0];
  if (!account || account.role !== "parent") return null;
  if (account.already_authorized) {
    return { accountId: account.id, email: account.email, grantSource: "database" };
  }

  const normalizedEmail = String(account.email ?? "").trim().toLowerCase();
  if (!configuredEmails.has(normalizedEmail)) return null;
  await executor.query(
    `insert into platform_administrators(account_id,grant_source)
     values($1,'environment')
     on conflict(account_id) do nothing`,
    [account.id],
  );
  return { accountId: account.id, email: normalizedEmail, grantSource: "environment" };
}
