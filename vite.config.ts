import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Keep Cloudflare worker enabled so the Lovable preview/published URLs work.
// SPA mode is still enabled so `bun run build` produces a static `dist/client`
// folder suitable for Netlify (see netlify.toml).
export default defineConfig({
  vite: {
    base: process.env.GITHUB_PAGES === "true" ? "/NoamWebsites/" : "/",
  },
  tanstackStart: {
    spa: { enabled: true },
  },
});
