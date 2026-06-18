/**
 * `vis x` preload — the module the Rust launcher passes via `node --import` so a
 * directly-spawned Node runs the user's file as its own entry, skipping the vis JS
 * dispatcher (`bin.js` → lean runner) entirely. nub's file-runner works the same
 * way: register a TS loader in a preload, then let Node run the entry.
 *
 * Runs fully before the entry is loaded, so by the time `node … &lt;file>` resolves
 * the entry the oxc `registerHooks` loader is active and `.env` is in place. Only
 * used on Node >= 22.15 (the launcher gates on the version — the 22.14.x floor has
 * no `registerHooks`, so the launcher delegates `x` to `node dist/bin.js x` there).
 *
 * Side-effecting by design (an `--import` module); it exports nothing.
 */
import { loadEnvFile } from "../task/target-options";
import { installPolyfills } from "./polyfills";
import { registerTsHooks } from "./ts-loader";

// Register the oxc TS load/resolve hooks for the whole import graph — the entry
// and its relative `.ts`/`.tsx` imports transpile on load.
registerTsHooks();

// Auto-load the `.env` cascade from cwd (matches the in-process `vis x` path and
// Bun's own behaviour). Real environment variables win over `.env` values.
const cwd = process.cwd();

for (const [key, value] of Object.entries(loadEnvFile(cwd, true))) {
    if (process.env[key] === undefined) {
        process.env[key] = value;
    }
}

// Optional runtime augmentation: feature-detected JS polyfills for the user
// script, enabled by the launcher (`--polyfill`) via VIS_POLYFILL. No-op unless
// requested and unless the native API is actually missing.
if (process.env["VIS_POLYFILL"] !== undefined) {
    await installPolyfills(process.env["VIS_POLYFILL"], cwd);
}
