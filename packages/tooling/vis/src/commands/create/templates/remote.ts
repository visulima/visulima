/**
 * Remote template executor — runs npm `create-*` packages via `dlx`
 * and clones GitHub repositories.
 *
 * Includes auto-fix rules for popular tools that need extra flags
 * to play nicely with monorepo setups.
 */

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { info, warn } from "../../../output";
import { runDlx } from "../../../pm-runner";
import type { ExecutionContext, TemplateConfig } from "./types";

// ── Auto-fix rules for popular create packages ────────────────────

interface AutoFix {
    /** Extra args to append when running inside a monorepo. */
    monoArgs?: string[];
    /** Extra args to always append. */
    args?: string[];
    /** Prepend a sub-command before the user's args. */
    prependCommand?: string;
}

const AUTO_FIXES: Record<string, AutoFix> = {
    "create-nuxt": {
        monoArgs: ["--no-gitInit"],
    },
    "create-vite": {
        args: ["--no-immediate"],
    },
    sv: {
        args: ["--no-install"],
        prependCommand: "create",
    },
};

const applyAutoFixes = (
    source: string,
    args: string[],
    inMonorepo: boolean,
): string[] => {
    const fix = AUTO_FIXES[source];

    if (!fix) {
        return args;
    }

    const result = [...args];

    if (fix.prependCommand && !result.includes(fix.prependCommand)) {
        result.unshift(fix.prependCommand);
    }

    if (fix.args) {
        for (const arg of fix.args) {
            if (!result.includes(arg)) {
                result.push(arg);
            }
        }
    }

    if (inMonorepo && fix.monoArgs) {
        for (const arg of fix.monoArgs) {
            if (!result.includes(arg)) {
                result.push(arg);
            }
        }
    }

    return result;
};

// ── npm remote executor ───────────────────────────────────────────

export const executeRemoteNpm = (
    config: TemplateConfig,
    context: ExecutionContext,
): number => {
    const args = applyAutoFixes(config.source, [...config.args], context.inMonorepo);

    // Inject project name as first positional arg if not already present
    // (many create-* packages expect the directory name as the first arg)
    if (context.projectName && !args.some((a) => a === context.projectName || a === context.targetDir)) {
        args.unshift(context.targetDir);
    }

    info(`Running ${config.source} via ${context.pm.name} dlx...`);

    const code = runDlx(
        context.pm,
        {
            additionalPackages: [],
            args,
            package: config.source,
            shellMode: false,
            silent: false,
        },
        context.cwd,
        context.logger,
    );

    return code;
};

// ── GitHub remote executor ────────────────────────────────────────

export const executeRemoteGitHub = (
    config: TemplateConfig,
    context: ExecutionContext,
): number => {
    info(`Cloning ${config.source} into ${context.targetDir}...`);

    // Use degit if available, otherwise fall back to git clone --depth 1
    const degitResult = spawnSync("npx", ["--yes", "degit", config.source, context.targetDir], {
        cwd: context.cwd,
        stdio: "inherit",
    });

    if (degitResult.status === 0) {
        return 0;
    }

    // Fallback: git clone --depth 1
    warn("degit failed, falling back to git clone...");

    // Parse owner/repo#branch format
    const { source } = config;
    const hashIndex = source.indexOf("#");
    const repoPath = hashIndex === -1 ? source : source.slice(0, hashIndex);
    const branch = hashIndex === -1 ? undefined : source.slice(hashIndex + 1);

    const gitArgs = ["clone", "--depth", "1"];

    if (branch) {
        gitArgs.push("--branch", branch);
    }

    gitArgs.push(`https://github.com/${repoPath}.git`, context.targetDir);

    const gitResult = spawnSync("git", gitArgs, {
        cwd: context.cwd,
        stdio: "inherit",
    });

    if (gitResult.status !== 0) {
        return gitResult.status ?? 1;
    }

    // Remove .git directory from cloned template
    const gitDir = join(context.targetDir, ".git");

    if (existsSync(gitDir)) {
        rmSync(gitDir, { force: true, recursive: true });
    }

    return 0;
};
