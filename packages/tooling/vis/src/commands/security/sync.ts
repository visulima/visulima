import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { pail } from "../../io/logger";
import { detectPm } from "../../pm/pm-runner";
import { syncAllowBuildsToNativeConfig, syncMinimumReleaseAgeToNativeConfig } from "../../security/security";
import type { SecuritySyncOptions } from "./index";

const SUPPORTED_PMS = new Set<string>(["bun", "npm", "pnpm", "yarn"]);

const execute = ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SecuritySyncOptions>): void => {
    const cwd = wsRoot ?? process.cwd();
    const pm = detectPm(cwd);

    if (!SUPPORTED_PMS.has(pm.name)) {
        pail.warn(`Package manager '${pm.name}' has no native security config to sync.`);

        return;
    }

    if (!visConfig?.security) {
        pail.warn("vis.config has no `security` block — nothing to sync.");

        return;
    }

    const allowBuilds = Object.fromEntries(
        Object.entries(visConfig.security.allowBuilds ?? {}).filter(([, v]) => v),
    );
    const minutes = visConfig.security.minimumReleaseAge;
    const excludes = visConfig.security.minimumReleaseAgeExclude ?? [];

    const actions: string[] = [];

    if (Object.keys(allowBuilds).length > 0 && !options.skipAllowBuilds) {
        actions.push(...syncAllowBuildsToNativeConfig(pm.name, cwd, allowBuilds));
    }

    if (!options.skipMinReleaseAge) {
        actions.push(...syncMinimumReleaseAgeToNativeConfig(pm.name, cwd, minutes, excludes));
    }

    if (actions.length === 0) {
        pail.success("Nothing to sync — vis.config and native PM config are aligned.");

        return;
    }

    pail.info(`Syncing vis.config security settings to ${pm.name} native config…\n`);

    for (const action of actions) {
        pail.success(`  ${action}`);
    }
};

export default execute as CommandExecute<Toolbox>;
