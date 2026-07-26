import { readFile, writeFile } from "node:fs/promises";

const packagePath = new URL(
  "../ios/App/CapApp-SPM/Package.swift",
  import.meta.url,
);
const original = await readFile(packagePath, "utf8");
const normalized = original.replace(
  /(\.package\([^\r\n]*\bpath:\s*")([^"]+)(")/g,
  (_, prefix, value, suffix) =>
    `${prefix}${value.replaceAll("\\", "/")}${suffix}`,
);

if (normalized !== original) {
  await writeFile(packagePath, normalized, "utf8");
  console.log("Chemins Swift Package iOS normalisés pour macOS.");
}
