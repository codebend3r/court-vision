import { browser, defineBackground } from "#imports";

import { handleExternalMessage } from "@/lib/handleMessage";
import { allowedOrigins, importPageUrl } from "@/lib/origins";

// Wiring only: every decision lives in `handleExternalMessage` and `origins`.
const background = defineBackground(() => {
  browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    void handleExternalMessage({
      message,
      senderOrigin: sender.origin ?? null,
      allowedOrigins: allowedOrigins({ isDev: import.meta.env.DEV }),
      fetchImpl: fetch,
    })
      .then(sendResponse)
      // A rejection must still answer, or the page's `sendMessage` never settles.
      .catch(() => sendResponse({ type: "error", reason: "unavailable" }));
    // Keeps the channel open until the asynchronous answer is sent.
    return true;
  });

  browser.action.onClicked.addListener(() => {
    void browser.tabs.create({ url: importPageUrl({ isDev: import.meta.env.DEV }) });
  });
});

export default background;
