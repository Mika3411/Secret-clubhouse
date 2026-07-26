import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_FAMILY_COUNT_SQL,
  ADMIN_FAMILY_LIST_SQL,
  listAdminFamilies,
  normalizeAdminAccountStatusChange,
  normalizeAdminFamilyQuery,
  serializeAdminFamily,
  updateAdminAccountStatus,
} from "./services/admin-family-service.js";

test("normalise la recherche et borne la pagination des familles", () => {
  assert.deepEqual(normalizeAdminFamilyQuery({
    search: "  Famille_100%  ",
    status: "SUSPENDED",
    page: "-4",
    pageSize: "900",
  }), {
    search: "Famille_100%",
    searchPattern: "%Famille\\_100\\%%",
    status: "suspended",
    page: 1,
    pageSize: 50,
  });
});

test("sérialise les comptes utiles sans contenu de conversation ni secret", () => {
  const family = serializeAdminFamily({
    id: "family-1",
    name: "Famille Martin",
    created_at: "2026-07-25T08:00:00.000Z",
    pending_invitations: 1,
    parents: [{
      id: "parent-1",
      name: "Camille",
      email: "camille@example.test",
      contactId: "SC-111-222-333",
      familyRole: "primary",
      createdAt: "2026-07-25T08:00:00.000Z",
      lastActivityAt: "2026-07-25T09:00:00.000Z",
      protectedAdministrator: false,
    }],
    children: [{
      id: "child-1",
      name: "Lina",
      username: "lina.club",
      contactId: "SC-444-555-666",
      age: 9,
      profileStatus: "paused",
      suspendedAt: "2026-07-25T10:00:00.000Z",
      suspensionReason: "Vérification du compte",
    }],
  });

  assert.equal(family.accountStatus, "suspended");
  assert.equal(family.parents[0].email, "camille@example.test");
  assert.equal(family.children[0].username, "lina.club");
  assert.equal(family.children[0].profileStatus, "paused");
  assert.equal("passwordHash" in family.parents[0], false);
  assert.equal("messages" in family, false);
});

test("la liste paginée ne sélectionne aucun message, média ou secret d’authentification", async () => {
  for (const sql of [ADMIN_FAMILY_COUNT_SQL, ADMIN_FAMILY_LIST_SQL]) {
    for (const forbidden of [
      "messages",
      "media_bytes",
      "password_hash",
      "auth_sessions",
      "push_subscriptions",
    ]) {
      assert.doesNotMatch(sql, new RegExp(forbidden, "u"));
    }
  }

  const queries = [];
  const executor = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql === ADMIN_FAMILY_COUNT_SQL) return { rows: [{ total: 1 }] };
      return {
        rows: [{
          id: "family-1",
          name: "Famille",
          parents: [],
          children: [],
          pending_invitations: 0,
        }],
      };
    },
  };
  const result = await listAdminFamilies(executor, { search: "Martin", page: 2, pageSize: 10 });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.pagination.totalPages, 1);
  assert.equal(result.families.length, 1);
  assert.deepEqual(queries[1].params, ["%Martin%", "all", 10, 10]);
});

test("exige une raison pour suspendre un compte", () => {
  assert.deepEqual(normalizeAdminAccountStatusChange({ status: "suspended" }), {
    valid: false,
    error: "Indiquez brièvement la raison de la suspension.",
  });
  assert.deepEqual(normalizeAdminAccountStatusChange({
    status: "suspended",
    reason: "  Demande   de vérification ",
  }), {
    valid: true,
    value: { status: "suspended", reason: "Demande de vérification" },
  });
});

test("protège les administrateurs et révoque les sessions lors d’une suspension", async () => {
  const protectedExecutor = {
    async query() {
      return {
        rows: [{
          id: "admin-1",
          role: "parent",
          protected_administrator: true,
        }],
      };
    },
  };
  assert.deepEqual(await updateAdminAccountStatus(protectedExecutor, {
    administratorId: "admin-2",
    accountId: "admin-1",
    status: "suspended",
    reason: "Test",
  }), { found: true, protected: true });

  const statements = [];
  const executor = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("from accounts account")) {
        return { rows: [{ id: "child-1", role: "child", protected_administrator: false }] };
      }
      if (sql.startsWith("update accounts")) {
        return {
          rows: [{
            id: "child-1",
            role: "child",
            admin_suspended_at: "2026-07-25T10:00:00.000Z",
            admin_suspension_reason: "Sécurité",
          }],
        };
      }
      if (sql.includes("update auth_sessions")) return { rows: [], rowCount: 2 };
      return { rows: [], rowCount: 1 };
    },
  };
  const result = await updateAdminAccountStatus(executor, {
    administratorId: "admin-1",
    accountId: "child-1",
    status: "suspended",
    reason: "Sécurité",
  });
  assert.equal(result.account.accountStatus, "suspended");
  assert.equal(result.revokedSessions, 2);
  assert.ok(statements.some((sql) => sql.includes("delete from presence")));
});
