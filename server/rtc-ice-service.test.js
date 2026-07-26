import assert from "node:assert/strict";
import test from "node:test";
import { createRtcIceServerProvider } from "./services/rtc-ice-service.js";

test("RTC ICE returns no server when calls are disabled", async () => {
  const getRtcIceServers = createRtcIceServerProvider({
    enabled: false,
    environment: {},
    fetchImplementation: async () => {
      throw new Error("fetch should not be called");
    },
  });

  assert.deepEqual(await getRtcIceServers(), []);
});

test("RTC ICE preserves the configured static STUN and TURN fallback", async () => {
  const getRtcIceServers = createRtcIceServerProvider({
    enabled: true,
    environment: {
      NODE_ENV: "production",
      RTC_STUN_URLS: "stun:one.example, stuns:two.example, https://ignored.example",
      RTC_TURN_URLS: "turn:relay.example",
      RTC_TURN_USERNAME: "clubhouse",
      RTC_TURN_CREDENTIAL: "secret",
    },
  });

  assert.deepEqual(await getRtcIceServers(), [
    { urls: ["stun:one.example", "stuns:two.example"] },
    {
      urls: ["turn:relay.example"],
      username: "clubhouse",
      credential: "secret",
    },
  ]);
});

test("RTC ICE caches managed TURN credentials", async () => {
  const managedServers = [{ urls: ["turn:managed.example"], username: "temporary", credential: "temporary-secret" }];
  let fetchCount = 0;
  const getRtcIceServers = createRtcIceServerProvider({
    enabled: true,
    environment: {
      RTC_TURN_KEY_ID: "key id",
      RTC_TURN_API_TOKEN: "api-token",
    },
    fetchImplementation: async (url, options) => {
      fetchCount += 1;
      assert.equal(url, "https://rtc.live.cloudflare.com/v1/turn/keys/key%20id/credentials/generate-ice-servers");
      assert.equal(options.headers.Authorization, "Bearer api-token");
      return {
        ok: true,
        async json() {
          return { iceServers: managedServers };
        },
      };
    },
    now: () => 1_000,
  });

  assert.deepEqual(await getRtcIceServers(), managedServers);
  assert.deepEqual(await getRtcIceServers(), managedServers);
  assert.equal(fetchCount, 1);
});
