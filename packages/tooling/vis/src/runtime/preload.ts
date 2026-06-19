/**
 * `vis x` subprocess-augmentation preload — injected via `NODE_OPTIONS=--import
 * &lt;this>` when `VIS_AUGMENT_SUBPROCESS` is set, so every nested `node` the user's
 * script spawns gets the same setup: the oxc `registerHooks` TS loader, the `.env`
 * cascade, and opt-in polyfills. Without `VIS_AUGMENT_SUBPROCESS` it isn't used —
 * the direct `vis x` entry runs in-process (`commands/x/run-file.ts`) instead.
 *
 * Runs fully before the host module loads, so by the time a nested `node &lt;file>`
 * resolves its entry the loader is active and `.env`/polyfills are in place. On the
 * 22.14.x floor (no `registerHooks`) `registerTsHooks` no-ops; nested `.ts` entries
 * then need Node 22.15+.
 *
 * Side-effecting by design (an `--import` module); it exports nothing.
 */
import enableCompileCache from "@visulima/cerebro/compile-cache";

import { prepareScriptRuntime } from "./augment";
import { registerTsHooks } from "./ts-loader";

// Enable V8 compile cache so nested Node processes don't recompile the loader.
enableCompileCache();

// Register the oxc TS load/resolve hooks for the whole import graph — nested
// entries and their relative `.ts`/`.tsx` imports transpile on load.
registerTsHooks();

// Shared setup: `.env` cascade + opt-in polyfills (same as the in-process path).
await prepareScriptRuntime(process.cwd());
