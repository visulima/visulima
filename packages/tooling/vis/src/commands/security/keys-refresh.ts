import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { pail } from "../../io/logger";
import { clearRegistryKeysCache, fetchRegistryKeys } from "../../security/marshalls/registry-keys";
import type { SecurityKeysRefreshOptions } from "./index";

const execute = async ({ options }: Toolbox<Console, SecurityKeysRefreshOptions>): Promise<void> => {
    if (options.clear) {
        const cleared = clearRegistryKeysCache();

        if (options.json) {
            process.stdout.write(`${JSON.stringify({ cleared, refetched: false }, undefined, 2)}\n`);

            return;
        }

        pail.success(cleared ? "Cleared cached npm signing keys." : "No cached npm signing keys to clear.");

        return;
    }

    // Don't pre-clear: `forceRefresh: true` already bypasses the cache freshness
    // check on read, and leaving the existing entry on disk preserves the
    // stale-while-revalidate fallback when the registry fetch fails.
    const result = await fetchRegistryKeys({ forceRefresh: true });

    if (result === undefined) {
        if (options.json) {
            process.stdout.write(`${JSON.stringify({ cleared: false, error: "fetch-failed", refetched: false }, undefined, 2)}\n`);
            process.exitCode = 1;

            return;
        }

        pail.error("Failed to fetch npm signing keys (network error and no cached keys available).");
        process.exitCode = 1;

        return;
    }

    if (options.json) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    cleared: false,
                    fromCache: result.fromCache,
                    keyCount: result.keys.length,
                    refetched: !result.fromCache,
                    stale: result.stale ?? false,
                },
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    if (result.fromCache && result.stale === true) {
        pail.warn(`Network fetch failed — falling back to expired cache (${String(result.keys.length)} keys).`);

        return;
    }

    pail.success(`Refreshed npm signing keys (${String(result.keys.length)} keys).`);
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
