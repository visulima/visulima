/**
 * Remote template executors:
 *
 * - `executeRemoteNpm` — runs npm `create-*` packages via `dlx`
 * - `executeRemoteGit` — clones git repositories (GitHub, GitLab, Bitbucket)
 *   using the native git-download module (no npx degit dependency)
 *
 * Includes auto-fix rules for popular tools that need extra flags
 * to play nicely with monorepo setups.
 */

import { info } from "../../../output";
import { runDlx } from "../../../pm-runner";
import { cloneRepo, parseGitUrl } from "../git-download";
import type { ExecutionContext, TemplateConfig } from "./types";

// ── Auto-fix rules for popular create packages ────────────────────

interface AutoFix {
    /** Extra args to always append. */
    args?: string[];
    /** Extra args to append when running inside a monorepo. */
    monoArgs?: string[];
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

// ── Git remote executor ───────────────────────────────────────────

/**
 * Clone a git repository template using the native git-download module.
 *
 * Supports GitHub, GitLab, and Bitbucket — full repos, subdirectories,
 * and single files. Handles private repos via environment tokens
 * (GITHUB_TOKEN, GITLAB_TOKEN, BITBUCKET_TOKEN).
 */
export const executeRemoteGit = (
    config: TemplateConfig,
    context: ExecutionContext,
): number => {
    const gitConfig = parseGitUrl(config.source);

    info(`Cloning ${gitConfig.owner}/${gitConfig.repository} from ${gitConfig.host}...`);

    return cloneRepo(gitConfig, context.targetDir, { verbose: true });
};
