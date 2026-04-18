import { execSync, spawnSync } from "node:child_process";

import type { Command } from "@visulima/cerebro";

import pkg from "../../package.json";

const upgrade: Command = {
    argument: {
        description: "Target version (defaults to latest)",
        name: "version",
        type: String,
    },
    description: "Update vis itself to the latest version",
    examples: [
        ["vis self-update", "Update to latest"],
        ["vis self-update 2.0.0", "Install specific version"],
        ["vis self-update --check", "Check for updates without installing"],
    ],
    execute: async ({ argument, logger, options }) => {
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
            logger.info(`\n\u2713 Already up to date (${currentVersion})`);

            return;
        }

        if (options.check) {
            if (currentVersion === latestVersion) {
                logger.info(`\u2713 Already up to date (${currentVersion})`);
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

        logger.info(`\n\u2713 Updated @visulima/vis from ${currentVersion} \u2192 ${latestVersion}`);
    },
    group: "System",
    name: "self-update",
    options: [
        { defaultValue: false, description: "Check for updates without installing", name: "check", type: Boolean },
        { defaultValue: false, description: "Reinstall even if already current", name: "force", type: Boolean },
        { defaultValue: false, description: "Suppress output (CI mode)", name: "silent", type: Boolean },
    ],
};

export default upgrade;
