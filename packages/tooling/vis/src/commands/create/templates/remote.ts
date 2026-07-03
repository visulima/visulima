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

import { relative } from "@visulima/path";
import { downloadTemplate } from "giget";

import { pail } from "../../../io/logger";
import { runDlx } from "../../../pm/pm-runner";
import type { ExecutionContext, TemplateConfig } from "./types";

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

const applyAutoFixes = (source: string, args: string[], inMonorepo: boolean): string[] => {
    const fix = AUTO_FIXES[source];

    if (!fix) {
        return args;
    }

    const result = [...args];

    if (fix.prependCommand && !result.includes(fix.prependCommand)) {
        result.unshift(fix.prependCommand);
    }

    if (fix.args) {
        for (const argument of fix.args) {
            if (!result.includes(argument)) {
                result.push(argument);
            }
        }
    }

    if (inMonorepo && fix.monoArgs) {
        for (const argument of fix.monoArgs) {
            if (!result.includes(argument)) {
                result.push(argument);
            }
        }
    }

    return result;
};

/**
 * Execute an npm `create-*` package via the package manager's `dlx` command.
 *
 * Injects the target directory as the first positional argument if not
 * already present, since most `create-*` packages expect the output
 * directory as the first arg (e.g., `create-vite my-app`).
 *
 * Auto-fix rules are applied for known tools that need extra flags.
 * @param config Resolved template config with source package name and extra args.
 * @param context Runtime context with PM, cwd, target dir, and monorepo flag.
 * @returns Exit code — 0 on success, non-zero on failure.
 */
export const executeRemoteNpm = (config: TemplateConfig, context: ExecutionContext): number => {
    // Build initial args: inject target directory first (most create-* packages
    // expect the output directory as their first positional arg), then append
    // any extra args from the user. This must happen BEFORE applyAutoFixes
    // so that prependCommand (e.g., "create" for sv) lands before the target dir.
    const relativeTarget = relative(context.cwd, context.targetDir) || ".";
    const initialArgs = [...config.args];

    if (!initialArgs.includes(relativeTarget)) {
        initialArgs.unshift(relativeTarget);
    }

    const args = applyAutoFixes(config.source, initialArgs, context.inMonorepo);

    pail.info(`Running ${config.source} via ${context.pm.name} dlx...`);

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
 * - Full HTTPS URLs.
 * - `git:` prefix for raw git clone.
 * @param config Resolved template config with giget source string and extra args.
 * @param context Runtime context with target dir and createConfig (auth, registry, etc.).
 * @returns Exit code — 0 on success, 1 on failure.
 */
export const executeRemoteGit = async (config: TemplateConfig, context: ExecutionContext): Promise<number> => {
    const { createConfig } = context;

    pail.info(`Downloading template from ${config.source}...`);

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

        pail.info(`Downloaded to ${result.dir}`);

        return 0;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        pail.warn(`Failed to download template: ${message}`);

        return 1;
    }
};
