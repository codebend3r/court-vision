// ESM stand-in for `use-sync-external-store/shim`, aliased in the design-sync
// Vite build. The published package is CJS-only and does `require("react")`,
// which survives as a runtime `__require` the converter's IIFE can't resolve.
// React 18+ ships useSyncExternalStore natively, so the shim is a re-export.
export { useSyncExternalStore } from "react";
