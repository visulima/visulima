/**
 * Shared implementation behind `vis release generate` and
 * `vis release ci release --generate`.
 *
 * Extracted from the command handler (issue #864) so the CI driver can
 * derive its own change file in-process instead of the three-step
 * "generate → commit → ci release" dance, and so both entry points can
 * never drift on range resolution or release-commit filtering.
 *
 * Two-tier resolution per commit (matches bumpy):
 *   1. Conventional-commits parse → `feat`→minor, `fix`/`perf`→patch,
 *      `BREAKING CHANGE`/`!`→major. Scope used to look up the package
 *      when present.
 *   2. File-path-based: detect changed packages from the commit's file
 *      diff; default level `patch`.
 *
 * Multiple commits affecting the same package max-merge their levels.
 *
 * Pure core: this module never logs. It returns a discriminated
 * {@link RunGenerateResult} plus `notes` / `warnings`, and the command
 * layer decides what to print — so the two entry points can't drift on
 * wording or print the same fact twice.
 */

import { join } from "node:path";

import type { CerebroFs } from "@visulima/cerebro";

import { DEFAULT_CHANGES_DIR } from "../../config";
import type { BumpLevel, ChangeFileSimple, PerPackageReleaseConfig, VisReleaseConfig, WorkspacePackage } from "../../types";
import { maxBump } from "../../types";
import { formatChangeFile } from "../change-file";
import type { CommandRunner } from "../package-managers/interface";
import { randomAnimalSlug } from "../slug";
import { resolveLastReleaseRef } from "../version-resolver";
import { annotateAndResolveReverts, buildIgnoreCommitMatchers, CC_TYPE_TO_BUMP, isIgnoredCommit, normalizeCommitSubject } from "./conventional-commits";

export interface RunGenerateOptions {
    /**
     * Permit `--since-last-release` to walk the ENTIRE repository
     * history when no release tag is reachable from HEAD.
     *
     * Off by default, and deliberately so: the tagless case is not rare
     * (a repo tagged `v1.2.3` while `releaseTagPattern` is
     * `{name}@{version}` never matches), and walking everything bumps
     * every package that has ever been touched — `major` for any
     * historical `!` commit — which `ci release --generate
     * --auto-publish` would then publish unattended. Callers surface
     * this as `--allow-full-history`; it is the right answer only for a
     * genuine first release.
     */
    allowFullHistory?: boolean;
    /** Resolved `release` config block. */
    config: VisReleaseConfig;
    /** Workspace root. */
    cwd: string;
    /** Compute the change file but do not write it. */
    dryRun?: boolean;
    /** Explicit start ref. Wins over `sinceLastRelease`. */
    from?: string;
    /** Injected fs (cerebro toolbox). */
    fs: CerebroFs;
    /** Slug for the generated filename. Default: a random animal name. */
    name?: string;
    /** Discovered workspace packages. */
    packages: ReadonlyArray<WorkspacePackage>;
    /** Per-package config map (for `releaseTagPattern` overrides). */
    perPackageConfig?: ReadonlyMap<string, PerPackageReleaseConfig>;
    runner: CommandRunner;

    /**
     * Resolve the start ref to the most recent `releaseTagPattern`
     * tag reachable from HEAD instead of the merge-base with
     * `baseBranch`. Ignored when `from` is set.
     */
    sinceLastRelease?: boolean;
}

/**
 * Fields every outcome carries.
 *
 * `notes` / `warnings` exist because this module is `release/core`: it
 * computes and returns, the command layer decides what to print (same
 * contract as `resolveCurrentVersions` and `annotateAndResolveReverts`).
 * Nothing here writes to a logger.
 */
interface RunGenerateOutcome {
    /** Number of commits dropped by the release-commit / `ignoreCommitPattern` filter. */
    ignoredCommits: number;
    /** Info-level lines for the command layer to print, in order. */
    notes: string[];
    /** Warning-level lines for the command layer to print, in order. */
    warnings: string[];
}

/** Outcomes that got far enough to walk a commit range. */
interface RunGenerateWalked extends RunGenerateOutcome {
    /** Derived bumps, keyed by package name. */
    bumps: ReadonlyMap<string, BumpLevel>;
    /** The resolved start ref of the walked range. */
    fromRef: string;
}

/** `dryRun` — the content was rendered but nothing was written. */
export interface RunGenerateDryRun extends RunGenerateWalked {
    /** Rendered change-file content. */
    content: string;
    status: "dry-run";
}

/** The run could not produce a change file; the caller must exit non-zero. */
export interface RunGenerateFailure extends RunGenerateOutcome {
    /** Operator-facing explanation — print it via `logger.error`. */
    error: string;
    /** The start ref, when the failure happened after the range was resolved. */
    fromRef?: string;
    status: "failed";
}

/** The range held no commit that maps to a workspace package. */
export interface RunGenerateNoChanges extends RunGenerateWalked {
    status: "no-changes";
}

/** A change file was written to disk. */
export interface RunGenerateWritten extends RunGenerateWalked {
    /** Rendered change-file content. */
    content: string;
    /** Absolute path of the file written. */
    createdFile: string;
    status: "written";
}

