import path from "node:path";
import express from "express";

export const immutableAssetCacheControl = "public, max-age=31536000, immutable";
export const revalidateCacheControl = "no-cache, max-age=0, must-revalidate";
export const serviceWorkerCacheControl = "no-store, no-cache, must-revalidate";
export const apiCacheControl = "no-store, max-age=0";

const viteHashedFilenamePattern = /(?:^|\/)[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$/;

export function isImmutableViteAsset(distPath, filePath) {
  const relativePath = path.relative(distPath, filePath).split(path.sep).join("/");
  if (!relativePath || relativePath.startsWith("../")) return false;
  return relativePath.startsWith("assets/") || viteHashedFilenamePattern.test(relativePath);
}

export function applyApiNoStoreCache(_req, res, next) {
  res.set({
    "Cache-Control": apiCacheControl,
    Pragma: "no-cache",
    Expires: "0",
  });
  next();
}

export function mountProductionAssets(app, { distPath }) {
  const indexPath = path.join(distPath, "index.html");
  const serviceWorkerPath = path.join(distPath, "sw.js");

  app.get("/sw.js", (_req, res) => {
    res.set({
      "Cache-Control": serviceWorkerCacheControl,
      Pragma: "no-cache",
      Expires: "0",
      "Service-Worker-Allowed": "/",
    });
    res.sendFile(serviceWorkerPath);
  });

  app.use(express.static(distPath, {
    setHeaders(res, filePath) {
      const cacheControl = path.basename(filePath) === "index.html"
        ? revalidateCacheControl
        : isImmutableViteAsset(distPath, filePath)
          ? immutableAssetCacheControl
          : revalidateCacheControl;
      res.setHeader("Cache-Control", cacheControl);
    },
  }));

  app.get("/{*path}", (_req, res) => {
    res.set("Cache-Control", revalidateCacheControl);
    res.sendFile(indexPath);
  });
}
