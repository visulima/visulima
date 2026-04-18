import { chmodSync, writeFileSync } from "node:fs";
import { cwd } from "node:process";
import { createInterface } from "node:readline";

import type { Command } from "@visulima/cerebro";
import { isAccessibleSync, readFileSync } from "@visulima/fs";
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
            const trimmed = answer.trim().toLowerCase();

            resolve(trimmed === "y" || trimmed === "yes");
        });
    });

const executeInstall = async (hooksDirectory: string, logger: { info: (message: string) => void }): Promise<void> => {
    const root = cwd();
    const huskyDirectory = detectHuskyDirectory(root);

    if (huskyDirectory) {
        logger.info(`Existing husky installation found at ${huskyDirectory}/`);

        const shouldMigrate = await confirmPrompt("Would you like to migrate your husky hooks to vis?");

        if (shouldMigrate) {
            const migrateResult = migrateFromHusky(root, hooksDirectory, logger as Console);

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

    if (!isAccessibleSync(join(root, hooksDirectory, "pre-commit"))) {
        writeFileSync(join(root, hooksDirectory, "pre-commit"), "#!/usr/bin/env sh\n", { mode: 0o755 });
    }

    logger.info("Git hooks installed successfully.");
};

const executeMigrate = (hooksDirectory: string, logger: { info: (message: string) => void }): void => {
    const root = cwd();

    const result = migrateFromHusky(root, hooksDirectory, logger as Console);

    if (result.isError) {
        throw new Error(result.message);
    }

    if (result.message) {
        logger.info(result.message);
    }
};

const SECRETS_HOOK_MARKER = "# vis:secrets-hook";
const SECRETS_HOOK_SCRIPT = `#!/usr/bin/env sh
${SECRETS_HOOK_MARKER}
# Scan staged files for secrets before each commit. Remove this block or the whole file to disable.
pnpm exec vis secrets --staged --quiet || exit 1
`;

const executeAdd = (what: string | undefined, hooksDirectory: string, logger: { info: (message: string) => void; warn: (message: string) => void }): void => {
    if (what !== "secrets") {
        throw new Error(`Unknown hook add target "${String(what)}". Currently supported: "secrets".`);
    }

    const root = cwd();
    const hookPath = join(root, hooksDirectory, "pre-commit");

    if (!isAccessibleSync(join(root, hooksDirectory))) {
        throw new Error(`Hooks directory ${hooksDirectory}/ does not exist. Run \`vis hook install\` first.`);
    }

    if (isAccessibleSync(hookPath)) {
        const existing: string = readFileSync(hookPath);

        if (existing.includes(SECRETS_HOOK_MARKER)) {
            logger.info(`Secrets hook already present in ${hookPath}.`);

            return;
        }

        if (/\bvis secrets\b/.test(existing)) {
            logger.warn(`Found a \`vis secrets\` invocation in ${hookPath} without the managed marker — leaving it untouched.`);

            return;
        }

        const appended = `${existing.trimEnd()}\n\n${SECRETS_HOOK_MARKER}\npnpm exec vis secrets --staged --quiet || exit 1\n`;

        writeFileSync(hookPath, appended);
        chmodSync(hookPath, 0o755);
        logger.info(`Appended secrets scan to ${hookPath}.`);

        return;
    }

    writeFileSync(hookPath, SECRETS_HOOK_SCRIPT, { mode: 0o755 });
    logger.info(`Created ${hookPath} with a secrets-scan pre-commit check.`);
};

const executeUninstall = (hooksDirectory: string, logger: { info: (message: string) => void }): void => {
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
};

const hook: Command = {
    argument: {
        description: "Action to perform: install, uninstall, migrate, or add <target>",
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
        ["vis hook add secrets", "Add a pre-commit hook that runs `vis secrets --staged`"],
        ["vis hook install --hooks-dir=.githooks", "Install hooks in a custom directory"],
    ],
    execute: async ({ argument, logger, options }) => {
        const action = argument[0] ?? "install";
        const hooksDirectory = (options.hooksDir as string | undefined) ?? DEFAULT_HOOKS_DIRECTORY;

        switch (action) {
            case "add": {
                executeAdd(argument[1] as string | undefined, hooksDirectory, logger);
                break;
            }

            case "install": {
                await executeInstall(hooksDirectory, logger);
                break;
            }

            case "migrate": {
                executeMigrate(hooksDirectory, logger);
                break;
            }

            case "uninstall": {
                executeUninstall(hooksDirectory, logger);
                break;
            }

            default: {
                throw new Error(`Unknown action "${action}". Use "install", "uninstall", "migrate", or "add <target>".`);
            }
        }
    },
    group: "Scaffold & Config",
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
