import { pathToFileURL } from "node:url";

function normalizedOrigin(value) {
  const url = new URL(String(value ?? ""));
  if (url.protocol !== "https:") throw new Error("L’origine de production doit utiliser HTTPS.");
  return url.origin;
}

function normalizedExpectedCommit(value) {
  const commit = String(value ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/u.test(commit)) {
    throw new Error("Le SHA attendu doit contenir exactement 40 caractères hexadécimaux.");
  }
  return commit;
}

export async function verifyProductionDeployment({
  origin,
  expectedCommit,
  fetchImpl = globalThis.fetch,
}) {
  const productionOrigin = normalizedOrigin(origin);
  const commit = normalizedExpectedCommit(expectedCommit);
  const healthResponse = await fetchImpl(`${productionOrigin}/api/health`, {
    headers: { Accept: "application/json" },
    redirect: "error",
  });
  if (!healthResponse.ok) throw new Error(`Healthcheck en échec : HTTP ${healthResponse.status}.`);
  const health = await healthResponse.json();
  if (health?.ok !== true) throw new Error("Le healthcheck ne confirme pas l’état sain.");
  if (health?.deployment?.commit !== commit) {
    throw new Error(`Le SHA servi ne correspond pas au SHA attendu (${health?.deployment?.commit || "absent"}).`);
  }
  const cacheControl = String(healthResponse.headers.get("cache-control") ?? "");
  if (!/no-store/u.test(cacheControl)) throw new Error("Le healthcheck peut être mis en cache.");
  if (!healthResponse.headers.get("x-request-id")) throw new Error("Le healthcheck ne fournit pas de X-Request-ID.");

  const rootResponse = await fetchImpl(`${productionOrigin}/`, {
    headers: { Accept: "text/html" },
    redirect: "error",
  });
  if (!rootResponse.ok) throw new Error(`Entrée publique en échec : HTTP ${rootResponse.status}.`);
  const html = await rootResponse.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/gu)].map((match) => match[1]);
  if (!assets.some((asset) => asset.endsWith(".js")) || !assets.some((asset) => asset.endsWith(".css"))) {
    throw new Error("Les ressources versionnées JS/CSS ne sont pas reliées à la page publique.");
  }

  for (const asset of assets) {
    const assetResponse = await fetchImpl(`${productionOrigin}${asset}`, { redirect: "error" });
    if (!assetResponse.ok) throw new Error(`Ressource de production indisponible : ${asset}.`);
    await assetResponse.arrayBuffer();
  }

  return Object.freeze({
    verifiedAt: new Date().toISOString(),
    origin: productionOrigin,
    commit,
    healthStatus: healthResponse.status,
    entryStatus: rootResponse.status,
    assets: Object.freeze(assets),
    requestIdPresent: true,
    noStoreHealthcheck: true,
  });
}

async function runCli() {
  const origin = process.argv[2] || "https://secret-clubhouse.onrender.com";
  const expectedCommit = process.argv[3] || process.env.EXPECTED_DEPLOYMENT_COMMIT;
  const result = await verifyProductionDeployment({ origin, expectedCommit });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
