import { chmodSync, writeFileSync } from "node:fs";
import { cwd } from "node:process";
import { createInterface } from "node:readline";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { DEFAULT_HOOKS_DIRECTORY } from "./constants";
import type {
    HookAddOptions,
    HookEnv,
    HookInstallOptions,
    HookListOptions,
    HookMigrateOptions,
    HookRunOptions,
    HookUninstallOptions,
    HookValidateOptions,
} from "./index";
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

const executeInstall = async (hooksDirectory: string, logger: HookLogger, useEditorconfig?: boolean): Promise<void> => {
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
            const migrateResult = migrateFromHusky(root, hooksDirectory, logger as Console, { useEditorconfig });

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
            const migrateResult = migrateFromPrek(root, hooksDirectory, logger, { useEditorconfig });

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

const executeMigrate = (hooksDirectory: string, dryRun: boolean, logger: HookLogger, useEditorconfig?: boolean): void => {
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
        ? migrateFromHusky(root, hooksDirectory, logger as Console, { dryRun, useEditorconfig })
        : migrateFromPrek(root, hooksDirectory, logger, { dryRun, useEditorconfig });

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

const hookInstallImpl = async ({ logger, options, visConfig }: Toolbox<Console, HookInstallOptions, HookEnv>): Promise<void> => {
    await executeInstall(resolveHooksDirectory(options), logger, visConfig?.editorconfig ?? true);
};

const hookUninstallImpl = ({ logger, options }: Toolbox<Console, HookUninstallOptions, HookEnv>): void => {
    executeUninstall(resolveHooksDirectory(options), logger);
};

const hookMigrateImpl = ({ logger, options, visConfig }: Toolbox<Console, HookMigrateOptions, HookEnv>): void => {
    executeMigrate(resolveHooksDirectory(options), Boolean(options.dryRun), logger, visConfig?.editorconfig ?? true);
};

const hookListImpl = ({ logger, options }: Toolbox<Console, HookListOptions, HookEnv>): void => {
    runList(resolveHooksDirectory(options), logger);
};

const hookValidateImpl = ({ logger, options }: Toolbox<Console, HookValidateOptions, HookEnv>): void => {
    runValidate(resolveHooksDirectory(options), logger);
};

const hookRunImpl = ({ argument, logger, options }: Toolbox<Console, HookRunOptions, HookEnv>): void => {
    runRun(
        resolveHooksDirectory(options),
        {
            allFiles: Boolean(options.allFiles),
            fromRef: options.fromRef,
            lastCommit: Boolean(options.lastCommit),
            stage: argument[0],
            toRef: options.toRef,
        },
        logger,
    );
};

const hookAddImpl = ({ argument, logger, options }: Toolbox<Console, HookAddOptions, HookEnv>): void => {
    executeAdd(argument[0], resolveHooksDirectory(options), logger);
};

export const hookInstallExecute = hookInstallImpl as CommandExecute<Toolbox>;
export const hookUninstallExecute = hookUninstallImpl as CommandExecute<Toolbox>;
export const hookMigrateExecute = hookMigrateImpl as CommandExecute<Toolbox>;
export const hookListExecute = hookListImpl as CommandExecute<Toolbox>;
export const hookValidateExecute = hookValidateImpl as CommandExecute<Toolbox>;
export const hookRunExecute = hookRunImpl as CommandExecute<Toolbox>;
export const hookAddExecute = hookAddImpl as CommandExecute<Toolbox>;
