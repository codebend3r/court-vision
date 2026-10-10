import { type ValuationPort } from "@/lib/valuation/valuationClient";

// Starts the valuation worker. Null where there is no Worker (the server
// render) or it cannot start; the view then values on the main thread. The
// `new Worker(new URL(…, import.meta.url))` shape is what the bundler looks
// for to emit the worker as its own chunk, so it must stay written inline.
export const createValuationPort = (): ValuationPort | null => {
  if (typeof Worker === "undefined") return null;
  try {
    const worker = new Worker(new URL("@/lib/valuation/valuation.worker.ts", import.meta.url), {
      type: "module",
      name: "fantasy-valuation",
    });
    return {
      post: (request) => worker.postMessage(request),
      listen: ({ onMessage, onError }) => {
        const handleMessage = (event: MessageEvent<unknown>) => onMessage(event.data);
        const handleError = () => onError();
        worker.addEventListener("message", handleMessage);
        worker.addEventListener("messageerror", handleError);
        worker.addEventListener("error", handleError);
        return () => {
          worker.removeEventListener("message", handleMessage);
          worker.removeEventListener("messageerror", handleError);
          worker.removeEventListener("error", handleError);
        };
      },
      terminate: () => worker.terminate(),
    };
  } catch {
    return null;
  }
};
