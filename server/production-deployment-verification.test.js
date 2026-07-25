import assert from "node:assert/strict";
import test from "node:test";
import { verifyProductionDeployment } from "./verify-production-deployment.js";

const commit = "4eb2073bbacd4294f845c34548f87585000ebcac";

function response(body, {
  status = 200,
  headers = {},
  json = false,
} = {}) {
  return new Response(json ? JSON.stringify(body) : body, {
    status,
    headers: json ? { "Content-Type": "application/json", ...headers } : headers,
  });
}

test("vérifie le SHA Render, le healthcheck non caché et les ressources versionnées", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    if (url.endsWith("/api/health")) {
      return response({ ok: true, deployment: { commit } }, {
        json: true,
        headers: { "Cache-Control": "no-store", "X-Request-ID": "request-test" },
      });
    }
    if (url.endsWith("/")) {
      return response('<script src="/assets/index-test.js"></script><link href="/assets/index-test.css">');
    }
    return response("asset");
  };

  const result = await verifyProductionDeployment({
    origin: "https://secret-clubhouse.example.test/path",
    expectedCommit: commit,
    fetchImpl,
  });

  assert.equal(result.commit, commit);
  assert.deepEqual(result.assets, ["/assets/index-test.js", "/assets/index-test.css"]);
  assert.deepEqual(requested, [
    "https://secret-clubhouse.example.test/api/health",
    "https://secret-clubhouse.example.test/",
    "https://secret-clubhouse.example.test/assets/index-test.js",
    "https://secret-clubhouse.example.test/assets/index-test.css",
  ]);
});

test("échoue fermé lorsque le SHA servi ne correspond pas à la CI", async () => {
  const fetchImpl = async () => response({
    ok: true,
    deployment: { commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  }, {
    json: true,
    headers: { "Cache-Control": "no-store", "X-Request-ID": "request-test" },
  });

  await assert.rejects(
    verifyProductionDeployment({
      origin: "https://secret-clubhouse.example.test",
      expectedCommit: commit,
      fetchImpl,
    }),
    /ne correspond pas/u,
  );
});

test("refuse HTTP et un SHA abrégé", async () => {
  await assert.rejects(
    verifyProductionDeployment({
      origin: "http://secret-clubhouse.example.test",
      expectedCommit: commit,
    }),
    /HTTPS/u,
  );
  await assert.rejects(
    verifyProductionDeployment({
      origin: "https://secret-clubhouse.example.test",
      expectedCommit: "4eb2073",
    }),
    /40 caractères/u,
  );
});
