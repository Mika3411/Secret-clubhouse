import assert from "node:assert/strict";
import test from "node:test";
import { createDatabasePoolConfig } from "./database-config.js";

const renderPrivateUrl = "postgresql://clubhouse:secret@dpg-c123abc-a/secret_clubhouse";
const externalUrl = "postgresql://clubhouse:secret@dpg-c123abc-a.frankfurt-postgres.render.com/secret_clubhouse";
const certificate = [
  "-----BEGIN CERTIFICATE-----",
  "VEVTVF9EQVRBQkFTRV9DQQ==",
  "-----END CERTIFICATE-----",
].join("\n");

test("désactive TLS uniquement pour une URL PostgreSQL interne Render déclarée ou détectée sur Render", () => {
  assert.deepEqual(
    createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_TRANSPORT: "render-private",
      DATABASE_URL: renderPrivateUrl,
    }),
    {
      connectionString: renderPrivateUrl,
      ssl: false,
    },
  );

  assert.deepEqual(
    createDatabasePoolConfig({
      NODE_ENV: "production",
      RENDER: "true",
      DATABASE_URL: renderPrivateUrl,
    }),
    {
      connectionString: renderPrivateUrl,
      ssl: false,
    },
  );

  assert.throws(
    () => createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_TRANSPORT: "render-private",
      DATABASE_URL: externalUrl,
    }),
    /interne Render/u,
  );
});

test("active une vérification TLS stricte avec une CA brute ou base64 optionnelle", () => {
  const withoutCa = createDatabasePoolConfig({
    NODE_ENV: "production",
    DATABASE_TRANSPORT: "tls",
    DATABASE_URL: externalUrl,
  });
  assert.deepEqual(withoutCa.ssl, { rejectUnauthorized: true });

  const withRawCa = createDatabasePoolConfig({
    NODE_ENV: "production",
    DATABASE_TRANSPORT: "tls",
    DATABASE_URL: externalUrl,
    DATABASE_TLS_CA: certificate,
  });
  assert.deepEqual(withRawCa.ssl, {
    rejectUnauthorized: true,
    ca: `${certificate}\n`,
  });

  const withBase64Ca = createDatabasePoolConfig({
    NODE_ENV: "production",
    DATABASE_TRANSPORT: "tls",
    DATABASE_URL: externalUrl,
    DATABASE_TLS_CA_BASE64: Buffer.from(certificate).toString("base64"),
  });
  assert.deepEqual(withBase64Ca.ssl, withRawCa.ssl);
});

test("retire sslmode=verify-full afin que node-postgres conserve la politique TLS explicite", () => {
  const config = createDatabasePoolConfig({
    NODE_ENV: "production",
    DATABASE_TRANSPORT: "tls",
    DATABASE_URL: `${externalUrl}?application_name=clubhouse&sslmode=verify-full`,
  });
  const configuredUrl = new URL(config.connectionString);
  assert.equal(configuredUrl.searchParams.get("application_name"), "clubhouse");
  assert.equal(configuredUrl.searchParams.has("sslmode"), false);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test("refuse tous les sslmode qui ne vérifient pas complètement le certificat", () => {
  for (const sslmode of ["disable", "allow", "prefer", "require", "verify-ca", "no-verify"]) {
    assert.throws(
      () => createDatabasePoolConfig({
        NODE_ENV: "production",
        DATABASE_TRANSPORT: "tls",
        DATABASE_URL: `${externalUrl}?sslmode=${sslmode}`,
      }),
      /sslmode non autorisé/u,
      sslmode,
    );
  }
});

test("refuse les options de l’URL qui pourraient remplacer l’objet ssl", () => {
  for (const option of ["ssl=true", "sslcert=client.pem", "sslkey=client.key", "sslrootcert=root.pem"]) {
    assert.throws(
      () => createDatabasePoolConfig({
        NODE_ENV: "production",
        DATABASE_TRANSPORT: "tls",
        DATABASE_URL: `${externalUrl}?${option}`,
      }),
      /ne doit pas contenir/u,
      option,
    );
  }
});

test("refuse une CA ambiguë ou mal formée", () => {
  assert.throws(
    () => createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_TRANSPORT: "tls",
      DATABASE_URL: externalUrl,
      DATABASE_TLS_CA: certificate,
      DATABASE_TLS_CA_BASE64: Buffer.from(certificate).toString("base64"),
    }),
    /une seule source/u,
  );
  assert.throws(
    () => createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_TRANSPORT: "tls",
      DATABASE_URL: externalUrl,
      DATABASE_TLS_CA_BASE64: "pas-du-base64",
    }),
    /base64 valide/u,
  );
  assert.throws(
    () => createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_TRANSPORT: "tls",
      DATABASE_URL: externalUrl,
      DATABASE_TLS_CA: "certificat sans enveloppe PEM",
    }),
    /certificat PEM/u,
  );
});

test("exige un transport explicite en production mais conserve les tests locaux sans TLS", () => {
  assert.throws(
    () => createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: renderPrivateUrl,
    }),
    /DATABASE_TRANSPORT est requis/u,
  );

  assert.throws(
    () => createDatabasePoolConfig({
      NODE_ENV: "production",
      RENDER: "true",
      DATABASE_URL: externalUrl,
    }),
    /DATABASE_TRANSPORT est requis/u,
  );

  assert.throws(
    () => createDatabasePoolConfig({
      NODE_ENV: "production",
      RENDER: "true",
      DATABASE_URL: `${renderPrivateUrl}?sslmode=disable`,
    }),
    /sslmode non autorisé/u,
  );

  assert.deepEqual(
    createDatabasePoolConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://localhost/secret_clubhouse_test",
    }),
    {
      connectionString: "postgresql://localhost/secret_clubhouse_test",
      ssl: false,
    },
  );

  assert.throws(
    () => createDatabasePoolConfig({
      NODE_ENV: "test",
      DATABASE_URL: externalUrl,
    }),
    /non locale exige DATABASE_TRANSPORT/u,
  );
});
