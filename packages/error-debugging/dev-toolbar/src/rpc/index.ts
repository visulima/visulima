/**
 * RPC layer exports.
 *
 * Client-safe: createClientRPCContext lives here (uses import.meta.hot only).
 * Server-only: createServerRPCContext and all server functions (Node.js I/O)
 * are intentionally NOT re-exported from this barrel so they
 * cannot bleed into client bundles through tree-shaking failures.
 * Import from "./server" directly inside Vite plugins.
 */

export { createClientRPCContext } from "./client";
export { createServerRPCContext } from "./server";
