/**
 * Shared `vis x` runtime setup — the one place that prepares a user script's
 * environment, called by BOTH execution paths (the in-process runner in
 * `commands/x/run-file.ts` and the launcher's `--import` preload in `preload.ts`)
 * so the policy lives once, not copied per entry.
 *
 * It does two things, in order:
 *   1. auto-load the `.env` cascade from `cwd` (real env vars win — dotenv
 *      convention — so an explicitly-set var is never clobbered);
 *   2. install the opt-in, feature-detected polyfills when `VIS_POLYFILL` is set.
 *
 * It does NOT register the oxc TS hooks — the in-process path registers them via
 * `importTs`, the preload via `registerTsHooks`, each before their own import.
 */
import { loadEnvFile } from "../task/target-options";
import { installPolyfills } from "./polyfills";

/**
 * Prepare the environment for a `vis x` user script run from `cwd`: `.env` cascade
 * then opt-in polyfills.
 * @param cwd The directory the script is run from (used for `.env` and polyfill resolution).
 */
export const prepareScriptRuntime = async (cwd: string): Promise<void> => {
    for (const [key, value] of Object.entries(loadEnvFile(cwd, true))) {
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }

    if (process.env["VIS_POLYFILL"] !== undefined) {
        await installPolyfills(process.env["VIS_POLYFILL"], cwd);
    }
};
