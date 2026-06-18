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
import { prepareScriptRuntime } from "./augment";
import { registerTsHooks } from "./ts-loader";

// Register the oxc TS load/resolve hooks for the whole import graph — the entry
// and its relative `.ts`/`.tsx` imports transpile on load.
registerTsHooks();

// Shared setup: `.env` cascade + opt-in polyfills (same as the in-process path).
await prepareScriptRuntime(process.cwd());