export type RunGenerateResult = RunGenerateDryRun | RunGenerateFailure | RunGenerateNoChanges | RunGenerateWritten;

interface CommitRecord {
    body: string;
    files: string[];
    hash: string;
    subject: string;
}

interface ResolveFromRefResult {
    /** Set when no safe range could be derived; the run must fail. */
    error?: string;
    notes: string[];
    /** The resolved start ref. Absent iff `error` is set. */
    ref?: string;
    warnings: string[];
}

/**
 * Resolve the `&lt;from>` side of the walked range.
 *
 * Precedence: explicit `--from` → `--since-last-release` → merge-base
 * with `baseBranch` → `HEAD~10`.
 */
const resolveFromRef = async (options: RunGenerateOptions): Promise<ResolveFromRefResult> => {
    const { config, cwd, packages, perPackageConfig, runner } = options;
    const notes: string[] = [];
    const warnings: string[] = [];

    if (options.from) {
        return { notes, ref: options.from, warnings };
    }

    if (options.sinceLastRelease) {
        const resolved = await resolveLastReleaseRef({ cwd, packages, perPackageConfig, runner, workspaceConfig: config });

        if (resolved.kind === "tag" && resolved.ref) {
            notes.push(`--since-last-release: ${resolved.reason}.`);

            return { notes, ref: resolved.ref, warnings };
        }

        if (resolved.kind === "root-commit" && resolved.ref) {
            // The destructive case. "No release tag matched" is NOT the
            // same statement as "everything ever committed is
            // unreleased", and silently treating it as such bumps every
            // package in the workspace — `major` on any historical `!`
            // commit — which `ci release --generate --auto-publish`
            // then publishes with no human in the loop.
            if (options.allowFullHistory !== true) {
                return {
                    error:
                        `--since-last-release: ${resolved.reason}. Refusing to walk it: every package touched anywhere in that history `
                        + `would be bumped (major, for any breaking-change marker in it) and, on the auto-publish path, published. `
                        + `Pass --allow-full-history if this really is a first release, or pin the start of the range explicitly.`,
                    notes,
                    warnings,
                };
            }

            warnings.push(`--since-last-release: ${resolved.reason}. Walking it because --allow-full-history was passed.`);

            return { notes, ref: resolved.ref, warnings };
        }

        warnings.push(`--since-last-release: ${resolved.reason}. Falling back to the merge-base with baseBranch.`);
    }

    const baseBranch = config.baseBranch ?? "main";
    const mergeBase = await runner.run("git", ["merge-base", `origin/${baseBranch}`, "HEAD"], { cwd, silent: true });

    if (mergeBase.exitCode === 0 && mergeBase.stdout.trim()) {
        return { notes, ref: mergeBase.stdout.trim(), warnings };
    }

    const fallback = await runner.run("git", ["merge-base", baseBranch, "HEAD"], { cwd, silent: true });

    return { notes, ref: fallback.exitCode === 0 && fallback.stdout.trim() ? fallback.stdout.trim() : "HEAD~10", warnings };
};

