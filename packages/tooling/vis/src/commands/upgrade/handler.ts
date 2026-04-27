import { execSync, spawnSync } from "node:child_process";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import pkg from "../../../package.json";
import type { UpgradeOptions } from "./index";

const execute = async ({ argument, logger, options }: Toolbox<Console, UpgradeOptions>): Promise<void> => {
    const targetVersion = argument?.[0];

    logger.info("info: checking for updates...");

    const currentVersion = pkg.version ?? "unknown";

    // Query npm registry for latest
    let latestVersion: string;

    try {
        const result = execSync("npm view @visulima/vis version", { encoding: "utf8" }).trim();

        latestVersion = targetVersion ?? result;
    } catch {
        throw new Error("Failed to query npm registry. Check your network connection.");
    }

    if (currentVersion === latestVersion && !options.force) {
        logger.info(`\n✓ Already up to date (${currentVersion})`);

        return;
    }

    if (options.check) {
        if (currentVersion === latestVersion) {
            logger.info(`✓ Already up to date (${currentVersion})`);
        } else {
            logger.info(`info: found @visulima/vis@${latestVersion} (current: ${currentVersion})`);
        }

        return;
    }

    logger.info(`info: found @visulima/vis@${latestVersion} (current: ${currentVersion})`);
    logger.info("info: installing...");

    const result = spawnSync("npm", ["install", "-g", `@visulima/vis@${latestVersion}`], {
        encoding: "utf8",
        stdio: "inherit",
    });

    if (result.status !== 0) {
        throw new Error("Failed to update. Try running with sudo or fix npm permissions.");
    }

    logger.info(`\n✓ Updated @visulima/vis from ${currentVersion} → ${latestVersion}`);
};

export default execute as CommandExecute<Toolbox>;
