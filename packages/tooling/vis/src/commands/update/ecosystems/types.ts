/**
 * Shared types for non-npm ecosystem updates handled by `vis update`:
 * GitHub Actions, Docker images (Dockerfile + compose), and GitLab CI.
 *
 * The npm/pnpm/bun catalog path has its own `OutdatedEntry` shape in
 * `util/catalog.ts`. We deliberately do NOT reuse it: catalog entries are
 * versioned packages addressed by name; ecosystem entries are file-bound
 * references that need a (file, line) pair to apply back.
 */

export type EcosystemId = "actions" | "docker" | "gitlab";

export type EcosystemUpdateType = "digest" | "major" | "minor" | "patch" | "pin" | "unknown";

/**
 * Compact summary of an OSV advisory matching the currently-pinned ref.
 * Carried alongside the update so the report can flag known-vulnerable
 * versions without forcing every consumer to talk to the advisory DB.
 */
export interface EcosystemAdvisory {
    readonly fixedVersions: string[];
    readonly id: string;
    readonly severity: "CRITICAL" | "HIGH" | "LOW" | "MODERATE" | "UNKNOWN";
    readonly summary: string;
}

/**
 * A single outdated reference inside a workflow / Dockerfile / GitLab CI file.
 * Produced by the per-ecosystem scanner+resolver and consumed by the applier.
 */
export interface EcosystemUpdate {
    /** OSV advisories matching the *currently-pinned* ref. Populated when the local advisory DB is present. */
    readonly advisories?: EcosystemAdvisory[];
    /** Current ref as written in the file. Includes tag, branch, or full SHA. */
    readonly currentRef: string;
    /** Human-readable current version (tag or `-` when only a SHA is present). */
    readonly currentVersion: string | undefined;
    /** Ecosystem this entry belongs to. */
    readonly ecosystem: EcosystemId;
    /** Absolute path to the file the reference lives in. */
    readonly file: string;
    /** Set when the entry was filtered out by ignore comments / config and only kept for reporting. */
    readonly ignored?: boolean;
    /** 1-based line number for diagnostics; the applier still rewrites by-content. */
    readonly line: number;
    /** Identifier the user sees: e.g. `actions/checkout`, `node`, `gitlab.com/group/project`. */
    readonly name: string;
    /** Resolved newer ref. May be a SHA when `style === "sha"`. */
    readonly newRef: string;
    /** Human-readable target version (tag the new ref resolves to). */
    readonly newVersion: string | undefined;
    /** Original full token as it appeared in the file, used for exact replacement. */
    readonly original: string;
    /** Human-readable reason for `ignored` / `updateType === "unknown"`. */
    readonly reason?: string;
    /** Replacement token to write back (may include a trailing `# vN.M.P` comment). */
    readonly replacement: string;
    /** Best-effort classification used for grouping + colorisation. */
    readonly updateType: EcosystemUpdateType;
    /** Optional URL pointing to release notes / changelog / repo. */
    readonly url?: string;
}

/**
 * Aggregate ecosystem-update result returned by the top-level orchestrator.
 * Mirrors the catalog-path return shape so the handler can format both with
 * the same code paths.
 */
export interface EcosystemUpdateResult {
    /** Files that couldn't be parsed (yaml errors, IO failures, …). */
    readonly failed: { file: string; reason: string }[];
    /** Entries filtered out by ignore comments, dependabot/renovate config, or `--exclude` patterns. */
    readonly ignored: EcosystemUpdate[];
    /** Number of ecosystems that had matching files. Used to short-circuit the report when zero. */
    readonly scanned: number;
    readonly updates: EcosystemUpdate[];
}

/**
 * User-facing options for the ecosystem updaters. Mirrors actions-up's
 * surface plus the union of Docker / GitLab options.
 */
export interface EcosystemUpdateOptions {
    /** Per-ecosystem opt-outs. Used by `--no-actions` / `--no-docker` / `--no-gitlab`. */
    readonly disabled: Set<EcosystemId>;
    /** Glob/regex patterns to exclude. Each pattern is matched against `name`. */
    readonly exclude: string[];
    /** GitHub token override (falls back to `GITHUB_TOKEN` env). */
    readonly githubToken: string | undefined;
    /** GitLab token override (falls back to `GITLAB_TOKEN`/`CI_JOB_TOKEN`). */
    readonly gitlabToken: string | undefined;
    /** Glob/regex patterns to include (when set, only matches pass). */
    readonly include: string[];
    /** Include branch references for actions (default: skip). */
    readonly includeBranches: boolean;
    /** Cap on concurrent registry / API requests. */
    readonly maxConcurrentRequests: number;
    /** Skip updates younger than N days (release-age gate). */
    readonly minAgeDays: number | undefined;
    /** Restrict updates to a semver step. `latest` (default) allows any newer ref. */
    readonly mode: "latest" | "minor" | "patch";
    /** Respect ignore directives loaded from dependabot/renovate config. */
    readonly respectDependabotConfig: boolean;
    /** Reference style for GitHub Actions: `sha` pins to full commit SHA, `preserve` keeps the existing style. */
    readonly style: "preserve" | "sha";
}
