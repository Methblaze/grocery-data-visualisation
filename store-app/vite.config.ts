import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

// The 3D store is the third version of the visualisation. It builds into ../store,
// which GitHub Pages serves from the repo root at /grocery-data-visualisation/store/.
// The receipt log is read from ../data.csv, the same file the 2024 prototypes use.

const REPO = resolve(__dirname, "..");
const TYPES: Record<string, string> = { ".html": "text/html", ".csv": "text/csv", ".css": "text/css", ".js": "text/javascript" };

/** In development, serve the rest of the repo beside the store, as GitHub Pages does, so its links to the other versions work */
const siblings = (): Plugin => ({
  name: "serve-repo-siblings",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const m = req.url?.match(/^\/grocery-data-visualisation\/([^?#]+\.(?:html|csv|css|js))(?:[?#].*)?$/);
      if (!m || m[1].startsWith("store/")) return next();
      const file = resolve(REPO, decodeURIComponent(m[1]));
      if (!file.startsWith(REPO)) return next();
      try {
        const body = await readFile(file);
        res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
        res.end(body);
      } catch {
        next();
      }
    });
  },
});

export default defineConfig({
  base: "/grocery-data-visualisation/store/",
  plugins: [react(), siblings()],
  server: { fs: { allow: [".."] } },
  build: { outDir: "../store", emptyOutDir: true, chunkSizeWarningLimit: 1100 },
});
