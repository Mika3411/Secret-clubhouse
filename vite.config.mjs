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
  plugins: [react(), apkDownloadPlugin()],
});
