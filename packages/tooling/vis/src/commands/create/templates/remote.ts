/**
 * Remote template executors:
 *
 * - `executeRemoteNpm` — runs npm `create-*` packages via `dlx`
 * - `executeRemoteGit` — downloads git repositories using giget
 *   (GitHub, GitLab, Bitbucket, Sourcehut — tarballs with caching)
 *
 * Includes auto-fix rules for popular tools that need extra flags
 * to play nicely with monorepo setups.
 */

import { downloadTemplate } from "giget";

import { info, warn } from "../../../output";
import { runDlx } from "../../../pm-runner";
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

// ── Git remote executor (via giget) ───────────────────────────────

/**
 * Download a git repository template using giget.
 *
 * Supports GitHub, GitLab, Bitbucket, and Sourcehut — with tarball
 * downloads, disk caching, offline support, subdirectory extraction,
 * and private repo auth via tokens.
 *
 * Source format follows giget conventions:
 * - `provider:owner/repo[/subpath][#ref]`
 * - `owner/repo` (defaults to GitHub)
 * - Full HTTPS URLs
 * - `git:` prefix for raw git clone
 */
export const executeRemoteGit = async (
    config: TemplateConfig,
    context: ExecutionContext,
): Promise<number> => {
    const { createConfig } = context;

    info(`Downloading template from ${config.source}...`);

    try {
        const result = await downloadTemplate(config.source, {
            auth: createConfig?.auth || process.env.GIGET_AUTH || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined,
            dir: context.targetDir,
            // force: true is safe here — the caller (index.ts) already validated
            // the target directory is empty via canSafelyOverwrite() before reaching
            // this point. We skip giget's own directory check to avoid a redundant prompt.
            force: true,
            preferOffline: createConfig?.preferOffline,
            provider: createConfig?.defaultProvider,
            registry: createConfig?.registry,
        });

        info(`Downloaded to ${result.dir}`);

        return 0;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        warn(`Failed to download template: ${message}`);

        return 1;
    }
};
