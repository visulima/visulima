import { chmodSync, writeFileSync } from "node:fs";
import { cwd } from "node:process";
import { createInterface } from "node:readline";

import type { Command } from "@visulima/cerebro";
import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { DEFAULT_HOOKS_DIRECTORY } from "./constants";
import { installHooks } from "./install";
import { runList } from "./list";
import { detectHuskyDirectory, migrateFromHusky } from "./migrate";
import { detectPrekConfig, migrateFromPrek } from "./prek";
import { runRun } from "./run";
import { uninstallHooks } from "./uninstall";
import { runValidate } from "./validate";

interface HookLogger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

/**
 * Option describing the hooks directory, shared by every `vis hook *` subcommand.
 */
const hooksDirectoryOption = {
    defaultValue: DEFAULT_HOOKS_DIRECTORY,
    description: "Custom hooks directory",
    name: "hooks-dir",
    type: String,
} as const;

const resolveHooksDirectory = (options: Record<string, unknown>): string => (options.hooksDir as string | undefined) ?? DEFAULT_HOOKS_DIRECTORY;

const confirmPrompt = (question: string): Promise<boolean> =>
    new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });

        rl.question(`${question} (y/N) `, (answer) => {
            rl.close();
            const trimmed = answer.trim().toLowerCase();

            resolve(trimmed === "y" || trimmed === "yes");
        });
    });

