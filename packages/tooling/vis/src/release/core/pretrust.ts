/**
 * `vis release pretrust` — bootstrap npm Trusted Publishing (OIDC).
 *
 * npm (unlike PyPI) refuses to let you configure a Trusted Publisher for a
 * package that does not yet exist on the registry. That is a chicken-and-egg
 * for greenfield packages: the very first `vis release publish` over OIDC fails
 * because the package — and therefore its trusted-publisher config — does not
 * exist yet.
 *
 * This breaks the cycle by publishing a minimal, explicitly non-functional
 * placeholder for every managed package missing from the registry. Once the
 * placeholder exists the Trusted Publisher is configured automatically via
 * `npm trust` (or, if that step fails, via the printed `…/access` link), after
 * which OIDC releases succeed.
 *
 * Mirrors the approach of `azu/setup-npm-trusted-publish` — but goes one step
 * further: after a placeholder publishes, it runs `npm trust &lt;provider>` to
 * configure the Trusted Publisher automatically (npm CLI ≥ 11.5.1), so the
 * maintainer doesn't have to open the web UI. The first `npm trust` call may
 * require a 2FA OTP; failures there are reported (not fatal) with the `…/access`
 * fallback URL so the operator can finish manually.
 *
 * The placeholder is published under a dedicated dist-tag (default `placeholder`)
 * so it never becomes `latest` and `npm install &lt;pkg>` keeps failing until the
 * real release ships.
 */

import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PackageManifest } from "../types";
import type { OrchestratorContext } from "./orchestrator";
import type { CommandRunner } from "./package-managers/interface";

/** Trust providers `npm trust` understands that vis can drive (file-based). */
export type TrustProvider = "github" | "gitlab";

export interface RunPretrustOptions {
    /** Publish access level. Default `public`. */
    access?: "public" | "restricted";
    /** Also grant the staged-publish claim (`--allow-stage-publish`). */
    allowStagePublish?: boolean;
    /** Already-built orchestrator context. */
    context: OrchestratorContext;
    /** Print what would be published without uploading. */
    dryRun?: boolean;
    /** Trusted-publisher environment claim (`--env`). */
    env?: string;
    /** Glob filter (CSV) — limit to specific packages. */
    filter?: string;
    /** Publish a placeholder even if the package already exists on the registry. */
    force?: boolean;
    /** Forge provider for the trust claim. Default: auto-detected from the git remote. */
    provider?: TrustProvider;
    /** Override registry URL. */
    registry?: string;
    /** `owner/repo` (github) or `group/project` (gitlab) for the trust claim. Default: detected from the git remote. */
    repo?: string;
    /** Injected runner — defaults to a shell runner. */
    runner?: CommandRunner;
    /** dist-tag for the placeholder. Default `placeholder` (keeps `latest` unset). */
    tag?: string;
    /** Configure trusted publishing via `npm trust` after a successful placeholder publish. Default `true`. */
    trust?: boolean;
    /** Placeholder version. Default `0.0.0`. */
    version?: string;
    /** Workflow / pipeline filename for the trust claim (`--file`). Default: auto-detected. */
    workflow?: string;
}

export interface PretrustItem {
    /** Direct link to the npm access page for configuring trusted publishing. */
    accessUrl?: string;
    name: string;
    /** Whether `npm trust` succeeded for this package (undefined when trust was not attempted). */
    trusted?: boolean;
    /** Why the trust step did not complete (when `trusted` is false). */
    trustReason?: string;
    version: string;
}

export interface RunPretrustResult {
    failed: { name: string; reason: string }[];
    published: PretrustItem[];
    skipped: { name: string; reason: string }[];
}

const DEFAULT_REGISTRY_WEB = "https://www.npmjs.com";

/** Build the `…/access` URL for the default registry; omitted for custom registries (web host unknown). */
const accessUrlFor = (name: string, registry?: string): string | undefined =>
    (registry && !/registry\.npmjs\.org/.test(registry) ? undefined : `${DEFAULT_REGISTRY_WEB}/package/${encodeURIComponent(name)}/access`);

const placeholderReadme = (name: string): string =>
    `# ${name}\n\n`
    + "> ⚠️ **Placeholder package — do not use.**\n\n"
    + "This version contains **no code** and is **not functional**. It was published by "
    + "[`vis release pretrust`](https://visulima.com/packages/vis) only to register the package name on the "
    + "registry so that **npm Trusted Publishing (OIDC)** can be configured before the first real release.\n\n"
    + "Do **not** add this as a dependency. A functional version will replace it when the package is first released.\n";

/** Minimal manifest for the placeholder — only the README ships in the tarball. */
export const composePlaceholderManifest = (
    pkg: { manifest: PackageManifest },
    name: string,
    version: string,
    access: "public" | "restricted",
): Record<string, unknown> => {
    const manifest: Record<string, unknown> = {
        description: "Placeholder published by `vis release pretrust` to enable npm trusted publishing (OIDC). Not functional — do not use.",
        files: ["README.md"],
        license: typeof pkg.manifest.license === "string" ? pkg.manifest.license : "MIT",
        name,
        publishConfig: { access },
        version,
    };

    if (pkg.manifest.repository !== undefined) {
        manifest["repository"] = pkg.manifest.repository;
    }

    return manifest;
};

