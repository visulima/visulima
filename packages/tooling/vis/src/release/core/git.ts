/**
 * Git operations for the release subsystem (RFC §14, §19.1).
 *
 * Stateless helpers around `git` invocations — every function takes a
 * `CommandRunner` so tests can swap in a mock. Failures throw
 * `VisReleaseError` with `TAG_PUSH_FAILED` / `TAG_COLLISION` codes.
 */

import { VisReleaseError } from "../errors";
import type { CommandRunner } from "./package-managers/interface";

export interface GitContext {
    cwd: string;
    runner: CommandRunner;
}

const run = async (ctx: GitContext, args: ReadonlyArray<string>, silent = true): Promise<{ exitCode: number; stderr: string; stdout: string }> =>
    ctx.runner.run("git", args, { cwd: ctx.cwd, silent });

// ── Read-only ──────────────────────────────────────────────────────

export const getCurrentBranch = async (ctx: GitContext): Promise<string | undefined> => {
    const result = await run(ctx, ["rev-parse", "--abbrev-ref", "HEAD"]);

    if (result.exitCode !== 0) {
        return undefined;
    }

    const branch = result.stdout.trim();

    return branch === "HEAD" || branch === "" ? undefined : branch;
};

export const getCurrentSha = async (ctx: GitContext): Promise<string | undefined> => {
    const result = await run(ctx, ["rev-parse", "HEAD"]);

    return result.exitCode === 0 ? result.stdout.trim() : undefined;
};

export const getShortSha = async (ctx: GitContext): Promise<string | undefined> => {
    const result = await run(ctx, ["rev-parse", "--short", "HEAD"]);

    return result.exitCode === 0 ? result.stdout.trim() : undefined;
};

export const hasUncommittedChanges = async (ctx: GitContext): Promise<boolean> => {
    const result = await run(ctx, ["status", "--porcelain"]);

    return result.exitCode === 0 && result.stdout.trim() !== "";
};

export const tagExists = async (ctx: GitContext, tag: string): Promise<boolean> => {
    const result = await run(ctx, ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]);

    return result.exitCode === 0;
};

export const tagExistsRemote = async (ctx: GitContext, tag: string, remote = "origin"): Promise<boolean> => {
    const result = await run(ctx, ["ls-remote", "--tags", remote, tag]);

    return result.exitCode === 0 && result.stdout.trim() !== "";
};

// ── Mutating ───────────────────────────────────────────────────────

/**
 * Stage specific files, then commit with a templated message. Use this for
 * release commits to avoid `git add -A` (which would sweep up unrelated
 * working-tree changes). Returns the resulting commit sha.
 */
export const stageAndCommit = async (
    ctx: GitContext,
    files: ReadonlyArray<string>,
    message: string,
    options: { allowEmpty?: boolean; author?: { email: string; name: string } } = {},
): Promise<string> => {
    if (files.length === 0 && !options.allowEmpty) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            message: "stageAndCommit called with no files (and allowEmpty=false).",
        });
    }

    if (files.length > 0) {
        // Use --force to add gitignored files like .vis/release/.state.json
        // when needed — but normally these aren't gitignored. Skip --force
        // by default to keep behaviour predictable.
        const addResult = await ctx.runner.run("git", ["add", "--", ...files], { cwd: ctx.cwd, silent: true });

        if (addResult.exitCode !== 0) {
            throw new VisReleaseError({
                code: "GIT_OPERATION_FAILED",
                message: `git add failed: ${addResult.stderr || addResult.stdout}`,
            });
        }
    }

    const env = { ...process.env };

    if (options.author) {
        env["GIT_AUTHOR_NAME"] = options.author.name;
        env["GIT_AUTHOR_EMAIL"] = options.author.email;
        env["GIT_COMMITTER_NAME"] = options.author.name;
        env["GIT_COMMITTER_EMAIL"] = options.author.email;
    }

    const commitArgs = ["commit", "-m", message];

    if (options.allowEmpty) {
        commitArgs.push("--allow-empty");
    }

    const result = await ctx.runner.run("git", commitArgs, { cwd: ctx.cwd, env, silent: true });

    if (result.exitCode !== 0) {
        throw new VisReleaseError({
            code: "GIT_OPERATION_FAILED",
            message: `git commit failed: ${result.stderr || result.stdout}`,
        });
    }

    const sha = await getCurrentSha(ctx);

    if (!sha) {
        throw new VisReleaseError({
            code: "GIT_OPERATION_FAILED",
            message: "git commit succeeded but HEAD is not resolvable.",
        });
    }

    return sha;
};

