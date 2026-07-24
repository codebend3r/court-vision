// design-sync browser dist build.
//
// Court Vision is a Next.js app, not a published component library, so there is
// no dist/ for the package-shape converter to consume. This Vite library build
// produces one: it compiles the SCSS modules + global tokens the converter's
// esbuild step can't handle, resolves the `@/` alias, aliases `next/*` to
// browser-safe shims, and externalizes React (the converter shims React to
// window.React). Output: ds-dist/index.mjs + ds-dist/style.css.
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const srcDir = join(repoRoot, "src");
const buildDir = import.meta.dirname;

const isReact = (id: string): boolean =>
  id === "react" ||
  id === "react-dom" ||
  id.startsWith("react/") ||
  id.startsWith("react-dom/");

export default defineConfig({
  root: repoRoot,
  configFile: false,
  // Components read a few NEXT_PUBLIC_* env vars (e.g. SiteFooter's version);
  // outside Next `process` is undefined, so inline safe values.
  define: {
    "process.env.NEXT_PUBLIC_APP_VERSION": JSON.stringify("0.1.2"),
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(""),
  },
  // Don't copy the app's public/ dir into the dist; the converter only needs
  // the entry + stylesheet.
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: [
      // use-sync-external-store is CJS-only and require()s react at runtime;
      // route to ESM re-exports built on React's native useSyncExternalStore.
      {
        find: /^use-sync-external-store\/(?:shim\/)?with-selector(?:\.js)?$/,
        replacement: join(buildDir, "shims", "uss-with-selector.ts"),
      },
      {
        find: /^use-sync-external-store(?:\/shim(?:\/index)?(?:\.js)?)?$/,
        replacement: join(buildDir, "shims", "uss-shim.ts"),
      },
      { find: /^next\/link$/, replacement: join(buildDir, "shims", "next-link.tsx") },
      { find: /^next\/navigation$/, replacement: join(buildDir, "shims", "next-navigation.ts") },
      { find: /^next\/image$/, replacement: join(buildDir, "shims", "next-image.tsx") },
      { find: /^@generated\/(.*)/, replacement: join(repoRoot, "generated", "$1") },
      { find: /^@public\/(.*)/, replacement: join(repoRoot, "public", "$1") },
      { find: /^@\/(.*)/, replacement: join(srcDir, "$1") },
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
        // Resolve `@use "@/styles/mixins"` in SCSS the same way the app does.
        importers: [
          {
            findFileUrl(url: string) {
              if (url.startsWith("@/")) {
                return pathToFileURL(join(srcDir, url.slice(2)));
              }
              return null;
            },
          },
        ],
      },
    },
  },
  build: {
    outDir: join(repoRoot, "ds-dist"),
    emptyOutDir: true,
    // CJS deps (use-sync-external-store, etc.) `require("react")`; treat the
    // external React family as ESM so those become static imports the
    // converter's esbuild can shim to window.React, not runtime `__require`.
    commonjsOptions: {
      esmExternals: true,
      transformMixedEsModules: true,
    },
    cssCodeSplit: false,
    minify: false,
    sourcemap: false,
    target: "es2020",
    lib: {
      entry: join(buildDir, "entry.ts"),
      formats: ["es"],
      fileName: () => "index.mjs",
      cssFileName: "style",
    },
    rollupOptions: {
      external: isReact,
    },
  },
});