// ── Trusted-publisher configuration (`npm trust`) ───────────────────

export interface TrustClaim {
    /** Also grant the staged-publish claim. */
    allowStagePublish?: boolean;
    /** Environment claim. */
    env?: string;
    provider: TrustProvider;
    /** `owner/repo` (github) or `group/project` (gitlab). */
    repo?: string;
    /** Workflow / pipeline filename (`--file`). */
    workflow: string;
}

/**
 * Build the `npm trust &lt;provider> &lt;pkg> …` argv. Pure + testable.
 * `--allow-publish` is always granted (the whole point); `-y` keeps it
 * non-interactive. github uses `--repo`, gitlab uses `--project`.
 */
export const buildTrustArgs = (packageName: string, claim: TrustClaim): string[] => {
    const args = ["trust", claim.provider, packageName, "--file", claim.workflow];

    if (claim.repo) {
        args.push(claim.provider === "gitlab" ? "--project" : "--repo", claim.repo);
    }

    if (claim.env) {
        args.push("--env", claim.env);
    }

    args.push("--allow-publish");

    if (claim.allowStagePublish) {
        args.push("--allow-stage-publish");
    }

    args.push("-y");

    return args;
};

const providerForHost = (host: string, repo: string): { provider: TrustProvider; repo: string } | undefined => {
    if (host.includes("gitlab")) {
        return { provider: "gitlab", repo };
    }

    if (host.includes("github")) {
        return { provider: "github", repo };
    }

    return undefined;
};

/** Parse a git remote URL into `{ provider, repo }` (https, scp-like, or ssh:// form). */
export const parseRemoteUrl = (url: string): { provider: TrustProvider; repo: string } | undefined => {
    const cleaned = url.trim().replace(/\.git$/, "");

    // `ssh://git@host:2222/group/project` — parse via URL so an explicit port
    // isn't captured as part of the repo path.
    if (cleaned.startsWith("ssh://")) {
        try {
            const parsed = new URL(cleaned);

            return providerForHost(parsed.hostname, parsed.pathname.replace(/^\/+/, ""));
        } catch {
            return undefined;
        }
    }

    const match = /(?:https?:\/\/|git@)([^/:]+)[/:](\S+)/.exec(cleaned);

    if (!match) {
        return undefined;
    }

    return providerForHost(match[1] ?? "", match[2] ?? "");
};

/** Detect `{ provider, repo }` from the git `origin` remote. */
export const detectRemote = async (runner: CommandRunner, cwd: string): Promise<{ provider: TrustProvider; repo: string } | undefined> => {
    try {
        const result = await runner.run("git", ["config", "--get", "remote.origin.url"], { cwd, silent: true });

        if (result.exitCode !== 0) {
            return undefined;
        }

        return parseRemoteUrl(result.stdout.trim());
    } catch {
        return undefined;
    }
};

/**
 * Auto-detect the release workflow filename for the trust `--file` claim.
 * Prefers a `.github/workflows` (github) / repo-root (gitlab) file that
 * references `vis release` publishing; falls back to a `*release*` workflow.
 */
export const detectReleaseWorkflow = async (cwd: string, provider: TrustProvider): Promise<string | undefined> => {
    if (provider === "gitlab") {
        return ".gitlab-ci.yml";
    }

    const dir = join(cwd, ".github", "workflows");

    let dirEntries: string[];

    try {
        dirEntries = await readdir(dir);
    } catch {
        return undefined;
    }

    const entries = dirEntries.filter((f) => /\.ya?ml$/.test(f));
    const referencesRelease: string[] = [];

    for (const file of entries) {
        try {
            const content = await readFile(join(dir, file), "utf8");

            // A workflow that drives the release: mentions `vis release` and a publish step.
            if (/vis\s+release/.test(content) && /publish/.test(content)) {
                referencesRelease.push(file);
            }
        } catch {
            // skip unreadable file
        }
    }

    // The trust claim is workflow-specific, so guessing the wrong file leaves
    // the real publish workflow unauthorized. Only auto-detect when there is
    // exactly one plausible candidate; otherwise require an explicit --workflow.
    if (referencesRelease.length === 1) {
        return referencesRelease[0];
    }

    if (referencesRelease.length > 1) {
        return undefined;
    }

    const releaseMatches = entries.filter((f) => /release/i.test(f));

    return releaseMatches.length === 1 ? releaseMatches[0] : undefined;
};