/**
 * Optional signing configuration shape forwarded to `createTag`.
 * Mirrors `VisReleaseConfig.signing` to avoid a circular import.
 */
export interface TagSigningOptions {
    /** Explicit key id passed to `git tag -u &lt;key>`. Optional. */
    key?: string;

    /**
     * `"gpg"`      — `git tag -s` / `-u &lt;key>` (relies on `user.signingkey`).
     * `"ssh"`      — Same `-s` flag; requires `gpg.format=ssh` in git config.
     * `"sigstore"` — Experimental keyless. Uses `gitsign tag` if `gitsign` is
     *                on PATH, otherwise falls back to GPG with a warning.
     */
    mode: "gpg" | "sigstore" | "ssh";
}

/**
 * Detect whether `gitsign` is on PATH. Cached per-process with a TTL —
 * the lookup is hot for waves with N tags, and PATH rarely changes
 * mid-process. The TTL guards against long-running processes (e.g. a
 * `ci release` wrapper that runs `vis release doctor` then
 * `vis release publish`) where a stale "not found" cache from doctor
 * would otherwise force publish to silently fall back to GPG even
 * after the operator installed `gitsign` between the two steps.
 *
 * Exported (F15) so `vis release doctor` reuses the same probe + cache
 * instead of independently re-shelling out to `gitsign --version`.
 * A single source of truth keeps the doctor's pass/fail signal in sync
 * with what `createTag` will actually do at publish time.
 */
const GITSIGN_CACHE_TTL_MS = 60_000;

interface GitsignCache {
    cachedAtMs: number;
    value: boolean;
}

let gitsignAvailableCache: GitsignCache | undefined;

export const gitsignAvailable = async (ctx: GitContext): Promise<boolean> => {
    const now = Date.now();

    if (gitsignAvailableCache !== undefined && now - gitsignAvailableCache.cachedAtMs < GITSIGN_CACHE_TTL_MS) {
        return gitsignAvailableCache.value;
    }

    const probe = await ctx.runner.run("gitsign", ["--version"], { cwd: ctx.cwd, silent: true });

    gitsignAvailableCache = { cachedAtMs: now, value: probe.exitCode === 0 };

    return gitsignAvailableCache.value;
};

/**
 * Reset the gitsign-availability cache. Used by tests to exercise
 * both the "found" and "not found" code paths, and available to
 * production call-sites (command handlers) that want to force a
 * fresh probe — though the 60-second TTL above usually makes an
 * explicit reset unnecessary.
 */
export const resetGitsignCache = (): void => {
    gitsignAvailableCache = undefined;
};

/**
 * @deprecated Prefer `resetGitsignCache`. Retained as a named export
 * for existing test imports that have not yet migrated.
 */
export const resetGitsignCacheForTests = resetGitsignCache;

/**
 * Create a local annotated tag pointing at HEAD. Pre-checks both local
 * (`tagExists`) and remote (`tagExistsRemote`) so an orphaned upstream
 * tag — e.g. a previous run that pushed tags but failed mid-publish —
 * is caught before we create a divergent local tag at a different sha.
 *
 * Throws `TAG_COLLISION` if the tag exists locally OR on the configured
 * remote. The caller (orchestrator) is responsible for batch-validation
 * up-front so all releases either succeed atomically or none do.
 *
 * Signing (release-please #1738, #1314):
 *   - `signing.mode === "gpg"` →
 *       `git tag -s -a &lt;tag> -m &lt;msg>` (default key) OR
 *       `git tag -u &lt;signing.key> -a &lt;tag> -m &lt;msg>` when `key` is set.
 *   - `signing.mode === "ssh"` → same `-s` flag; operator must have
 *       `gpg.format=ssh` + `user.signingkey=&lt;sshkey>` in git config.
 *   - `signing.mode === "sigstore"` → invokes `gitsign tag` when
 *       available; otherwise warns + falls back to GPG.
 */
