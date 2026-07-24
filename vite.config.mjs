import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const apkDownloadPlugin = () => ({
  name: "secret-clubhouse-apk-download",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split("?")[0] !== "/downloads/Secret-Clubhouse.apk") {
        next();
        return;
      }
      const apkPath = path.resolve("Secret-Clubhouse-debug.apk");
      if (!fs.existsSync(apkPath)) {
        res.statusCode = 404;
        res.end("APK indisponible");
        return;
      }
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", 'attachment; filename="Secret-Clubhouse.apk"');
      res.setHeader("Content-Length", fs.statSync(apkPath).size);
      fs.createReadStream(apkPath).pipe(res);
    });
  },
});

const phaserCanvasBuildPlugin = () => ({
  name: "secret-clubhouse-phaser-canvas-build",
  enforce: "pre",
  transform(code, id) {
    const normalizedId = id.replaceAll("\\", "/");
    if (!normalizedId.includes("/node_modules/phaser/src/")) return null;
    if (normalizedId.endsWith("/core/DebugHeader.js")) {
      return {
        code: "module.exports = function DebugHeader() {};",
        map: null,
      };
    }
    if (normalizedId.endsWith("/animations/AnimationManager.js")) {
      return {
        code: "module.exports = function AnimationManager(game) { this.game = game; this.globalTimeScale = 1; };",
        map: null,
      };
    }
    return {
      code: code
        .replaceAll("typeof CANVAS_RENDERER", "true")
        .replaceAll("typeof WEBGL_RENDERER", "false")
        .replaceAll("typeof WEBGL_DEBUG", "false")
        .replaceAll("typeof FEATURE_SOUND", "false")
        .replaceAll("typeof PLUGIN_CAMERA3D", "false")
        .replaceAll("typeof PLUGIN_FBINSTANT", "false"),
      map: null,
    };
  },
});

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [phaserCanvasBuildPlugin(), react(), apkDownloadPlugin()],
});