/** Run `npm trust` for a single package. Best-effort — returns the outcome. */
export const runNpmTrust = async (
    runner: CommandRunner,
    cwd: string,
    packageName: string,
    claim: TrustClaim,
    registry?: string,
): Promise<{ reason?: string; trusted: boolean }> => {
    const args = buildTrustArgs(packageName, claim);

    if (registry) {
        args.push("--registry", registry);
    }

    try {
        const result = await runner.run("npm", args, { cwd, silent: true });

        if (result.exitCode === 0) {
            return { trusted: true };
        }

        const combined = `${result.stdout}\n${result.stderr}`.trim();

        return { reason: combined || `npm trust exited ${result.exitCode}`, trusted: false };
    } catch (error) {
        return { reason: (error as Error).message, trusted: false };
    }
};

/** Probe whether a package name already exists on the registry. */
export const packageExistsOnRegistry = async (runner: CommandRunner, name: string, cwd: string, registry?: string): Promise<boolean> => {
    const args = ["view", name, "version", "--silent"];

    if (registry) {
        args.push("--registry", registry);
    }

    try {
        const result = await runner.run("npm", args, { cwd, silent: true });

        return result.exitCode === 0 && result.stdout.trim().length > 0;
    } catch {
        return false;
    }
};

export const runPretrust = async (options: RunPretrustOptions): Promise<RunPretrustResult> => {
    const { context: ctx, dryRun = false, force = false, registry } = options;
    const access = options.access ?? "public";
    const tag = options.tag ?? "placeholder";
    const version = options.version ?? "0.0.0";

    const { createShellRunner } = await import("./shell-runner");
    const runner = options.runner ?? createShellRunner();

    let targets = ctx.packages.filter((p) => !p.private);

    if (options.filter) {
        const { default: zeptomatch } = await import("zeptomatch");
        const globs = options.filter
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        targets = targets.filter((p) => globs.some((g) => p.name === g || zeptomatch(g, p.name)));
    }

    const published: PretrustItem[] = [];
    const skipped: { name: string; reason: string }[] = [];
    const failed: { name: string; reason: string }[] = [];

    // Resolve the trust claim once for the whole wave (provider/repo/workflow).
    // `trustClaim === undefined` means "don't attempt trust" (disabled, dry-run,
    // or we couldn't resolve a workflow file); `trustSkipReason` explains why so
    // the operator still gets the manual `…/access` fallback.
    const doTrust = options.trust !== false && !dryRun;
    let trustClaim: TrustClaim | undefined;
    let trustSkipReason: string | undefined;

    if (doTrust) {
        const detected = options.provider && options.repo ? { provider: options.provider, repo: options.repo } : await detectRemote(runner, ctx.cwd);
        const provider = options.provider ?? detected?.provider;

        if (provider) {
            const workflow = options.workflow ?? (await detectReleaseWorkflow(ctx.cwd, provider));

            if (workflow) {
                trustClaim = {
                    allowStagePublish: options.allowStagePublish,
                    env: options.env,
                    provider,
                    repo: options.repo ?? detected?.repo,
                    workflow,
                };
            } else {
                trustSkipReason = "could not find a release workflow file (pass --workflow)";
            }
        } else {
            trustSkipReason = "could not detect a github/gitlab remote (pass --provider + --repo)";
        }
    }

    for (const pkg of targets) {
        if (!force && (await packageExistsOnRegistry(runner, pkg.name, ctx.cwd, registry))) {
            skipped.push({ name: pkg.name, reason: "already-on-registry" });

            continue;
        }

        if (dryRun) {
            published.push({ accessUrl: accessUrlFor(pkg.name, registry), name: pkg.name, version });

            continue;
        }

        let tempDir: string | undefined;

        try {
            tempDir = await mkdtemp(join(tmpdir(), "vis-pretrust-"));

            const manifest = composePlaceholderManifest(pkg, pkg.name, version, access);

            await writeFile(join(tempDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
            await writeFile(join(tempDir, "README.md"), placeholderReadme(pkg.name));

            const args = ["publish", "--tag", tag, "--access", access];

            if (registry) {
                args.push("--registry", registry);
            }

            const result = await runner.run("npm", args, { cwd: tempDir, silent: true });

            if (result.exitCode === 0) {
                const item: PretrustItem = { accessUrl: accessUrlFor(pkg.name, registry), name: pkg.name, version };

                // The package now exists → configure the trusted publisher.
                if (trustClaim) {
                    const trustResult = await runNpmTrust(runner, ctx.cwd, pkg.name, trustClaim, registry);

                    item.trusted = trustResult.trusted;

                    if (!trustResult.trusted) {
                        item.trustReason = trustResult.reason;
                    }
                } else if (trustSkipReason) {
                    item.trusted = false;
                    item.trustReason = trustSkipReason;
                }

                published.push(item);
            } else {
                const combined = `${result.stdout}\n${result.stderr}`;

                if (/EPUBLISHCONFLICT|cannot publish over|previously published/i.test(combined)) {
                    skipped.push({ name: pkg.name, reason: "already-on-registry" });
                } else {
                    failed.push({ name: pkg.name, reason: combined.trim() || `npm publish exited ${result.exitCode}` });
                }
            }
        } catch (error) {
            failed.push({ name: pkg.name, reason: (error as Error).message });
        } finally {
            if (tempDir) {
                await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
            }
        }
    }

    return { failed, published, skipped };
};
