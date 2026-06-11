import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim } from "@visulima/colorize";
import { join } from "@visulima/path";

import { assertCleanWorktree, assertGitRepo, subtreeAdd } from "../../util/git/subtree";
import { normalizeWorkspacePath as normalize } from "../../util/utils";
import { ensureWorkspaceMembership } from "../../util/workspace-register";
import type { ImportOptions } from "./index";

/**
 * Execute the `vis import` command: pull an external git repository into the
 * monorepo under a target prefix, preserving its history via `git subtree add`.
 * Validates the source and prefix, refuses to overwrite an existing prefix,
 * performs the subtree add on a clean worktree, and (unless `--no-register`)
 * registers the new package in the workspace config. Throws when the source or
 * prefix is missing, the cwd is not a git repo, or the prefix already exists.
 */
const execute: CommandExecute<Toolbox<Console, ImportOptions>> = async ({ argument, fs, logger, options, process: runtimeProcess, workspaceRoot }) => {
    const source = argument[0];

    if (!source) {
        throw new Error("Missing <source>. Pass a git repository URL or local path to import.");
    }

    if (!options.prefix) {
        throw new Error("Missing --prefix <dir>. Pass the target directory in the monorepo (e.g. packages/tooling/foo).");
    }

    const wsRoot = workspaceRoot ?? runtimeProcess.cwd;
    const prefix = normalize(options.prefix);
    const ref = options.ref ?? "HEAD";

    assertGitRepo(wsRoot);

    const canAccess = async (path: string): Promise<boolean> => {
        try {
            await fs.access(path);

            return true;
        } catch {
            return false;
        }
    };

    if (await canAccess(join(wsRoot, prefix))) {
        throw new Error(`Target "${prefix}" already exists. git subtree add requires a non-existent prefix.`);
    }

    if (options.dryRun) {
        const squash = options.squash ? " --squash" : "";
        const message = options.message ? ` -m "${options.message}"` : "";

        logger.info("Dry run — no changes will be made. Planned steps:");
        logger.info(`  git subtree add --prefix=${prefix}${squash}${message} ${source} ${ref}`);

        if (!options.noRegister) {
            logger.info(`  register ${prefix} into the workspace config (skipped if already covered by an existing glob)`);
        }

        return;
    }

    // git subtree add merges into the working tree — refuse on a dirty
    // tree so the import stays an isolated, reviewable change.
    assertCleanWorktree(wsRoot);

    logger.info(`Importing ${dim(source)}@${ref} → ${prefix} ...`);

    subtreeAdd({ cwd: wsRoot, message: options.message, prefix, ref, repo: source, squash: options.squash });

    logger.info(`✓ Imported ${source} into ${prefix} (history preserved).`);

    if (options.noRegister) {
        logger.info(dim(`Skipped workspace registration (--no-register). Add ${prefix} to your workspace config manually.`));
    } else {
        const result = ensureWorkspaceMembership({ prefix, workspaceRoot: wsRoot });

        if (result.status === "already-covered") {
            logger.info(`✓ ${prefix} is already covered by an existing workspace glob.`);
        } else if (result.status === "added") {
            logger.info(`✓ Registered ${result.entry} in ${result.file}.`);
        } else {
            logger.warn(`Could not auto-register ${prefix}: no workspace config found. Add it to pnpm-workspace.yaml or package.json#workspaces manually.`);
        }
    }

    logger.info(dim("Note: project.json / nx tags are not generated. Add them if your tooling needs them."));
};

export default execute as CommandExecute<Toolbox>;
