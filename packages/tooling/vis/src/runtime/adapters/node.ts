import type { RuntimeAdapter } from "./types";

/**
 * Node.js adapter. The default runtime — selected when no bun/deno signal is
 * present, so its lockfile set is the npm/pnpm/yarn family. Detection walks up
 * for any of these; resolution otherwise falls back to node.
 */
export const nodeAdapter: RuntimeAdapter = {
    id: "node",
    label: "Node.js",
    lockfiles: ["pnpm-lock.yaml", "yarn.lock", "package-lock.json", "npm-shrinkwrap.json"],
    scriptSource: "package.json",
};
