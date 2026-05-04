/**
 * Pure helpers for `vis ignore`. Split from `ignore.ts` so tests can
 * exercise them without pulling in `@visulima/task-runner`, which
 * otherwise drags the whole run-graph module through ESM evaluation.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ─── Constants ───────────────────────────────────────────────────────

/** Commit-message tokens that unconditionally skip the build. */
const SKIP_TOKENS = ["[skip ci]", "[ci skip]", "[no ci]", "[vis skip]", "[nx skip]"] as const;

/** Commit-message tokens that unconditionally force the build. */
const FORCE_TOKENS = ["[vis deploy]", "[nx deploy]"] as const;

/**
 * Token prefixes accepted for per-project commit-message gating. `vis` is
 * the canonical form; `nx` is kept so teams migrating from `nx-ignore`
 * don't have to rewrite their commit automation.
 */
const PER_PROJECT_TOKEN_PREFIXES = ["vis", "nx"] as const;

/**
 * CI-provider environment variables carrying the previously deployed SHA,
 * probed in priority order. Only providers that *actually* invoke a custom
 * ignore script (Vercel, Netlify) or that we commonly wrap manually in a
 * preflight CI step (GitHub Actions, GitLab CI) are listed here.
 *
 * Cloudflare Pages / Render / Amplify are intentionally absent: they have
 * no custom-command hook, so shipping env detection for them would only
 * create the illusion of support.
 */
const CI_BASE_SHA_ENV_VARS = [
    "CACHED_COMMIT_REF", // Netlify
    "VERCEL_GIT_PREVIOUS_SHA", // Vercel
    "GITHUB_BASE_REF", // GitHub Actions (PRs; ref name, not SHA — validated below)
    "CI_COMMIT_BEFORE_SHA", // GitLab CI
] as const;

/**
 * Whitelist for git refs passed to `git` — prevents command injection.
 * Requires the first character to be non-dash so values like `--help` or
 * `--base=main` cannot masquerade as git options when passed positionally
 * to `git rev-parse` / `git diff`.
 *
 * NOTE: This is intentionally mirrored in
 * `packages/tooling/task-runner/src/affected.ts` (`validateGitRef`). If
 * you change the regex or error message here, update the mirror too —
 * `ignore-helpers.ts` cannot import from `@visulima/task-runner` without
 * pulling the whole run-graph module through ESM evaluation, which would
 * break test isolation for `vitest run __tests__/ignore.test.ts`.
 */
const GIT_REF_RE = /^[\w./~^@{}][\w.\-/~^@{}]*$/;

// ─── Types ───────────────────────────────────────────────────────────

/** Machine-readable reason codes for the ignore decision. */
type IgnoreReason
    = | "commit-force-deploy"
        | "commit-skip"
        | "missing-project-argument"
        | "no-changes"
        | "project-affected"
        | "project-not-affected"
        | "project-unknown"
        | "workspace-error";

/**
 * Structured decision record emitted on stdout in `--json` mode and
 * rendered as human text otherwise.
 */
interface IgnoreDecision {
    /** "build" continues the deployment, "skip" cancels it. */
    action: "build" | "skip";
    /** The affected-project list, when the comparison actually ran. */
    affectedProjects?: string[];
    /** Base ref used for the affected comparison, if any. */
    base?: string;
    /** Head ref used for the affected comparison, if any. */
    head?: string;
    /** Human-readable reason message. */
    message: string;
    /** The project the decision applies to. */
    project: string;
    /** Stable reason code for scripting / analytics. */
    reason: IgnoreReason;
}

/** Extra fields that decisions from the affected-detection path carry. */
type DecisionExtras = Partial<Pick<IgnoreDecision, "affectedProjects" | "base" | "head">>;

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Returns the first non-empty value from the CI env var priority list,
 * or `undefined` if nothing is set. Reads from `env` (defaults to
 * `process.env`) so tests can inject fixtures without clobbering globals.
 * @param env Environment dictionary to probe. Defaults to `process.env`.
 * @returns The resolved base SHA (trimmed) or `undefined` if no known CI env var is set.
 */
const resolveCiBaseSha = (env: NodeJS.ProcessEnv = process.env): string | undefined => {
    for (const name of CI_BASE_SHA_ENV_VARS) {
        const value = env[name];

        if (value && value.trim().length > 0) {
            return value.trim();
        }
    }

    return undefined;
};

/**
 * Throws if the given string contains characters outside the safe git-ref
 * alphabet or begins with a dash. Mirrors the validation used by
 * task-runner's affected logic and additionally rejects leading dashes to
 * prevent `git` option injection when the ref is passed as a positional
 * argument to `execFile("git", [...])`.
 * @param ref The git ref to validate (e.g. `"HEAD"`, `"main"`, `"abc123"`).
 * @throws {Error} If `ref` does not match `GIT_REF_RE`. Returns `void` on success.
 */
const validateGitRef = (ref: string): void => {
    if (!GIT_REF_RE.test(ref)) {
        throw new Error(
            `Invalid git ref: "${ref}". Refs must start with an alphanumeric character or one of _ . / ~ ^ @ { } and may only contain letters, digits, dots, dashes, underscores, slashes, tildes, carets, @, and braces.`,
        );
    }
};

/**
 * Returns `true` if `ref` resolves to a commit object in the given repo.
 * Used to detect unreachable base refs (e.g. Vercel's shallow clone) so
 * we can silently fall back to `HEAD~1`.
 * @param cwd Absolute path to the git repository's working directory.
 * @param ref The git ref to probe. Should already be validated by `validateGitRef` to avoid `git` option injection.
 * @returns `true` if the ref resolves to a commit, `false` otherwise (including when `git` itself fails or is unavailable).
 */
