import type { RuntimeAdapter } from "./types";

/**
 * Bun adapter. Shares the `package.json` + `node_modules` model with Node,
 * which is why Bun is the clean first cross-runtime cut. `bun.lockb` is the
 * legacy binary lockfile; `bun.lock` is the current text format.
 */
export const bunAdapter: RuntimeAdapter = {
    id: "bun",
    label: "Bun",
    lockfiles: ["bun.lock", "bun.lockb"],
    scriptSource: "package.json",
};
