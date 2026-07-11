import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./src/lib/images/netlifyLoader.ts",
  },
};

export default nextConfig;
