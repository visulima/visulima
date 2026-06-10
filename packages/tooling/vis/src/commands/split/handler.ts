import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim } from "@visulima/colorize";
import { isAbsolute, join } from "@visulima/path";

import type { VisProjectConfiguration } from "../../config/workspace";
import { discoverWorkspace } from "../../config/workspace";
import {
    addRemote,
    assertCleanWorktree,
    assertGitRepo,
    countCommits,
    deleteBranch,
    initRepoFromBranch,
    pushBranch,
    removePathAndCommit,
    subtreeSplit,
} from "../../util/git/subtree";
import { normalizeWorkspacePath as normalize } from "../../util/utils";
import type { SplitOptions } from "./index";

export interface ResolvedPackage {
    pkgName: string;
    relativeDir: string;
}

/**
 * Resolve the package argument to a workspace-relative directory.
 * Matches a project name first, then falls back to treating the
 * argument as a path (validated by the injected `pathExists`).
 */
export const resolvePackageDirectory = async (
    argument: string,
    projects: Record<string, VisProjectConfiguration>,
    pathExists: (relativeDir: string) => Promise<boolean>,
): Promise<ResolvedPackage | undefined> => {
    const project = projects[argument];

    if (project?.root) {
        return { pkgName: argument, relativeDir: normalize(project.root) };
    }

    const candidate = normalize(argument);

    if (candidate.length > 0 && (await pathExists(candidate))) {
        return { pkgName: candidate.split("/").pop() ?? candidate, relativeDir: candidate };
    }

    return undefined;
};

const execute: CommandExecute<Toolbox<Console, SplitOptions>> = async ({
    argument,
    fs,
    logger,
    options,
    process: runtimeProcess,
    visConfig,
    workspaceRoot,
}) => {
    const requested = argument[0];

    if (!requested) {
        throw new Error("Missing <package>. Pass a project name or a workspace-relative path.");
    }

    if (!options.dryRun && !options.output) {
        throw new Error("Missing --output <dir>. Pass the destination directory for the new repo (or use --dry-run).");
    }

    const wsRoot = workspaceRoot ?? runtimeProcess.cwd;

    assertGitRepo(wsRoot);

    const { workspace } = discoverWorkspace(wsRoot, visConfig);

    const canAccess = async (path: string): Promise<boolean> => {
        try {
            await fs.access(path);

            return true;
        } catch {
            return false;
        }
    };

    const resolved = await resolvePackageDirectory(requested, workspace.projects, (relativeDir) => canAccess(join(wsRoot, relativeDir, "package.json")));

    if (!resolved) {
        const known = Object.keys(workspace.projects).sort().join(", ");

        throw new Error(`Unknown package "${requested}". Known projects: ${known || "(none)"}.`);
    }

    const { pkgName, relativeDir } = resolved;
    const branch = options.branch ?? visConfig?.defaultBase ?? "main";
    const tempBranch = `vis/split/${relativeDir.replaceAll("/", "-")}`;
    const outputDir = options.output ? (isAbsolute(options.output) ? options.output : join(wsRoot, options.output)) : undefined;

    if (options.dryRun) {
        logger.info("Dry run — no changes will be made. Planned git commands:");
        logger.info(`  git subtree split --prefix=${relativeDir}${options.annotate ? ` --annotate=(${pkgName}) ` : ""} -b ${tempBranch}`);

        if (outputDir) {
            logger.info(`  git -C ${outputDir} init -b ${branch}`);
            logger.info(`  git -C ${outputDir} pull ${wsRoot} ${tempBranch}`);
        }

        if (options.remote) {
            logger.info(`  git -C ${outputDir ?? "<output>"} remote add origin ${options.remote}`);
        }

        if (options.push) {
            logger.info(`  git -C ${outputDir ?? "<output>"} push -u origin ${branch}`);
        }

        if (options.remove) {
            logger.info(`  git rm -r ${relativeDir} && git commit (in ${wsRoot})`);
        }

        return;
    }

    // outputDir is guaranteed defined here (validated above unless --dry-run).
    const destination = outputDir as string;

    if (await canAccess(destination)) {
        const entries = await fs.readdir(destination);

        if (entries.length > 0 && !options.force) {
            throw new Error(`${destination} is not empty. Re-run with --force to use it anyway.`);
        }
    } else {
        await fs.mkdir(destination, { recursive: true });
    }

    // Removing the package commits to the monorepo — refuse on a dirty
    // tree so the removal commit stays scoped to the deletion.
    if (options.remove) {
        assertCleanWorktree(wsRoot);
    }

    logger.info(`Splitting ${dim(relativeDir)} → ${destination} ...`);

    subtreeSplit({
        annotate: options.annotate ? `(${pkgName}) ` : undefined,
        branch: tempBranch,
        cwd: wsRoot,
        prefix: relativeDir,
    });

    try {
        initRepoFromBranch({ branch, source: wsRoot, sourceBranch: tempBranch, target: destination });

        if (options.remote) {
            addRemote("origin", options.remote, destination);

            if (options.push) {
                pushBranch("origin", branch, destination);
            }
        } else if (options.push) {
            logger.warn("--push ignored: no --remote provided.");
        }

        const commitCount = countCommits(branch, destination);

        logger.info(`✓ Extracted ${pkgName} with ${commitCount} commit(s) to ${destination}`);

        if (options.remove) {
            removePathAndCommit(relativeDir, `chore(${pkgName}): split out to standalone repo`, wsRoot);
            logger.info(`✓ Removed ${relativeDir} from the monorepo (committed).`);
        }

        if (!options.remote) {
            logger.info(dim(`Next: cd ${destination} && git remote add origin <url> && git push -u origin ${branch}`));
        }
    } finally {
        // Always clean up the temporary split branch.
        try {
            deleteBranch(tempBranch, wsRoot);
        } catch {
            // Non-fatal: the branch may not exist if split failed early.
        }
    }
};

export default execute as CommandExecute<Toolbox>;
