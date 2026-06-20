import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Keep Cloudflare worker enabled so the Lovable preview/published URLs work.
// The site is published on the custom domain noamwebsites.xyz, so assets must
// be referenced from the domain root instead of the GitHub repository path.
export default defineConfig({
  vite: {
    base: "/",
  },
  tanstackStart: {
    spa: { enabled: true },
  },
});
