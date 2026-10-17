import { COURT_VISION_ORIGIN } from "@vision/yahoo-bridge/constants";
import { defineConfig } from "wxt";

// Public half of a throwaway RSA key. It pins the unpacked development build to
// one extension id (kkonhioibmfcogphfmoplgmfdpkngjif) so the app's
// NEXT_PUBLIC_COURT_VISION_EXTENSION_ID stays stable across reloads. The private
// half was never kept. Store builds get their id from the Chrome Web Store, so
// production manifests carry no key.
const DEV_MANIFEST_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv5Vum/FDt2P8TEL55oiCPfMuY9Y7s0l173rl3tYdetUEjlTsKWjyozMw76TsnzjploKe4J2/S2iX+SnRpT6tgFSYy6g494Xd/4Z8TvJpELREj+wiF7b7xH4czgvbTWOXj3kRicPMQ0bvl0gm5vcPyfcAHfoRIfuO1tEHdP2tQdzJtXWHbbHeRuLaU12GsD+2yitqqrb/d9DoTqOaWlQH+ph/ANJe4rSMwX4bej0/8iNkSH9FFhM2KIudrnmpUwtBxIPogL0vkVa4NdTCXbYJjpstKra2dKk1jZICJymk/7bi8oNYYaoTXWReHklBGWeSBVWGRzaWugn6pMvQz8LFVQIDAQAB";

const config = defineConfig({
  srcDir: "src",
  imports: false,
  manifest: ({ mode }) => ({
    name: "Court Vision",
    description:
      "Import your Yahoo Fantasy Basketball league into Court Vision. Not affiliated with Yahoo.",
    host_permissions: ["https://pub-api-ro.fantasysports.yahoo.com/*"],
    externally_connectable: {
      matches: [
        `${COURT_VISION_ORIGIN}/*`,
        ...(mode === "development" ? ["http://localhost/*"] : []),
      ],
    },
    action: {},
    ...(mode === "development" ? { key: DEV_MANIFEST_KEY } : {}),
  }),
});

export default config;