export const runGenerate = async (options: RunGenerateOptions): Promise<RunGenerateResult> => {
    const { config, cwd, fs, packages, runner } = options;

    const range = await resolveFromRef(options);
    const notes: string[] = [...range.notes];
    const warnings: string[] = [...range.warnings];

    if (range.error !== undefined || range.ref === undefined) {
        return { error: range.error ?? "Could not resolve the start of the commit range.", ignoredCommits: 0, notes, status: "failed", warnings };
    }

    const fromRef = range.ref;

    // Build a directory→package lookup. `git log --name-only` always emits
    // forward slashes, so normalise pkg.dir to the same so Windows backslashes
    // don't sabotage the prefix match below.
    const dirToPkg = new Map<string, string>();

    for (const pkg of packages) {
        const rawRel = pkg.dir.startsWith(cwd) ? pkg.dir.slice(cwd.length) : pkg.dir;
        const rel = rawRel.replaceAll("\\", "/").replace(/^\/+/, "");

        dirToPkg.set(rel, pkg.name);
    }

    const findPackageForFile = (file: string): string | undefined => {
        for (const [dir, name] of dirToPkg) {
            if (file.startsWith(`${dir}/`) || file === `${dir}/package.json`) {
                return name;
            }
        }

        return undefined;
    };

    // Walk commits in fromRef..HEAD with a SINGLE git log invocation.
    // Each commit's subject + body + changed files is delimited by a
    // sentinel so we can parse without N+1 git calls. Was: 2 git calls
    // per commit (50 commits → 100 git invocations); now: 1 total.
    //
    // Sentinels include random hex (per-process) so a commit body that
    // legitimately contains the literal string "@@VIS_RELEASE_COMMIT@@"
    // can't accidentally split a record. Belt + suspenders.
    // eslint-disable-next-line sonarjs/pseudo-random -- non-cryptographic sentinel salt to avoid commit-body collisions
    const sentinelSalt = Math.random().toString(16).slice(2, 10);
    const SENTINEL_COMMIT = `@@VIS_RELEASE_COMMIT_${sentinelSalt}@@`;
    const SENTINEL_FILES = `@@VIS_RELEASE_FILES_${sentinelSalt}@@`;
    const log = await runner.run("git", ["log", `${fromRef}..HEAD`, `--pretty=format:${SENTINEL_COMMIT}%n%H%n%s%n%b%n${SENTINEL_FILES}`, "--name-only"], {
        cwd,
        silent: true,
    });

    if (log.exitCode !== 0) {
        return { error: `git log failed: ${log.stderr}`, fromRef, ignoredCommits: 0, notes, status: "failed", warnings };
    }

    const bumps = new Map<string, BumpLevel>();
    const subjects: string[] = [];

    const commits: CommitRecord[] = [];
    const sections = log.stdout
        .split(SENTINEL_COMMIT)
        .map((s) => s.trim())
        .filter(Boolean);

    for (const section of sections) {
        const [filesPart, headerPart = ""] = section.split(SENTINEL_FILES).toReversed();
        const headerLines = headerPart.split("\n");
        const hash = headerLines[0]?.trim() ?? "";
        // Trim the subject to its first line — multi-semantic-release
        // release commits carry a LITERAL `\n\n`-joined changelog header
        // in the subject, which git reports as one physical line.
        const subject = normalizeCommitSubject(headerLines[1] ?? "");
        const body = headerLines.slice(2).join("\n").trim();
        const files = (filesPart ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);

        if (hash) {
            commits.push({ body, files, hash, subject });
        }
    }

    // Drop machine-authored release commits (and any operator-configured
    // `ignoreCommitPattern`) BEFORE revert resolution and bump mapping —
    // a package whose only commits in the range are its own release
    // commits must not get a bump, and the previous changelog header
    // must never be transcribed into the new entry.
    const matchers = buildIgnoreCommitMatchers({
        ignoreCommitPattern: config.ignoreCommitPattern,
        ignoreReleaseCommits: config.ignoreReleaseCommits,
        onInvalidPattern: (source, error) => {
            warnings.push(`Ignoring invalid release.ignoreCommitPattern entry ${JSON.stringify(source)}: ${error.message}`);
        },
    });
    const kept = commits.filter((commit) => !isIgnoredCommit(commit.subject, matchers));
    const ignoredCommits = commits.length - kept.length;

    if (ignoredCommits > 0) {
        notes.push(`Skipped ${ignoredCommits} release/ignored commit(s) in ${fromRef}..HEAD.`);
    }

    // Resolve revert pairs (release-please #296 parity). Commits whose
    // revert lands inside the same fromRef..HEAD window get marked
    // `cancelled` and contribute neither to the bump map nor the
    // changelog subject list.
    const { commits: annotated, warnings: revertWarnings } = annotateAndResolveReverts(kept, undefined, `${fromRef}..HEAD`);

    // F19: surface warnings produced during revert annotation (e.g. the
    // no-type-ratio warning) so operators with no observability into
    // "100 commits had no type" notice their team is shipping commits
    // without conventional-commits prefixes.
    warnings.push(...revertWarnings);

    for (const { cancelled, files, parsed, subject } of annotated) {
        if (cancelled) {
            continue;
        }

        let level: BumpLevel = "patch";

        if (parsed.breaking) {
            level = "major";
        } else if (parsed.type && CC_TYPE_TO_BUMP[parsed.type]) {
            level = CC_TYPE_TO_BUMP[parsed.type] ?? "patch";
        }

        // Map by scope first, then by file paths from the same commit.
        const targets = new Set<string>();

        if (parsed.scope) {
            for (const pkg of packages) {
                if (pkg.name === parsed.scope || pkg.name.endsWith(`/${parsed.scope}`)) {
                    targets.add(pkg.name);
                }
            }
        }

        if (targets.size === 0) {
            for (const file of files) {
                const owner = findPackageForFile(file);

                if (owner) {
                    targets.add(owner);
                }
            }
        }

        for (const target of targets) {
            const existing = bumps.get(target);

            bumps.set(target, existing ? maxBump(existing, level) : level);
        }

        if (targets.size > 0) {
            subjects.push(`- ${subject}`);
        }
    }

    if (bumps.size === 0) {
        notes.push("No commits affected workspace packages — nothing to generate.");

        return { bumps, fromRef, ignoredCommits, notes, status: "no-changes", warnings };
    }

    const payload: ChangeFileSimple = { bumps: Object.fromEntries(bumps) };
    const body = subjects.length > 0 ? subjects.join("\n") : "Auto-generated change file.";
    const content = formatChangeFile(payload, body);

    if (options.dryRun) {
        return { bumps, content, fromRef, ignoredCommits, notes, status: "dry-run", warnings };
    }

    const changesDir = config.changesDir ?? DEFAULT_CHANGES_DIR;
    const slug = (options.name ?? randomAnimalSlug()).replaceAll(/[^a-z0-9-]/gi, "-");
    const filePath = join(cwd, changesDir, `${slug}.md`);

    await fs.mkdir(join(cwd, changesDir), { recursive: true });
    await fs.writeFile(filePath, content);

    return { bumps, content, createdFile: filePath, fromRef, ignoredCommits, notes, status: "written", warnings };
};
