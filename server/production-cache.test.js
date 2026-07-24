import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import {
  apiCacheControl,
  applyApiNoStoreCache,
  immutableAssetCacheControl,
  mountProductionAssets,
  revalidateCacheControl,
  serviceWorkerCacheControl,
} from "./production-cache.js";

async function startTestServer(app) {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function stopTestServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("Express applique une politique de cache distincte au build Vite et aux API", async (t) => {
  const distPath = await fs.mkdtemp(path.join(os.tmpdir(), "secret-clubhouse-cache-"));
  await fs.mkdir(path.join(distPath, "assets"), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(distPath, "index.html"), "<!doctype html><title>Secret Clubhouse</title>"),
    fs.writeFile(path.join(distPath, "sw.js"), "self.addEventListener('fetch', () => {});"),
    fs.writeFile(path.join(distPath, "assets", "index-AbCd1234.js"), "console.log('versioned');"),
  ]);

  const app = express();
  app.use("/api", applyApiNoStoreCache);
  app.get("/api/cache-test", (_req, res) => res.json({ ok: true }));
  mountProductionAssets(app, { distPath });

  const { server, baseUrl } = await startTestServer(app);
  t.after(async () => {
    await stopTestServer(server);
    await fs.rm(distPath, { recursive: true, force: true });
  });

  await t.test("index.html est toujours revalidé", async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), revalidateCacheControl);
    assert.match(await response.text(), /Secret Clubhouse/);
  });

  await t.test("le service worker ne peut jamais être réutilisé depuis le cache", async () => {
    const response = await fetch(`${baseUrl}/sw.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), serviceWorkerCacheControl);
    assert.equal(response.headers.get("pragma"), "no-cache");
    assert.equal(response.headers.get("expires"), "0");
    assert.equal(response.headers.get("service-worker-allowed"), "/");
    await response.body.cancel();
  });

  await t.test("un asset Vite hashé est immutable pendant un an", async () => {
    const response = await fetch(`${baseUrl}/assets/index-AbCd1234.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), immutableAssetCacheControl);
    await response.body.cancel();
  });

  await t.test("une route API reste privée et non stockable", async () => {
    const response = await fetch(`${baseUrl}/api/cache-test`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), apiCacheControl);
    assert.equal(response.headers.get("pragma"), "no-cache");
    assert.equal(response.headers.get("expires"), "0");
    assert.doesNotMatch(response.headers.get("cache-control") ?? "", /\bpublic\b|immutable/i);
    assert.deepEqual(await response.json(), { ok: true });
  });
});
