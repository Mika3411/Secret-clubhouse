import { rm } from "node:fs/promises";

const publicApkInBuild = new URL("../dist/downloads/Secret-Clubhouse.apk", import.meta.url);

await rm(publicApkInBuild, { force: true });
