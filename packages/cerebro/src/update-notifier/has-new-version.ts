import semverGt from "../util/semver-gt";
import { getLastUpdate, saveLastUpdate } from "./cache";
import getDistributionVersion from "./get-dist-version";

const hasNewVersion = async ({
    alwaysRun,
    debug,
    distTag: distributionTag = "latest",
    pkg,
    registryUrl = "https://registry.npmjs.org/-/package/__NAME__/dist-tags",
    updateCheckInterval = 1000 * 60 * 60 * 24,
}: UpdateNotifierOptions): Promise<string | undefined> => {
    const lastUpdateCheck = getLastUpdate(pkg.name);

    if (alwaysRun || !lastUpdateCheck || lastUpdateCheck < Date.now() - updateCheckInterval) {
        const latestVersion = await getDistributionVersion(pkg.name, distributionTag, registryUrl);

        saveLastUpdate(pkg.name);

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
            `Too recent to check for a new update. simpleUpdateNotifier() interval set to ${updateCheckInterval}ms but only ${
                Date.now() - lastUpdateCheck
            }ms since last check.`,
        );
    }

    return undefined;
};

export type UpdateNotifierOptions = {
    alwaysRun?: boolean;
    debug?: boolean;
    distTag?: string;
    pkg: { name: string; version: string };
    registryUrl?: string;
    shouldNotifyInNpmScript?: boolean;
    updateCheckInterval?: number;
};

export default hasNewVersion;
