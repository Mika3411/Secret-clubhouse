const postgresProtocols = new Set(["postgres:", "postgresql:"]);
const safeTlsMode = "verify-full";
const connectionStringTlsKeys = ["ssl", "sslcert", "sslkey", "sslrootcert"];

function configurationError(message) {
  const error = new Error(message);
  error.code = "DATABASE_CONFIGURATION_ERROR";
  return error;
}

function parseDatabaseUrl(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw configurationError("DATABASE_URL doit être une URL PostgreSQL valide.");
  }
  if (!postgresProtocols.has(url.protocol) || !url.hostname) {
    throw configurationError("DATABASE_URL doit être une URL PostgreSQL valide.");
  }
  return url;
}

function ensureConnectionStringDoesNotOverrideTls(url, { allowVerifyFull = false } = {}) {
  for (const key of connectionStringTlsKeys) {
    if (url.searchParams.has(key)) {
      throw configurationError(
        `DATABASE_URL ne doit pas contenir ${key}; configurez TLS avec DATABASE_TRANSPORT.`,
      );
    }
  }

  const sslModes = url.searchParams.getAll("sslmode");
  if (!sslModes.length) return;
  if (!allowVerifyFull
    || sslModes.length !== 1
    || sslModes[0].trim().toLowerCase() !== safeTlsMode) {
    throw configurationError(
      "DATABASE_URL contient un sslmode non autorisé; seul verify-full est accepté avec DATABASE_TRANSPORT=tls.",
    );
  }

  // node-postgres replaces an explicit ssl object when sslmode is left in the
  // connection string. Remove the redundant safe mode so the configured CA
  // and rejectUnauthorized policy cannot be bypassed.
  url.searchParams.delete("sslmode");
}

function decodeBase64Strict(value) {
  const normalized = String(value).replace(/\s/g, "");
  if (!normalized
    || normalized.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw configurationError("DATABASE_TLS_CA_BASE64 n’est pas un contenu base64 valide.");
  }
  const decoded = Buffer.from(normalized, "base64");
  if (!decoded.length
    || decoded.toString("base64").replace(/=+$/u, "") !== normalized.replace(/=+$/u, "")) {
    throw configurationError("DATABASE_TLS_CA_BASE64 n’est pas un contenu base64 valide.");
  }
  return decoded.toString("utf8");
}

function readCertificateAuthority(env) {
  const raw = String(env.DATABASE_TLS_CA ?? env.DATABASE_SSL_CA ?? "").trim();
  const base64 = String(
    env.DATABASE_TLS_CA_BASE64 ?? env.DATABASE_SSL_CA_BASE64 ?? "",
  ).trim();
  if (raw && base64) {
    throw configurationError(
      "Configurez une seule source de CA PostgreSQL, brute ou base64.",
    );
  }
  if (!raw && !base64) return null;

  const certificate = (raw || decodeBase64Strict(base64)).replace(/\\n/g, "\n").trim();
  if (!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/u.test(certificate)) {
    throw configurationError("La CA PostgreSQL doit être un certificat PEM valide.");
  }
  return `${certificate}\n`;
}

function isRenderPrivateHostname(hostname) {
  return /^dpg-[a-z0-9-]+$/iu.test(hostname);
}

function isLocalHostname(hostname) {
  const normalized = String(hostname).toLowerCase();
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "127.0.0.1"
    || normalized === "[::1]";
}

export function createDatabasePoolConfig(env = process.env) {
  const connectionString = String(env.DATABASE_URL ?? "").trim();
  const transport = String(env.DATABASE_TRANSPORT ?? "").trim().toLowerCase();
  const production = env.NODE_ENV === "production";

  if (!transport) {
    if (production) {
      if (connectionString && env.RENDER === "true") {
        const url = parseDatabaseUrl(connectionString);
        ensureConnectionStringDoesNotOverrideTls(url);
        if (isRenderPrivateHostname(url.hostname)) {
          return {
            connectionString,
            ssl: false,
          };
        }
      }
      throw configurationError(
        "DATABASE_TRANSPORT est requis en production hors URL PostgreSQL privée Render vérifiée.",
      );
    }
    if (connectionString) {
      const url = parseDatabaseUrl(connectionString);
      ensureConnectionStringDoesNotOverrideTls(url);
      if (!isLocalHostname(url.hostname)) {
        throw configurationError(
          "Une base PostgreSQL non locale exige DATABASE_TRANSPORT, même hors production.",
        );
      }
    }
    return {
      ...(connectionString ? { connectionString } : {}),
      ssl: false,
    };
  }

  if (!connectionString) {
    throw configurationError("DATABASE_URL est requise avec DATABASE_TRANSPORT.");
  }

  const url = parseDatabaseUrl(connectionString);

  if (transport === "render-private") {
    ensureConnectionStringDoesNotOverrideTls(url);
    if (!isRenderPrivateHostname(url.hostname)) {
      throw configurationError(
        "DATABASE_TRANSPORT=render-private exige une URL PostgreSQL interne Render.",
      );
    }
    return {
      connectionString,
      ssl: false,
    };
  }

  if (transport === "tls") {
    ensureConnectionStringDoesNotOverrideTls(url, { allowVerifyFull: true });
    const ca = readCertificateAuthority(env);
    return {
      connectionString: url.toString(),
      ssl: {
        rejectUnauthorized: true,
        ...(ca ? { ca } : {}),
      },
    };
  }

  throw configurationError(
    "DATABASE_TRANSPORT doit valoir render-private ou tls.",
  );
}
