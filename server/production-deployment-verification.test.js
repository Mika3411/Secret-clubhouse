import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("la CI attend Render et vérifie le SHA exact après chaque push sur main", async () => {
  const workflow = await readFile(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");
  assert.match(workflow, /verify-production:/u);
  assert.match(workflow, /needs:\s*verify/u);
  assert.match(workflow, /github\.event_name == 'push'[\s\S]+github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /verify-production-deployment\.js[\s\S]+secret-clubhouse\.onrender\.com[\s\S]+GITHUB_SHA/u);
  assert.match(workflow, /for attempt in \$\(seq 1 60\)/u);
});
