import { execFileSync } from "node:child_process";

/**
 * A predicate clause that can match a single value, a list of values
 * (any-of), or — for env vars only — a `{ name, equals?, exists? }`
 * triplet. `not.*` mirrors of every clause provide a negative form
 * without having to wrap the whole `when` in a compound expression.
 *
 * Examples:
 *   `os: "linux"`              — runs only on linux
 *   `os: ["linux", "darwin"]`  — runs on linux or macOS
 *   `not.os: "windows"`        — runs everywhere except windows
 *   `env: "CI"`                — runs only when `process.env.CI` is truthy
 *   `env: { name: "NODE_ENV", equals: "production" }`
 *   `branch: ["main", "alpha"]`
 *   `ci: true`                 — runs only inside CI
 */
export interface WhenCondition {
    /** Match against the current git branch (HEAD). */
    branch?: string | string[];

    /**
     * Run only when invoked inside CI when `true`, only outside CI
     * when `false`. Detects CI via the `CI` env var (the convention
     * GitHub Actions, GitLab, CircleCI, Jenkins, etc. all share).
     */
    ci?: boolean;

    /**
     * Match against environment variables. A bare string asserts the
     * variable is set and non-empty; the object form lets you match
     * an exact value or just assert presence/absence.
     */
    env?: EnvMatcher | EnvMatcher[];

    /** Negative mirrors. A task runs only when *all* `not.*` clauses fail. */
    not?: {
        branch?: string | string[];
        ci?: boolean;
        env?: EnvMatcher | EnvMatcher[];
        os?: NodePlatform | NodePlatform[];
    };

    /**
     * Match `process.platform` (`"linux" | "darwin" | "win32" | "freebsd"
     * | "openbsd" | "sunos" | "aix"`). Pass `"windows"` as an alias for
     * `"win32"` — easier to remember and matches what people type.
     */
    os?: NodePlatform | NodePlatform[];
}

/**
 * An environment-variable match. The string form is shorthand for
 * `{ name, exists: true }` (set + non-empty). The object form
 * supports either presence assertions or exact-value matching.
 */
export type EnvMatcher
    = | string
        | {
            /** Match this exact value. Mutually exclusive with `exists`. */
            equals?: string;
            /** Assert the variable is set & non-empty (`true`) or unset/empty (`false`). */
            exists?: boolean;
            /** Variable name. */
            name: string;
        };

/** Aliased platform list — `"windows"` is sugar for Node's `"win32"`. */
export type NodePlatform = "aix" | "darwin" | "freebsd" | "linux" | "openbsd" | "sunos" | "windows" | "win32";

/**
 * Inputs for {@link evaluateWhen}. Pulled into a struct so tests can
 * inject deterministic values and CLIs can reuse the same env/branch
 * lookup across many task evaluations.
 */
export interface WhenContext {
    /** Current git branch. Pass an empty string when not in a repo. */
    branch?: string;
    /** Whether we're inside CI. Defaults to `process.env.CI` truthy check. */
    ci?: boolean;
    /** Environment variables to match against. Defaults to `process.env`. */
    env?: Record<string, string | undefined>;
    /** Platform string. Defaults to `process.platform`. */
    platform?: NodePlatform;
}

const normalisePlatform = (value: NodePlatform): NodePlatform => (value === "windows" ? "win32" : value);

const matchPlatform = (clause: NodePlatform | NodePlatform[], current: NodePlatform): boolean => {
    const list = Array.isArray(clause) ? clause : [clause];

    return list.some((p) => normalisePlatform(p) === normalisePlatform(current));
};

const matchBranch = (clause: string | string[], current: string): boolean => {
    if (current === "") {
        return false;
    }

    const list = Array.isArray(clause) ? clause : [clause];

    return list.includes(current);
};

const matchSingleEnv = (matcher: EnvMatcher, env: Record<string, string | undefined>): boolean => {
    if (typeof matcher === "string") {
        const value = env[matcher];

        return value !== undefined && value !== "";
    }

    const value = env[matcher.name];

    if (matcher.equals !== undefined) {
        return value === matcher.equals;
    }

    if (matcher.exists !== undefined) {
        const present = value !== undefined && value !== "";

        return matcher.exists ? present : !present;
    }

    // No criteria specified — treat as a presence check.
    return value !== undefined && value !== "";
};

const matchEnv = (clause: EnvMatcher | EnvMatcher[], env: Record<string, string | undefined>): boolean => {
    const list = Array.isArray(clause) ? clause : [clause];

    return list.some((m) => matchSingleEnv(m, env));
};

const detectCi = (env: Record<string, string | undefined>): boolean => {
    const value = env.CI;

    return value !== undefined && value !== "" && value !== "false" && value !== "0";
};

