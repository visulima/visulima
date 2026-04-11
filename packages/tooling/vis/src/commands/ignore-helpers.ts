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

/** Whitelist for git refs passed to `git` — prevents command injection. */
const GIT_REF_RE = /^[\w.\-/~^@{}]+$/;

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

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Returns the first non-empty value from the CI env var priority list,
 * or `undefined` if nothing is set. Reads from `env` (defaults to
 * `process.env`) so tests can inject fixtures without clobbering globals.
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
 * alphabet. Mirrors the validation used by task-runner's affected logic.
 */
const validateGitRef = (ref: string): void => {
    if (!GIT_REF_RE.test(ref)) {
        throw new Error(`Invalid git ref: "${ref}". Only alphanumeric characters, dots, dashes, underscores, slashes, tildes, carets, and @ are allowed.`);
    }
};

/**
 * Returns `true` if `ref` resolves to a commit object in the given repo.
 * Used to detect unreachable base refs (e.g. Vercel's shallow clone) so
 * we can silently fall back to `HEAD~1`.
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
 * Returns `true` if the commit message contains any skip token,
 * including the per-project form `[vis skip &lt;project>]`. Accepts both
 * `vis` and legacy `nx` tokens so users migrating from nx-ignore don't
 * need to rewrite their commit automation.
 */
const commitHasSkipMessage = (message: string, project: string): boolean =>
    SKIP_TOKENS.some((token) => message.includes(token))
    || message.includes(`[vis skip ${project}]`)
    || message.includes(`[nx skip ${project}]`);

/**
 * Returns `true` if the commit message contains any force-deploy token,
 * including the per-project form `[vis deploy &lt;project>]`.
 */
const commitHasForceDeployMessage = (message: string, project: string): boolean =>
    FORCE_TOKENS.some((token) => message.includes(token))
    || message.includes(`[vis deploy ${project}]`)
    || message.includes(`[nx deploy ${project}]`);

/**
 * Renders a decision as a single human-readable line. Pure formatter;
 * doesn't print anything itself.
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
    exitCodeFor,
    FORCE_TOKENS,
    formatDecisionLine,
    isRefReachable,
    readLastCommitMessage,
    resolveCiBaseSha,
    SKIP_TOKENS,
    validateGitRef,
};
