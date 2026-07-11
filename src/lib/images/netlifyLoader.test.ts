import { afterEach, describe, expect, it, vi } from "vitest";

import netlifyImageLoader from "./netlifyLoader";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("netlifyImageLoader", () => {
  it("returns the source unchanged in development", () => {
    vi.stubEnv("NODE_ENV", "development");

    const src = "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png";
    expect(netlifyImageLoader({ src, width: 64 })).toBe(src);
  });

  it("builds a Netlify Image CDN URL outside development", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      netlifyImageLoader({
        src: "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png",
        width: 64,
      }),
    ).toBe(
      "/.netlify/images?url=https%3A%2F%2Fcdn.nba.com%2Fheadshots%2Fnba%2Flatest%2F1040x760%2F201939.png&w=64&q=75",
    );
  });

  it("defaults quality to 75 and passes an explicit quality through", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(netlifyImageLoader({ src: "/court-vision-mark.jpg", width: 32, quality: 90 })).toBe(
      "/.netlify/images?url=%2Fcourt-vision-mark.jpg&w=32&q=90",
    );
  });
});
