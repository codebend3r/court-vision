// The sync/seed entry points double as CLI scripts, where progress output is
// the point, and as plain functions under unit test, where the same output is
// noise interleaved with the reporter. They take a logger instead of calling
// `console` directly: silent by default, and the CLI wrappers opt in.
export type Logger = (message: string) => void;

export const consoleLogger: Logger = (message) => {
  console.log(message);
};

export const silentLogger: Logger = () => {};
