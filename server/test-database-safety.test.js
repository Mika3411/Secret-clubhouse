import assert from "node:assert/strict";
import test from "node:test";
import {
  installIsolatedTestDatabaseUrl,
  requireIsolatedTestDatabaseUrl,
} from "./test-database-safety.js";

const localUrl = "postgresql://postgres@127.0.0.1:55432/a06_validation_test";

test("la validation A06 accepte uniquement une TEST_DATABASE_URL locale explicitement de test", () => {
  const env = { TEST_DATABASE_URL: localUrl };
  const validated = installIsolatedTestDatabaseUrl(env);
  assert.equal(validated.databaseName, "a06_validation_test");
  assert.equal(env.DATABASE_URL, localUrl);
});

test("la validation A06 refuse toute variable susceptible de viser une autre base", () => {
  for (const forbiddenName of ["DATABASE_URL", "SOURCE_DATABASE_URL", "RECOVERY_DATABASE_URL"]) {
    assert.throws(
      () => requireIsolatedTestDatabaseUrl({
        TEST_DATABASE_URL: localUrl,
        [forbiddenName]: "postgresql://production.invalid/secret_clubhouse",
      }),
      /utilisez uniquement TEST_DATABASE_URL/i,
    );
  }
});

test("la validation A06 refuse la production, les hôtes distants et les noms ambigus", () => {
  assert.throws(
    () => requireIsolatedTestDatabaseUrl({
      NODE_ENV: "production",
      TEST_DATABASE_URL: localUrl,
    }),
    /interdite avec NODE_ENV=production/i,
  );
  assert.throws(
    () => requireIsolatedTestDatabaseUrl({
      TEST_DATABASE_URL: "postgresql://postgres@example.test/a06_validation_test",
    }),
    /base PostgreSQL locale isolée/i,
  );
  assert.throws(
    () => requireIsolatedTestDatabaseUrl({
      TEST_DATABASE_URL: "postgresql://postgres@127.0.0.1:55432/secret_clubhouse",
    }),
    /marqueur explicite/i,
  );
});
