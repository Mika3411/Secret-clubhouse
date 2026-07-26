import test from "node:test";
import assert from "node:assert/strict";
import {
  getAccountAvailability,
  listAuthorizedContactAvailability,
  serializeAccountAvailability,
} from "./services/presence-service.js";

test("la présence distingue le premier plan, la veille joignable et la déconnexion", () => {
  assert.deepEqual(serializeAccountAvailability({
    role: "parent",
    connected: true,
    recently_online: true,
    background_reachable: false,
  }), {
    state: "online",
    connected: true,
    online: true,
    canCall: true,
  });

  assert.deepEqual(serializeAccountAvailability({
    role: "child",
    status: "active",
    connected: true,
    recently_online: false,
    background_reachable: true,
  }), {
    state: "background",
    connected: true,
    online: false,
    canCall: true,
  });

  assert.deepEqual(serializeAccountAvailability({
    role: "parent",
    connected: true,
    recently_online: false,
    background_reachable: false,
  }), {
    state: "unavailable",
    connected: true,
    online: false,
    canCall: false,
  });

  assert.deepEqual(serializeAccountAvailability({
    role: "parent",
    connected: false,
    recently_online: true,
    background_reachable: true,
  }), {
    state: "offline",
    connected: false,
    online: false,
    canCall: false,
  });
});

test("un enfant en pause, restreint ou suspendu reste inappelable même si son appareil est joignable", () => {
  for (const row of [
    {
      role: "child",
      status: "paused",
      connected: true,
      recently_online: true,
      background_reachable: true,
    },
    {
      role: "child",
      status: "active",
      processing_restricted_at: new Date().toISOString(),
      connected: true,
      recently_online: false,
      background_reachable: true,
    },
    {
      role: "child",
      status: "active",
      admin_suspended_at: new Date().toISOString(),
      connected: true,
      recently_online: true,
      background_reachable: true,
    },
  ]) {
    assert.equal(serializeAccountAvailability(row).canCall, false);
  }
});

test("la liste de présence reste limitée aux relations autorisées et aux routes push actives", async () => {
  let query = "";
  let parameters = [];
  const executor = {
    async query(sql, params) {
      query = String(sql);
      parameters = params;
      return {
        rows: [{
          contact_id: "SC-111-222-333",
          role: "parent",
          connected: true,
          recently_online: false,
          background_reachable: true,
        }],
      };
    },
  };

  const presence = await listAuthorizedContactAvailability(executor, {
    requesterAccountId: "11111111-1111-4111-8111-111111111111",
    contactIds: ["SC-111-222-333", "SC-444-555-666"],
    webPushEnabled: true,
    nativePushEnabled: true,
  });

  assert.deepEqual(parameters, [
    ["SC-111-222-333", "SC-444-555-666"],
    "11111111-1111-4111-8111-111111111111",
    true,
    true,
  ]);
  assert.match(query, /contact_relationships/u);
  assert.match(query, /family_memberships/u);
  assert.match(query, /family_children/u);
  assert.match(query, /last_foreground_at>now\(\)-interval '75 seconds'/u);
  assert.match(query, /auth_sessions/u);
  assert.match(query, /push_subscriptions/u);
  assert.match(query, /native_push_tokens/u);
  assert.deepEqual(presence, {
    "SC-111-222-333": {
      state: "background",
      connected: true,
      online: false,
      canCall: true,
    },
  });
});

test("la vérification juste avant l’appel utilise la même disponibilité serveur", async () => {
  const executor = {
    async query(sql, params) {
      assert.match(String(sql), /where account\.id=\$1/u);
      assert.deepEqual(params, [
        "22222222-2222-4222-8222-222222222222",
        true,
        false,
      ]);
      return {
        rows: [{
          role: "parent",
          connected: true,
          recently_online: false,
          background_reachable: false,
        }],
      };
    },
  };

  assert.deepEqual(await getAccountAvailability(
    executor,
    "22222222-2222-4222-8222-222222222222",
    { webPushEnabled: true, nativePushEnabled: false },
  ), {
    state: "unavailable",
    connected: true,
    online: false,
    canCall: false,
  });
});