export const createTag = async (
    ctx: GitContext,
    tag: string,
    message?: string,
    options: { remote?: string; signing?: TagSigningOptions; skipRemoteCheck?: boolean } = {},
): Promise<void> => {
    if (await tagExists(ctx, tag)) {
        throw new VisReleaseError({
            code: "TAG_COLLISION",
            message: `Tag "${tag}" already exists locally. Resolve manually before re-running.`,
        });
    }

    if (!options.skipRemoteCheck && (await tagExistsRemote(ctx, tag, options.remote ?? "origin"))) {
        throw new VisReleaseError({
            code: "TAG_COLLISION",
            message: `Tag "${tag}" already exists on remote "${options.remote ?? "origin"}". A previous run may have pushed tags but failed mid-publish — inspect the remote and either re-use the existing tag or delete it before re-running.`,
        });
    }

    const { signing } = options;

    // Sigstore branch — try `gitsign tag` first; fall back to GPG with
    // a warning when the binary isn't on PATH.
    if (signing?.mode === "sigstore") {
        if (await gitsignAvailable(ctx)) {
            const gitsignArgs = ["tag", "-a", tag];

            if (message) {
                gitsignArgs.push("-m", message);
            }

            const result = await ctx.runner.run("gitsign", gitsignArgs, { cwd: ctx.cwd, silent: true });

            if (result.exitCode !== 0) {
                throw new VisReleaseError({
                    code: "GIT_OPERATION_FAILED",
                    message: `gitsign tag ${tag} failed: ${result.stderr || result.stdout}`,
                });
            }

            return;
        }

        // Fall through to the GPG path with the warning printed to
        // stderr so the operator sees that the preview mode degraded.
        process.stderr.write(`[vis release] Warning: signing.mode is "sigstore" but \`gitsign\` is not on PATH; falling back to GPG signing for tag ${tag}.\n`);
    }

    const args = ["tag"];

    if (signing) {
        // `gpg`, `ssh`, and the sigstore-fallback path all flow through
        // git's built-in signing. The difference is what's configured in
        // git's `gpg.format` / `user.signingkey`. ssh uses `-s` with the
        // operator-supplied signingkey; gpg with an explicit key uses
        // `-u <key>` (overrides `user.signingkey`).
        if (signing.key && signing.mode === "gpg") {
            args.push("-u", signing.key);
        } else {
            args.push("-s");
        }
    }

    if (message) {
        args.push("-a", tag, "-m", message);
    } else {
        args.push(tag);
    }

    const result = await run(ctx, args);

    if (result.exitCode !== 0) {
        throw new VisReleaseError({
            code: "GIT_OPERATION_FAILED",
            message: `git tag ${tag} failed: ${result.stderr || result.stdout}`,
        });
    }
};

export const pushTags = async (ctx: GitContext, options: { atomic?: boolean; remote?: string } = {}): Promise<void> => {
    const args = ["push", options.remote ?? "origin", "--tags"];

    if (options.atomic) {
        args.splice(1, 0, "--atomic");
    }

    const result = await run(ctx, args, false);

    if (result.exitCode !== 0) {
        throw new VisReleaseError({
            code: "TAG_PUSH_FAILED",
            hint: "After resolving, re-run with --resume to retry the push.",
            message: `git push --tags failed: ${result.stderr || result.stdout}`,
        });
    }
};

/**
 * Create OR force-update a floating tag (e.g. `v1`) pointing at HEAD,
 * then force-push it to the remote. Unlike `createTag`, this does NOT
 * fail when the tag already exists — the whole point of a floating tag
 * is that it gets retargeted on every release within the same major
 * version.
 *
 * Used by `floatingMajorTag` (semantic-release #1515 parity) to give
 * reusable GitHub Actions consumers a stable `@v1` pin that auto-tracks
 * the latest patch / minor under the current major.
 */
