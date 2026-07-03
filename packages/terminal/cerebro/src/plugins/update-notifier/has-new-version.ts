import type { CerebroFs } from "../../types/runtime";
import semverGt from "../../util/general/semver-gt";
import { getLastUpdate, saveLastUpdate } from "./cache";
import getDistributionVersion from "./get-distribution-version";

const hasNewVersion = async ({
    alwaysRun,
    debug,
    distTag: distributionTag = "latest",
    fs,
    pkg,
    registryUrl = "https://registry.npmjs.org/-/package/__NAME__/dist-tags",
    timeout,
    updateCheckInterval = 1000 * 60 * 60 * 24,
}: UpdateNotifierOptions): Promise<string | undefined> => {
    const lastUpdateCheck = await getLastUpdate(pkg.name, fs);

    if (alwaysRun || !lastUpdateCheck || lastUpdateCheck < Date.now() - updateCheckInterval) {
        const latestVersion = await getDistributionVersion(pkg.name, distributionTag, registryUrl, timeout);

        await saveLastUpdate(pkg.name, fs);

        if (semverGt(latestVersion, pkg.version)) {
            return latestVersion;
        }

        if (debug) {
            // eslint-disable-next-line no-console
            console.error(`Latest version (${latestVersion}) not newer than current version (${pkg.version})`);
        }
    } else if (debug) {
        // eslint-disable-next-line no-console
        console.error(
            `Too recent to check for a new update. simpleUpdateNotifier() interval set to ${String(updateCheckInterval)}ms but only ${String(
                Date.now() - lastUpdateCheck,
            )}ms since last check.`,
        );
    }

    return undefined;
};

export type UpdateNotifierOptions = {
    alwaysRun?: boolean;
    debug?: boolean;
    distTag?: string;

    /**
     * Injectable filesystem adapter used to read/write the last-update-check
     * cache. The plugin passes `toolbox.fs` so MCP / sandboxed runtimes can swap
     * the filesystem; defaults to a `node:fs/promises` wrapper when omitted.
     */
    fs?: Pick<CerebroFs, "access" | "mkdir" | "readFile" | "writeFile">;
    pkg: { name: string; version: string };
    registryUrl?: string;
    shouldNotifyInNpmScript?: boolean;
    /** Timeout (ms) for the registry request. Defaults to 5000. */
    timeout?: number;
    updateCheckInterval?: number;
};

export default hasNewVersion;
