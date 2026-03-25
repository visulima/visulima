import { existsSync, writeFileSync } from "node:fs";
import { cwd } from "node:process";
import { createInterface } from "node:readline";

import type { Command } from "@visulima/cerebro";
import { join } from "@visulima/path";

import { DEFAULT_HOOKS_DIRECTORY } from "./constants";
import { installHooks } from "./install";
import { detectHuskyDirectory, migrateFromHusky } from "./migrate";
import { uninstallHooks } from "./uninstall";

/**
 * Prompts the user with a yes/no question. Returns true for "y" or "yes".
 */
const confirmPrompt = (question: string): Promise<boolean> =>
    new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });

        rl.question(`${question} (y/N) `, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
        });
    });

const hook: Command = {
    argument: {
        description: "Action to perform: install, uninstall, or migrate",
        name: "action",
        type: String,
    },
    description: "Manage git hooks for the workspace",
    env: [
        {
            defaultValue: undefined,
            description: "Set to 0 to disable git hooks, set to 2 for debug output",
            name: "VIS_GIT_HOOKS",
            type: String,
        },
    ],
    examples: [
        ["vis hook install", "Install git hooks in .vis-hooks/"],
        ["vis hook uninstall", "Remove git hooks and reset core.hooksPath"],
        ["vis hook migrate", "Migrate from husky to vis hooks"],
        ["vis hook install --hooks-dir=.githooks", "Install hooks in a custom directory"],
    ],
    execute: async ({ argument, logger, options }) => {
        const action = argument[0] ?? "install";
        const hooksDirectory = (options["hooks-dir"] as string | undefined) ?? DEFAULT_HOOKS_DIRECTORY;

        switch (action) {
            case "install": {
                const root = cwd();
                const huskyDirectory = detectHuskyDirectory(root);

                if (huskyDirectory) {
                    logger.info(`Existing husky installation found at ${huskyDirectory}/`);

                    const shouldMigrate = await confirmPrompt("Would you like to migrate your husky hooks to vis?");

                    if (shouldMigrate) {
                        const migrateResult = migrateFromHusky(root, hooksDirectory, logger);

                        if (migrateResult.isError) {
                            throw new Error(migrateResult.message);
                        }

                        if (migrateResult.message) {
                            logger.info(migrateResult.message);
                        }

                        return;
                    }

                    logger.info("Aborting install. Remove husky first or run 'vis hook migrate' to migrate.");

                    return;
                }

                logger.info(`Installing git hooks in ${hooksDirectory}/...`);

                const result = installHooks(hooksDirectory);

                if (result.message) {
                    if (result.isError) {
                        throw new Error(result.message);
                    }

                    logger.info(result.message);

                    return;
                }

                if (!existsSync(join(root, hooksDirectory, "pre-commit"))) {
                    writeFileSync(join(root, hooksDirectory, "pre-commit"), "#!/usr/bin/env sh\n", { mode: 0o755 });
                }

                logger.info("Git hooks installed successfully.");
                break;
            }

            case "migrate": {
                const root = cwd();

                const result = migrateFromHusky(root, hooksDirectory, logger);

                if (result.isError) {
                    throw new Error(result.message);
                }

                if (result.message) {
                    logger.info(result.message);
                }

                break;
            }

            case "uninstall": {
                logger.info("Removing git hooks...");

                const result = uninstallHooks(hooksDirectory);

                if (result.message) {
                    if (result.isError) {
                        throw new Error(result.message);
                    }

                    logger.info(result.message);

                    return;
                }

                logger.info("Git hooks removed successfully.");
                break;
            }

            default: {
                throw new Error(`Unknown action "${action}". Use "install", "uninstall", or "migrate".`);
            }
        }
    },
    name: "hook",
    options: [
        {
            defaultValue: DEFAULT_HOOKS_DIRECTORY,
            description: "Custom hooks directory",
            name: "hooks-dir",
            type: String,
        },
    ],
};

export default hook;