export const createOrUpdateFloatingTag = async (
    ctx: GitContext,
    tag: string,
    options: { push?: boolean; remote?: string; signing?: TagSigningOptions } = {},
): Promise<void> => {
    const { signing } = options;

    // Audit fix: mirror the sigstore branch from `createTag` so an
    // operator who configured `signing.mode === "sigstore"` gets the
    // SAME signing surface on the floating tag as on the canonical
    // tag. Before, the canonical tag used `gitsign` but the floating
    // tag silently fell through to `git tag -s -f` (GPG only), and
    // the F24 doctor warning text became misleading.
    if (signing?.mode === "sigstore") {
        if (await gitsignAvailable(ctx)) {
            const msg = `Floating tag ${tag}`;
            const gitsignArgs = ["tag", "-f", "-a", "-m", msg, tag];
            const result = await ctx.runner.run("gitsign", gitsignArgs, { cwd: ctx.cwd, silent: true });

            if (result.exitCode !== 0) {
                throw new VisReleaseError({
                    code: "GIT_OPERATION_FAILED",
                    message: `gitsign tag -f ${tag} failed: ${result.stderr || result.stdout}`,
                });
            }

            // Skip the GPG branch below — we're done with tag creation.
            if (options.push === false) {
                return;
            }

            const pushResult = await run(ctx, ["push", options.remote ?? "origin", "--force", `refs/tags/${tag}:refs/tags/${tag}`], false);

            if (pushResult.exitCode !== 0) {
                throw new VisReleaseError({
                    code: "TAG_PUSH_FAILED",
                    hint: "After resolving, re-run with --resume to retry the push.",
                    message: `git push --force refs/tags/${tag} failed: ${pushResult.stderr || pushResult.stdout}`,
                });
            }

            return;
        }

        // Falls through to the GPG path with the warning printed to
        // stderr so the operator sees that the preview mode degraded.
        process.stderr.write(
            `[vis release] Warning: signing.mode is "sigstore" but \`gitsign\` is not on PATH; falling back to GPG signing for floating tag ${tag}.\n`,
        );
    }

    const tagArgs = ["tag", "-f"];

    if (signing) {
        if (signing.key && signing.mode === "gpg") {
            tagArgs.push("-u", signing.key);
        } else {
            tagArgs.push("-s");
        }
    }

    tagArgs.push(tag);

    const tagResult = await run(ctx, tagArgs);

    if (tagResult.exitCode !== 0) {
        throw new VisReleaseError({
            code: "GIT_OPERATION_FAILED",
            message: `git tag -f ${tag} failed: ${tagResult.stderr || tagResult.stdout}`,
        });
    }

    if (options.push === false) {
        return;
    }

    // Force-push the floating tag specifically. We can't use `--tags`
    // here because that pushes new tags only; we need `--force` for the
    // retarget. A targeted `refs/tags/<tag>:refs/tags/<tag>` keeps the
    // blast radius minimal — no other tags are touched.
    const pushResult = await run(ctx, ["push", options.remote ?? "origin", "--force", `refs/tags/${tag}:refs/tags/${tag}`], false);

    if (pushResult.exitCode !== 0) {
        throw new VisReleaseError({
            code: "TAG_PUSH_FAILED",
            hint: "After resolving, re-run with --resume to retry the push.",
            message: `git push --force refs/tags/${tag} failed: ${pushResult.stderr || pushResult.stdout}`,
        });
    }
};

/**
 * Stage + commit a single path that may have been created, modified, OR
 * deleted, then optionally push. Designed for housekeeping commits like
 * the staged-publish registry that the release flow updates on every
 * wave: silent on no-op, soft-fail on push so a tag-push failure
 * upstream doesn't cause a second hard error.
 *
 * Always uses `--include-untracked`-style staging via `git add -A &lt;path>`
 * so a freshly created file is picked up the same as a modification.
 * The commit message must include `[skip ci]` (or your provider's
 * equivalent) — the caller decides the wording so it stays consistent
 * with the rest of the release commit history.
 */
