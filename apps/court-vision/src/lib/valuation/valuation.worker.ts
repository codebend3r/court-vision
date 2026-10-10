import { respondToValuation } from "@/lib/valuation/workerProtocol";

// Entry point of the Fantasy tab's valuation worker: scores every method for
// the whole pool off the main thread. The logic is respondToValuation.
addEventListener("message", (event: MessageEvent<unknown>) => {
  const response = respondToValuation(event.data);
  if (response !== null) postMessage(response);
});
