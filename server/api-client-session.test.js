import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const nativeToken = Buffer.alloc(32, 11).toString("base64url");

function rememberGlobal(name) {
  return {
    exists: Object.hasOwn(globalThis, name),
    value: globalThis[name],
  };
}

function restoreGlobal(name, previous) {
  if (previous.exists) globalThis[name] = previous.value;
  else delete globalThis[name];
}

test("le client sépare le cookie web du Bearer natif gardé uniquement en mémoire", async () => {
  const previousGlobals = Object.fromEntries(
    ["androidBridge", "Capacitor", "fetch", "localStorage", "sessionStorage"]
      .map((name) => [name, rememberGlobal(name)]),
  );
  const storageAccess = { reads: 0, writes: 0, removals: 0 };
  const storage = {
    getItem() {
      storageAccess.reads += 1;
      return nativeToken;
    },
    setItem() {
      storageAccess.writes += 1;
    },
    removeItem() {
      storageAccess.removals += 1;
    },
  };
  const calls = [];
  let nativeVaultToken = "";
  const nativeVaultCalls = [];

  try {
    delete globalThis.androidBridge;
    delete globalThis.Capacitor;
    globalThis.localStorage = storage;
    globalThis.sessionStorage = storage;
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        status: 200,
        async json() {
          return String(url).endsWith("/auth/login")
            ? { account: { id: "test", role: "parent" }, token: nativeToken }
            : {};
        },
        async blob() {
          return new Blob(["media"]);
        },
      };
    };

    const moduleUrl = new URL("../src/api.js", import.meta.url);
    const webClient = await import(`${moduleUrl.href}?transport=web`);
    assert.equal("getToken" in webClient, false);
    assert.equal(webClient.hasNativeSession(), false);

    await webClient.api.login({ email: "parent@example.test", password: "secret-test" });
    await webClient.api.me();
    const webMediaUrl = await webClient.api.media("message-web");
    URL.revokeObjectURL(webMediaUrl);

    for (const call of calls.splice(0)) {
      assert.equal(call.options.credentials, "include");
      const headers = new Headers(call.options.headers);
      assert.equal(headers.has("Authorization"), false);
      assert.equal(headers.has("X-Secret-Clubhouse-Client"), false);
    }
    assert.equal(webClient.hasNativeSession(), false);

    const successfulFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "900" }),
      async json() {
        return { error: "Trop de tentatives. Réessayez plus tard." };
      },
    });
    await assert.rejects(
      webClient.api.login({ username: "enfant.test", password: "secret-test" }),
      (error) => error.status === 429 && error.retryAfter === 900,
    );
    globalThis.fetch = successfulFetch;

    globalThis.androidBridge = {};
    globalThis.Capacitor.PluginHeaders = [{
      name: "NativeSessionMemory",
      methods: [
        { name: "get", rtype: "promise" },
        { name: "set", rtype: "promise" },
        { name: "clear", rtype: "promise" },
      ],
    }];
    globalThis.Capacitor.nativePromise = async (pluginName, methodName, options = {}) => {
      nativeVaultCalls.push(methodName);
      assert.equal(pluginName, "NativeSessionMemory");
      if (methodName === "get") return { token: nativeVaultToken };
      if (methodName === "set") {
        nativeVaultToken = options.token;
        return {};
      }
      if (methodName === "clear") {
        nativeVaultToken = "";
        return {};
      }
      throw new Error(`Méthode native inattendue : ${methodName}`);
    };
    const nativeClient = await import(`${moduleUrl.href}?transport=native`);
    assert.equal("getToken" in nativeClient, false);
    assert.equal(nativeClient.hasNativeSession(), false);

    await nativeClient.api.login({ email: "parent@example.test", password: "secret-test" });
    assert.equal(nativeClient.hasNativeSession(), true);
    assert.equal(nativeVaultToken, nativeToken);
    const nativeLogin = calls.shift();
    assert.equal(nativeLogin.options.credentials, "omit");
    assert.equal(new Headers(nativeLogin.options.headers).has("Authorization"), false);
    assert.equal(
      new Headers(nativeLogin.options.headers).get("X-Secret-Clubhouse-Client"),
      "native",
    );

    await nativeClient.api.me();
    const nativeAuthenticated = calls.shift();
    assert.equal(nativeAuthenticated.options.credentials, "omit");
    assert.equal(
      new Headers(nativeAuthenticated.options.headers).get("Authorization"),
      `Bearer ${nativeToken}`,
    );

    const nativeMediaUrl = await nativeClient.api.media("message-native");
    URL.revokeObjectURL(nativeMediaUrl);
    const nativeMedia = calls.shift();
    assert.equal(nativeMedia.options.credentials, "omit");
    assert.equal(
      new Headers(nativeMedia.options.headers).get("Authorization"),
      `Bearer ${nativeToken}`,
    );

    const reloadedNativeClient = await import(`${moduleUrl.href}?transport=native-reloaded`);
    await reloadedNativeClient.api.me();
    assert.equal(reloadedNativeClient.hasNativeSession(), true);
    const restoredNativeRequest = calls.shift();
    assert.equal(
      new Headers(restoredNativeRequest.options.headers).get("Authorization"),
      `Bearer ${nativeToken}`,
    );

    await reloadedNativeClient.api.logout();
    assert.equal(reloadedNativeClient.hasNativeSession(), false);
    assert.equal(nativeVaultToken, "");
    assert.equal(calls.shift().options.credentials, "omit");
    assert.deepEqual(nativeVaultCalls, ["get", "set", "get", "clear"]);
    assert.equal(storageAccess.reads, 0);
    assert.equal(storageAccess.writes, 0);
    assert.ok(storageAccess.removals >= 6);
  } finally {
    for (const [name, previous] of Object.entries(previousGlobals)) {
      restoreGlobal(name, previous);
    }
  }
});

test("les coffres natifs de session restent volatils et ne touchent aucun stockage persistant", async () => {
  const androidSource = await readFile(
    new URL("../android/app/src/main/java/fr/secretclubhouse/app/auth/NativeSessionMemoryPlugin.java", import.meta.url),
    "utf8",
  );
  const iosSource = await readFile(
    new URL("../ios/App/App/NativeSessionMemoryPlugin.swift", import.meta.url),
    "utf8",
  );
  const capacitorConfig = JSON.parse(await readFile(
    new URL("../capacitor.config.json", import.meta.url),
    "utf8",
  ));

  assert.match(androidSource, /static volatile String sessionToken/);
  assert.doesNotMatch(androidSource, /SharedPreferences|KeyStore|FileOutputStream|SQLite/i);
  assert.match(iosSource, /static var sessionToken/);
  assert.doesNotMatch(iosSource, /UserDefaults|Keychain|SecItem|write\(to:/i);
  assert.equal(capacitorConfig.loggingBehavior, "none");
});