const isRefReachable = async (cwd: string, ref: string): Promise<boolean> => {
    try {
        await execFileAsync("git", ["rev-parse", "--verify", `${ref}^{commit}`], { cwd });

        return true;
    } catch {
        return false;
    }
};

/**
 * Reads the subject+body of the most recent commit. Returns an empty
 * string on any failure — the caller treats missing messages as "no
 * keywords present" rather than erroring out.
 * @param cwd Absolute path to the git repository's working directory.
 * @returns The raw commit message (subject + body), or `""` on failure.
 */
const readLastCommitMessage = async (cwd: string): Promise<string> => {
    try {
        const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%B"], { cwd });

        return stdout;
    } catch {
        return "";
    }
};

/**
 * Returns `true` if the commit message contains a per-project token of
 * the form `[&lt;prefix> &lt;verb> &lt;project>]` for any of the supported
 * prefixes (`vis` or the legacy `nx`).
 * @param message Raw commit message to scan.
 * @param verb The action verb embedded in the token (`"skip"` or `"deploy"`).
 * @param project The project name the token is scoped to.
 * @returns `true` on the first matching token, `false` otherwise.
 */
const matchesPerProjectToken = (message: string, verb: "deploy" | "skip", project: string): boolean =>
    PER_PROJECT_TOKEN_PREFIXES.some((prefix) => message.includes(`[${prefix} ${verb} ${project}]`));

/**
 * Returns `true` if the commit message contains any skip token,
 * including the per-project form `[vis skip &lt;project>]`. Accepts both
 * `vis` and legacy `nx` tokens so users migrating from nx-ignore don't
 * need to rewrite their commit automation.
 * @param message Raw commit message to scan.
 * @param project The project whose per-project tokens should also match.
 * @returns `true` if any skip token is present, `false` otherwise.
 */
const commitHasSkipMessage = (message: string, project: string): boolean =>
    SKIP_TOKENS.some((token) => message.includes(token)) || matchesPerProjectToken(message, "skip", project);

/**
 * Returns `true` if the commit message contains any force-deploy token,
 * including the per-project form `[vis deploy &lt;project>]`.
 * @param message Raw commit message to scan.
 * @param project The project whose per-project tokens should also match.
 * @returns `true` if any force-deploy token is present, `false` otherwise.
 */
const commitHasForceDeployMessage = (message: string, project: string): boolean =>
    FORCE_TOKENS.some((token) => message.includes(token)) || matchesPerProjectToken(message, "deploy", project);

/**
 * Builds a `"build"` decision record. Factory helper that collapses the
 * otherwise-repetitive object literals in `ignore.ts`.
 * @param project The project the decision applies to.
 * @param reason Stable reason code.
 * @param message Human-readable message.
 * @param extra Optional base/head/affectedProjects when available.
 * @returns A fully-populated `IgnoreDecision` with `action: "build"`.
 */
const decideBuild = (project: string, reason: IgnoreReason, message: string, extra?: DecisionExtras): IgnoreDecision => {
    return {
        action: "build",
        message,
        project,
        reason,
        ...extra,
    };
};

/**
 * Builds a `"skip"` decision record. Companion to `decideBuild`.
 * @param project The project the decision applies to.
 * @param reason Stable reason code.
 * @param message Human-readable message.
 * @param extra Optional base/head/affectedProjects when available.
 * @returns A fully-populated `IgnoreDecision` with `action: "skip"`.
 */
const decideSkip = (project: string, reason: IgnoreReason, message: string, extra?: DecisionExtras): IgnoreDecision => {
    return {
        action: "skip",
        message,
        project,
        reason,
        ...extra,
    };
};

/**
 * Renders a decision as a single human-readable line. Pure formatter;
 * doesn't print anything itself.
 * @param decision The decision to format.
 * @returns A one-line string with an emoji prefix and the message.
 */
const formatDecisionLine = (decision: IgnoreDecision): string => {
    const prefix = decision.action === "skip" ? "\u{1F6D1}" : "\u2705";

    return `${prefix} ${decision.message}`;
};

/**
 * Maps a decision to its process exit code, honoring
 * `--exit-zero-on-build` for users who want normal exit semantics.
 *
 *   Default:
 *     skip  → 0 (platform cancels)
 *     build → 1 (platform continues)
 *
 *   With --exit-zero-on-build:
 *     skip  → 0
 *     build → 0
 * @param decision The decision to map.
 * @param exitZeroOnBuild If `true`, builds exit with `0` instead of `1`.
 * @returns The literal exit code (`0` or `1`).
 */
const exitCodeFor = (decision: IgnoreDecision, exitZeroOnBuild: boolean): 0 | 1 => {
    if (decision.action === "skip") {
        return 0;
    }

    return exitZeroOnBuild ? 0 : 1;
};

export type { IgnoreDecision, IgnoreReason };
export {
    CI_BASE_SHA_ENV_VARS,
    commitHasForceDeployMessage,
    commitHasSkipMessage,
    decideBuild,
    decideSkip,
    exitCodeFor,
    FORCE_TOKENS,
    formatDecisionLine,
    isRefReachable,
    matchesPerProjectToken,
    PER_PROJECT_TOKEN_PREFIXES,
    readLastCommitMessage,
    resolveCiBaseSha,
    SKIP_TOKENS,
    validateGitRef,
};
