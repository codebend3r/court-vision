import { createValuationResponder } from "@/lib/valuation/workerResponder";

// Entry point of the Fantasy tab's valuation worker: scores every method for
// the whole pool off the main thread. The logic lives in workerResponder.
const respond = createValuationResponder();

addEventListener("message", (event: MessageEvent<unknown>) => {
  const response = respond(event.data);
  if (response !== null) postMessage(response);
});
