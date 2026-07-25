import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeDeploymentCommit,
  registerSystemRoutes,
} from "./routes/system-routes.js";

test("n’expose qu’un SHA Git complet et valide dans le healthcheck", () => {
  const commit = "4eb2073bbacd4294f845c34548f87585000ebcac";
  assert.equal(normalizeDeploymentCommit(commit.toUpperCase()), commit);
  assert.equal(normalizeDeploymentCommit("4eb2073"), "");
  assert.equal(normalizeDeploymentCommit("not-a-secret"), "");
});

test("relie publiquement le healthcheck au commit Render sans exposer sa configuration", async () => {
  let healthHandler;
  const app = {
    get(path, handler) {
      if (path === "/api/health") healthHandler = handler;
    },
  };
  const queries = [];
  registerSystemRoutes(app, {
    pool: { query: async (statement) => queries.push(statement) },
    privacyContactEmail: "privacy@example.test",
    deploymentCommit: "4eb2073bbacd4294f845c34548f87585000ebcac",
  });
  let body;
  await healthHandler({}, { json: (value) => { body = value; } });

  assert.deepEqual(queries, ["select 1"]);
  assert.deepEqual(body, {
    ok: true,
    deployment: { commit: "4eb2073bbacd4294f845c34548f87585000ebcac" },
  });
  assert.doesNotMatch(JSON.stringify(body), /DATABASE|SECRET|TOKEN/u);
});
