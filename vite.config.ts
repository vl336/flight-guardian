// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GitHub Pages serves static files only, so that build drops the server: every
// static route is prerendered into dist/client ("/" -> index.html, "/about" ->
// about/index.html, so direct links work), nitro is skipped, and assets are
// rebased onto `base` — "/" on a custom domain, "/<repo>/" on a project site.
// Without GITHUB_PAGES=true nothing below changes — dev and Lovable builds
// keep their normal SSR output.
const isGitHubPages = process.env["GITHUB_PAGES"] === "true";
const base = process.env["GITHUB_PAGES_BASE"] ?? "/";

export default defineConfig({
  vite: isGitHubPages ? { base } : {},
  ...(isGitHubPages ? { nitro: false } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(isGitHubPages
      ? {
          router: { basepath: base },
          prerender: { enabled: true },
        }
      : {}),
  },
});