export const stageAndCommitFile = async (
    ctx: GitContext,
    path: string,
    message: string,
    options: { author?: { email: string; name: string }; branch?: string; push?: boolean; remote?: string; sign?: boolean } = {},
): Promise<{ committed: boolean; pushed: boolean }> => {
    // `git add -A <path>` covers create / modify / delete in one call.
    const addResult = await ctx.runner.run("git", ["add", "-A", "--", path], { cwd: ctx.cwd, silent: true });

    if (addResult.exitCode !== 0) {
        throw new VisReleaseError({
            code: "GIT_OPERATION_FAILED",
            message: `git add ${path} failed: ${addResult.stderr || addResult.stdout}`,
        });
    }

    // Nothing staged → nothing to commit. Common when the registry is
    // identical to its previous state on disk.
    const diffResult = await ctx.runner.run("git", ["diff", "--cached", "--quiet", "--", path], { cwd: ctx.cwd, silent: true });

    if (diffResult.exitCode === 0) {
        return { committed: false, pushed: false };
    }

    const env = { ...process.env };

    if (options.author) {
        env["GIT_AUTHOR_NAME"] = options.author.name;
        env["GIT_AUTHOR_EMAIL"] = options.author.email;
        env["GIT_COMMITTER_NAME"] = options.author.name;
        env["GIT_COMMITTER_EMAIL"] = options.author.email;
    }

    const commitArgs = ["commit", "-m", message];

    if (options.sign) {
        commitArgs.push("-S");
    }

    const commitResult = await ctx.runner.run("git", commitArgs, { cwd: ctx.cwd, env, silent: true });

    if (commitResult.exitCode !== 0) {
        throw new VisReleaseError({
            code: "GIT_OPERATION_FAILED",
            message: `git commit failed: ${commitResult.stderr || commitResult.stdout}`,
        });
    }

    if (!options.push) {
        return { committed: true, pushed: false };
    }

    const branch = options.branch ?? (await getCurrentBranch(ctx));

    if (!branch) {
        return { committed: true, pushed: false };
    }

    const pushResult = await ctx.runner.run("git", ["push", options.remote ?? "origin", `HEAD:${branch}`], { cwd: ctx.cwd, silent: false });

    return { committed: true, pushed: pushResult.exitCode === 0 };
};

export const pushBranch = async (ctx: GitContext, branch: string, options: { force?: boolean; remote?: string } = {}): Promise<void> => {
    const args = ["push", options.remote ?? "origin", `HEAD:${branch}`];

    if (options.force) {
        args.push("--force-with-lease");
    }

    const result = await run(ctx, args, false);

    if (result.exitCode !== 0) {
        throw new VisReleaseError({
            code: "TAG_PUSH_FAILED",
            message: `git push ${branch} failed: ${result.stderr || result.stdout}`,
        });
    }
};

// ── Tag-pattern computation ────────────────────────────────────────

/**
 * Default tag pattern for a release: `&lt;package-name>@&lt;version>`.
 * Matches semantic-release / changesets / bumpy convention so existing
 * tag history continues to work post-migration.
 */
export const defaultTagFor = (packageName: string, version: string): string => `${packageName}@${version}`;

/**
 * Render a tag string from a template. Recognised tokens:
 *
 *   `{name}`         — package name (e.g. `@scope/pkg`)
 *   `{unscopedName}` — package name with the leading `@scope/` stripped
 *   `{version}`      — full semver string (`1.2.3-alpha.0`)
 *   `{major}`        — leading numeric segment of the version (`1`)
 *   `{minor}`        — second numeric segment of the version (`2`)
 *   `{patch}`        — third numeric segment (`3`)
 *   `{date}`         — ISO date `YYYY-MM-DD` (resolves to today if not provided)
 *   `{channel}`      — active release channel (`main`, `alpha`, `next`, …)
 *
 * Unknown `{x}` tokens are left intact so users get a recognisable error
 * rather than a silently-empty substring.
 * @param template — e.g. `"v{version}"`, `"{name}-v{major}"`, `"release-{date}"`
 * @param tokens — values to substitute
 */
const TAG_TOKEN_RE = /\{(name|unscopedName|version|major|minor|patch|date|channel)\}/g;

export const renderTagPattern = (template: string, tokens: { channel?: string; date?: string; name?: string; version?: string }): string => {
    const version = tokens.version ?? "";
    const [major = "", minor = "", patch = ""] = version.split(/[-+]/, 1)[0]!.split(".");
    const values: Record<string, string> = {
        channel: tokens.channel ?? "",
        date: tokens.date ?? new Date().toISOString().slice(0, 10),
        major,
        minor,
        name: tokens.name ?? "",
        patch,
        unscopedName: tokens.name ? tokens.name.replace(/^@[^/]+\//, "") : "",
        version,
    };

    return template.replaceAll(TAG_TOKEN_RE, (_match, key: string) => values[key] ?? "");
};
