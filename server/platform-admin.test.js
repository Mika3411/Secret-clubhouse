import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizePlatformAdministrator,
  configuredPlatformAdminEmails,
} from "./policies/platform-admin.js";

test("normalise uniquement les adresses administrateur valides", () => {
  assert.deepEqual(
    [...configuredPlatformAdminEmails({
      PLATFORM_ADMIN_EMAILS: " Admin@Exemple.fr, invalide,second@example.org ",
    })],
    ["admin@exemple.fr", "second@example.org"],
  );
});

test("autorise un administrateur déjà nommé sans dépendre de l’environnement", async () => {
  const queries = [];
  const executor = {
    async query(sql, parameters) {
      queries.push({ sql, parameters });
      return {
        rows: [{
          id: "admin-id",
          email: "admin@example.fr",
          role: "parent",
          already_authorized: true,
        }],
      };
    },
  };
  const administrator = await authorizePlatformAdministrator(executor, "admin-id", {
    configuredEmails: new Set(),
  });
  assert.equal(administrator.accountId, "admin-id");
  assert.equal(administrator.grantSource, "database");
  assert.equal(queries.length, 1);
});

test("inscrit une adresse explicitement configurée lors de son premier accès", async () => {
  const queries = [];
  const executor = {
    async query(sql, parameters) {
      queries.push({ sql, parameters });
      if (queries.length === 1) {
        return {
          rows: [{
            id: "admin-id",
            email: "ADMIN@example.fr",
            role: "parent",
            already_authorized: false,
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    },
  };
  const administrator = await authorizePlatformAdministrator(executor, "admin-id", {
    configuredEmails: new Set(["admin@example.fr"]),
  });
  assert.equal(administrator.grantSource, "environment");
  assert.match(queries[1].sql, /insert into platform_administrators/u);
});

test("refuse un parent non nommé et tout profil enfant", async () => {
  const makeExecutor = (role) => ({
    async query() {
      return {
        rows: [{
          id: "account-id",
          email: "person@example.fr",
          role,
          already_authorized: false,
        }],
      };
    },
  });
  assert.equal(
    await authorizePlatformAdministrator(makeExecutor("parent"), "account-id", {
      configuredEmails: new Set(["other@example.fr"]),
    }),
    null,
  );
  assert.equal(
    await authorizePlatformAdministrator(makeExecutor("child"), "account-id", {
      configuredEmails: new Set(["person@example.fr"]),
    }),
    null,
  );
});
