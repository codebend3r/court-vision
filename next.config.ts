import type { NextConfig } from "next";

import packageJson from "./package.json";

const nextConfig: NextConfig = {
  env: {
    // Surfaces the package.json version to the SiteFooter; source imports
    // cannot reach the repo root (parent-relative imports are lint-banned).
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/images/netlifyLoader.ts",
  },
};

export default nextConfig;
