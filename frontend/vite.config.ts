import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";
import fsp from "node:fs/promises";

/**
 * macOS Docker VirtioFS 上 `viteIndexHtmlMiddleware` 每次讀 index.html
 * 都觸發 EAGAIN(-35)。此 plugin 在 Vite 內建 middleware 之前攔截 / 請求，
 * 從 memory cache 服務 HTML，完全繞過 VirtioFS 的讀取。
 */
function serveHtmlFromCachePlugin(): Plugin {
  const htmlPath = path.resolve(__dirname, "index.html");
  let cache: string | null = null;
  let cachePromise: Promise<string> | null = null;

  async function readWithRetry(): Promise<string> {
    // VirtioFS 在容器啟動初期可能需要數秒才穩定，固定 500ms 間隔最多重試 30 次（15 秒）
    for (let i = 0; i < 30; i++) {
      try {
        return await fsp.readFile(htmlPath, "utf-8");
      } catch (err: unknown) {
        const isTransient =
          (err as Record<string, unknown>)?.["errno"] === -35 ||
          String((err as Record<string, unknown>)?.["message"] ?? "").includes("-35");
        if (isTransient && i < 29) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        throw err;
      }
    }
    throw new Error("unreachable");
  }

  function ensureCache(): Promise<string> {
    if (cache !== null) return Promise.resolve(cache);
    if (!cachePromise) {
      cachePromise = readWithRetry().then((html) => {
        cache = html;
        return html;
      });
    }
    return cachePromise;
  }

  // 嘗試同步讀取作為快速啟動（啟動時 VirtioFS 通常較穩定）
  try {
    cache = fs.readFileSync(htmlPath, "utf-8");
  } catch {
    // 同步失敗時在第一次 request 時 async 重試
  }

  return {
    name: "serve-html-from-cache",
    configureServer(server) {
      // 監聽 index.html 變更，讓快取保持最新
      server.watcher.on("change", (file) => {
        if (path.resolve(file) === htmlPath) {
          cache = null;
          cachePromise = null;
          ensureCache().catch(() => {});
        }
      });

      // 在 Vite 內建 middleware 之前插入：攔截所有 SPA 路由（Vite 會對這些路由回傳 index.html）
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "/";
        // 略過 Vite 內部請求、靜態資源（有副檔名）
        if (
          url.startsWith("/@") ||
          url.startsWith("/node_modules") ||
          /\.[a-zA-Z0-9]+(\?.*)?$/.test(url)
        ) {
          return next();
        }

        try {
          const rawHtml = await ensureCache();
          const transformed = await server.transformIndexHtml(
            url,
            rawHtml,
            req.originalUrl ?? url
          );
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache, no-store");
          res.end(transformed);
        } catch {
          // 所有 retry 都失敗：回傳自動重整頁，避免觸發 viteIndexHtmlMiddleware 再次讀檔
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            '<html><head><meta http-equiv="refresh" content="2"><title>啟動中…</title></head>' +
            '<body style="font-family:sans-serif;padding:2rem">開發伺服器啟動中，請稍候…</body></html>'
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveHtmlFromCachePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: {
      overlay: false,
    },
    watch: {
      usePolling: false,
      // index.html 不交由 chokidar 監聽，避免 macOS VirtioFS 上的 EDEADLK (-35)
      // serveHtmlFromCachePlugin 自行在 memory cache 層處理 index.html 更新
      ignored: ["**/index.html"],
    },
  },
});