const executeInstall = async (hooksDirectory: string, logger: HookLogger): Promise<void> => {
    const root = cwd();
    const huskyDirectory = detectHuskyDirectory(root);
    const prekConfig = detectPrekConfig(root);

    if (huskyDirectory && prekConfig) {
        throw new Error(`Found both husky (${huskyDirectory}/) and prek (${prekConfig}). Remove or migrate one before running \`vis hook install\`.`);
    }

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

    if (prekConfig) {
        logger.info(`Existing prek configuration found at ${prekConfig}`);

        const shouldMigrate = await confirmPrompt("Would you like to migrate your prek hooks to vis?");

        if (shouldMigrate) {
            const migrateResult = migrateFromPrek(root, hooksDirectory, logger);

            if (migrateResult.isError) {
                throw new Error(migrateResult.message);
            }

            if (migrateResult.message) {
                logger.info(migrateResult.message);
            }

            return;
        }

        logger.info("Aborting install. Remove the prek config first or run 'vis hook migrate' to migrate.");

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

const executeMigrate = (hooksDirectory: string, dryRun: boolean, logger: HookLogger): void => {
    const root = cwd();
    const huskyDirectory = detectHuskyDirectory(root);
    const prekConfig = detectPrekConfig(root);

    if (huskyDirectory && prekConfig) {
        throw new Error(`Found both husky (${huskyDirectory}/) and prek (${prekConfig}). Migrate one at a time — rename or remove one before retrying.`);
    }

    if (!huskyDirectory && !prekConfig) {
        throw new Error("No husky (.husky/) or prek (.pre-commit-config.yaml / prek.toml) configuration found to migrate.");
    }

    if (dryRun) {
        logger.info("(dry-run) no files will be written");
    }

    const result = huskyDirectory
        ? migrateFromHusky(root, hooksDirectory, logger as Console, { dryRun })
        : migrateFromPrek(root, hooksDirectory, logger, { dryRun });

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

const executeAdd = (what: string | undefined, hooksDirectory: string, logger: HookLogger): void => {
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

const executeUninstall = (hooksDirectory: string, logger: HookLogger): void => {
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

const sharedHookEnv = [
    {
        defaultValue: undefined,
        description: "Set to 0 to disable git hooks, set to 2 for debug output",
        name: "VIS_GIT_HOOKS",
        type: String,
    },
] as const;

const hookInstall: Command = {
    commandPath: ["hook"],
    description: "Install git hooks for the workspace (migrates husky / prek on prompt)",
    env: [...sharedHookEnv],
    examples: [
        ["vis hook install", "Install git hooks in .vis-hooks/"],
        ["vis hook install --hooks-dir=.githooks", "Install hooks in a custom directory"],
    ],
    execute: async ({ logger, options }) => {
        await executeInstall(resolveHooksDirectory(options), logger);
    },
    group: "Scaffold & Config",
    name: "install",
    options: [hooksDirectoryOption],
};

const hookUninstall: Command = {
    commandPath: ["hook"],
    description: "Remove git hooks and reset core.hooksPath",
    env: [...sharedHookEnv],
    examples: [["vis hook uninstall", "Remove git hooks and reset core.hooksPath"]],
    execute: ({ logger, options }) => {
        executeUninstall(resolveHooksDirectory(options), logger);
    },
    group: "Scaffold & Config",
    name: "uninstall",
    options: [hooksDirectoryOption],
};

const hookMigrate: Command = {
    commandPath: ["hook"],
    description: "Migrate from husky or prek to vis hooks (auto-detected)",
    env: [...sharedHookEnv],
    examples: [
        ["vis hook migrate", "Migrate from husky or prek to vis hooks (auto-detected)"],
        ["vis hook migrate --dry-run", "Preview what a migration would write without touching disk"],
    ],
    execute: ({ logger, options }) => {
        executeMigrate(resolveHooksDirectory(options), Boolean(options.dryRun), logger);
    },
    group: "Scaffold & Config",
    name: "migrate",
    options: [
        hooksDirectoryOption,
        {
            defaultValue: false,
            description: "Preview migrate without writing files",
            name: "dry-run",
            type: Boolean,
        },
    ],
};

const hookList: Command = {
    commandPath: ["hook"],
    description: "Show configured hooks grouped by stage",
    env: [...sharedHookEnv],
    examples: [["vis hook list", "Show configured hooks grouped by stage"]],
    execute: ({ logger, options }) => {
        runList(resolveHooksDirectory(options), logger);
    },
    group: "Scaffold & Config",
    name: "list",
    options: [hooksDirectoryOption],
};

const hookValidate: Command = {
    commandPath: ["hook"],
    description: "Sanity-check installed hooks and the bundled runner",
    env: [...sharedHookEnv],
    examples: [["vis hook validate", "Sanity-check installed hooks and the bundled runner"]],
    execute: ({ logger, options }) => {
        runValidate(resolveHooksDirectory(options), logger);
    },
    group: "Scaffold & Config",
    name: "validate",
    options: [hooksDirectoryOption],
};

const hookRun: Command = {
    argument: {
        description: "Hook stage to run (e.g. pre-commit, commit-msg). Defaults to pre-commit.",
        name: "stage",
        type: String,
    },
    commandPath: ["hook"],
    description: "Run a specific hook stage against tracked files",
    env: [...sharedHookEnv],
    examples: [
        ["vis hook run pre-commit --all-files", "Run the pre-commit hooks against every tracked file"],
        ["vis hook run pre-commit --from-ref=main --to-ref=HEAD", "Run pre-commit hooks on files changed between two refs"],
        ["vis hook run pre-commit --last-commit", "Shortcut for --from-ref HEAD~1 --to-ref HEAD"],
    ],
    execute: ({ argument, logger, options }) => {
        runRun(
            resolveHooksDirectory(options),
            {
                allFiles: Boolean(options.allFiles),
                fromRef: options.fromRef as string | undefined,
                lastCommit: Boolean(options.lastCommit),
                stage: argument[0] as string | undefined,
                toRef: options.toRef as string | undefined,
            },
            logger,
        );
    },
    group: "Scaffold & Config",
    name: "run",
    options: [
        hooksDirectoryOption,
        {
            defaultValue: false,
            description: "Run against every tracked file",
            name: "all-files",
            type: Boolean,
        },
        {
            defaultValue: undefined,
            description: "Include files changed since this ref",
            name: "from-ref",
            type: String,
        },
        {
            defaultValue: undefined,
            description: "Include files changed up to this ref",
            name: "to-ref",
            type: String,
        },
        {
            defaultValue: false,
            description: "Shortcut for --from-ref HEAD~1 --to-ref HEAD",
            name: "last-commit",
            type: Boolean,
        },
    ],
};

const hookAdd: Command = {
    argument: {
        description: "Target to add (currently: `secrets`)",
        name: "target",
        type: String,
    },
    commandPath: ["hook"],
    description: "Add a managed hook snippet (e.g. `vis secrets --staged`)",
    env: [...sharedHookEnv],
    examples: [["vis hook add secrets", "Add a pre-commit hook that runs `vis secrets --staged`"]],
    execute: ({ argument, logger, options }) => {
        executeAdd(argument[0] as string | undefined, resolveHooksDirectory(options), logger);
    },
    group: "Scaffold & Config",
    name: "add",
    options: [hooksDirectoryOption],
};

const hookCommands: Command[] = [hookInstall, hookUninstall, hookMigrate, hookList, hookValidate, hookRun, hookAdd];

export default hookCommands;