/**
 * Reads the current git branch by spawning `git`. Returns an empty
 * string when git fails (not a repo, detached HEAD, missing binary).
 * Results are cached per `cwd` so a long-running process that
 * touches multiple workspaces (e.g. the test suite) doesn't leak
 * one workspace's branch into another's evaluation.
 */
const branchCache = new Map<string, string>();

export const getCurrentBranch = (cwd: string): string => {
    const cached = branchCache.get(cwd);

    if (cached !== undefined) {
        return cached;
    }

    try {
        const out = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, stdio: ["ignore", "pipe", "ignore"] });
        let branch = out.toString("utf8").trim();

        if (branch === "HEAD") {
            branch = "";
        }

        branchCache.set(cwd, branch);

        return branch;
    } catch {
        branchCache.set(cwd, "");

        return "";
    }
};

/** Test-only escape hatch — clears every cached branch result. */
export const resetBranchCache = (): void => {
    branchCache.clear();
};

/**
 * Evaluates a {@link WhenCondition} against the supplied context (or the
 * live process state when omitted). Returns `true` when the task should
 * run, `false` when every positive clause matches and every `not.*`
 * clause is also satisfied.
 *
 * Semantics:
 *   - All positive clauses must match (AND).
 *   - All `not.*` clauses must not match (AND).
 *   - Within a single clause, an array means any-of (OR).
 *   - An empty/undefined `when` always returns `true`.
 */
export const evaluateWhen = (when: WhenCondition | undefined, context: WhenContext = {}): boolean => {
    if (!when) {
        return true;
    }

    const env = context.env ?? (process.env as Record<string, string | undefined>);
    const currentPlatform = context.platform ?? (process.platform as NodePlatform);
    const branch = context.branch ?? "";
    const ci = context.ci ?? detectCi(env);

    if (when.os !== undefined && !matchPlatform(when.os, currentPlatform)) {
        return false;
    }

    if (when.env !== undefined && !matchEnv(when.env, env)) {
        return false;
    }

    if (when.branch !== undefined && !matchBranch(when.branch, branch)) {
        return false;
    }

    if (when.ci !== undefined && when.ci !== ci) {
        return false;
    }

    if (when.not) {
        if (when.not.os !== undefined && matchPlatform(when.not.os, currentPlatform)) {
            return false;
        }

        if (when.not.env !== undefined && matchEnv(when.not.env, env)) {
            return false;
        }

        if (when.not.branch !== undefined && matchBranch(when.not.branch, branch)) {
            return false;
        }

        if (when.not.ci !== undefined && when.not.ci === ci) {
            return false;
        }
    }

    return true;
};

/**
 * Returns a short human-readable explanation of why a `when` clause
 * skipped a task. Used by lifecycle handlers to print diagnostics.
 * Returns an empty string when the condition evaluates to true.
 */
export const explainWhen = (when: WhenCondition | undefined, context: WhenContext = {}): string => {
    if (!when || evaluateWhen(when, context)) {
        return "";
    }

    const env = context.env ?? (process.env as Record<string, string | undefined>);
    const currentPlatform = context.platform ?? (process.platform as NodePlatform);
    const branch = context.branch ?? "";
    const ci = context.ci ?? detectCi(env);

    const reasons: string[] = [];

    if (when.os !== undefined && !matchPlatform(when.os, currentPlatform)) {
        reasons.push(`os=${currentPlatform} does not match ${JSON.stringify(when.os)}`);
    }

    if (when.env !== undefined && !matchEnv(when.env, env)) {
        reasons.push(`env clause did not match`);
    }

    if (when.branch !== undefined && !matchBranch(when.branch, branch)) {
        reasons.push(`branch=${branch || "(unknown)"} does not match ${JSON.stringify(when.branch)}`);
    }

    if (when.ci !== undefined && when.ci !== ci) {
        reasons.push(`ci=${ci} does not match required ci=${when.ci}`);
    }

    if (when.not?.os !== undefined && matchPlatform(when.not.os, currentPlatform)) {
        reasons.push(`os=${currentPlatform} matches excluded ${JSON.stringify(when.not.os)}`);
    }

    if (when.not?.env !== undefined && matchEnv(when.not.env, env)) {
        reasons.push(`env clause matches excluded matcher`);
    }

    if (when.not?.branch !== undefined && matchBranch(when.not.branch, branch)) {
        reasons.push(`branch=${branch} matches excluded ${JSON.stringify(when.not.branch)}`);
    }

    if (when.not?.ci !== undefined && when.not.ci === ci) {
        reasons.push(`ci=${ci} matches excluded ci=${when.not.ci}`);
    }

    return reasons.join("; ");
};
