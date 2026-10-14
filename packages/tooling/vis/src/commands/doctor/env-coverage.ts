/**
 * Env coverage for `vis doctor`.
 *
 * A target's command can read an environment variable that no cache-key
 * source covers. That variable can change the output without changing the
 * key, so the cache serves a stale result. This check lists those names per
 * target, with the config keys that would cover them.
 *
 * It reads the same configuration `vis run` hashes with and spawns nothing.
 * Only declared hashing is checked: trace-mode targets track env through
 * syscalls, and a target that is never cached has no key to go stale.
 */
import { join } from "@visulima/path";
import type { NamedInputs } from "@visulima/task-runner";
import {
    CLEAN_ENV_BASE_NAMES,
    CLEAN_ENV_POSIX_NAMES,
    CLEAN_ENV_WIN32_NAMES,
    createEnvMatcher,
    DEFAULT_UNTRACKED_ENV_PATTERNS,
    detectFrameworks,
    extractReferencedEnvVars,
    looksLikeInputUri,
    parseInputUri,
    resolveChildEnvPolicy,
} from "@visulima/task-runner";

import type { VisConfig } from "../../config/workspace";
import { discoverWorkspace, loadVisTaskConfigsForWorkspace } from "../../config/workspace";
import { discoverWorkspacePackages } from "../optimize/handler";
import { cleanChildNameFilter, VIS_PARENT_ENV_NAMES, VIS_TASK_INJECTED_NAMES } from "../run/task-env";

/** Uncovered names listed per target before the rest are counted as `total`. */
export const ENV_COVERAGE_NAME_LIMIT = 8;

export type EnvCoverageHint = "autoEnvVars" | "fingerprintEnv" | "untrackedEnv";

export interface EnvCoverageTarget {
    /** Config keys that would cover the listed names. */
    hints: EnvCoverageHint[];
    /** `project:target`. */
    target: string;
    /** Every uncovered name, including those past {@link ENV_COVERAGE_NAME_LIMIT}. */
    total: number;
    /** Uncovered names, sorted and capped. */
    variables: string[];
}

export interface EnvCoveragePosture {
    status: "ok" | "warn";
    targets: EnvCoverageTarget[];
}

export interface EnvCoverage {
    /** Whether `autoEnvVars` keys the `$NAME` / `${NAME}` references. */
    autoEnvVars: boolean;
    /** Whether a pattern source covers the name: `fingerprintEnv`, framework prefixes. */
    coveredByPattern: (name: string) => boolean;
    /** Names the key covers exactly: workspace `envVars` / `globalEnv`, `env://` inputs. */
    exact: ReadonlySet<string>;
    /** Names the run keeps out of the key on purpose: untracked, built-in, vis-owned. */
    excluded: (name: string) => boolean;
    /** Names the task's child can see. A hidden name cannot change the output. */
    visible: (name: string) => boolean;
}

export interface EnvCoverageGap {
    name: string;
    /** Only written as `$NAME`, so `autoEnvVars` would cover it. */
    shellOnly: boolean;
}

/** Names vis, the spawner and CI set for every child. Never a key gap. */
const VIS_OWNED = createEnvMatcher([
    ...CLEAN_ENV_BASE_NAMES,
    ...CLEAN_ENV_POSIX_NAMES,
    ...CLEAN_ENV_WIN32_NAMES,
    ...VIS_PARENT_ENV_NAMES,
    ...Object.keys(VIS_TASK_INJECTED_NAMES),
    "VIS_*",
]);

/**
 * `%NAME%` references (cmd.exe). The task-runner extractor only reads `$`
 * forms, so this pass is local. The name needs two characters and no
 * neighbouring `%` or word character, which keeps date formats such as
 * `%Y%m%d` out. Known false positive: `%FT%T` (a date format) still matches
 * because the name is two characters.
 */
const WINDOWS_REFERENCE = /(?<![\w%])%([A-Z_]\w+)%(?![\w%])/gi;

export const extractWindowsEnvVars = (command: string): string[] => [...new Set([...command.matchAll(WINDOWS_REFERENCE)].map((match) => match[1] as string))];

/**
 * Names in `command` that the key does not cover. A name is a gap when it is
 * written as `%NAME%` (never auto-keyed), or as `$NAME` with `autoEnvVars` off,
 * and no exact or pattern source, untracked rule or clean-mode filter applies.
 */
export const findEnvCoverageGaps = (command: string, coverage: EnvCoverage): EnvCoverageGap[] => {
    const shell = new Set(extractReferencedEnvVars(command));
    const windows = new Set(extractWindowsEnvVars(command));
    const gaps: EnvCoverageGap[] = [];

    for (const name of new Set([...shell, ...windows])) {
        if (coverage.excluded(name) || !coverage.visible(name) || coverage.exact.has(name) || coverage.coveredByPattern(name)) {
            continue;
        }

        if (windows.has(name) || (shell.has(name) && !coverage.autoEnvVars)) {
            gaps.push({ name, shellOnly: !windows.has(name) });
        }
    }

    return gaps;
};

/**
 * Env names an `inputs` list reads through `env://NAME` (or an `{ env }`
 * object), following named inputs the same way the hasher expands them.
 */
const envInputNames = (inputs: ReadonlyArray<unknown>, namedInputs: NamedInputs, seen: Set<string> = new Set()): string[] => {
    const names: string[] = [];

    for (const input of inputs) {
        if (typeof input === "string") {
            if (looksLikeInputUri(input)) {
                let parsed: ReturnType<typeof parseInputUri>;

                try {
                    parsed = parseInputUri(input);
                } catch {
                    // A malformed URI fails the run itself; the doctor only reports coverage.
                    continue;
                }

                if (parsed && "env" in parsed) {
                    names.push(parsed.env);
                }
            } else if (namedInputs[input] && !seen.has(input)) {
                seen.add(input);
                names.push(...envInputNames(namedInputs[input], namedInputs, seen));
            }
        } else if (typeof input === "object" && input !== null && "env" in input && typeof input.env === "string") {
            names.push(input.env);
        }
    }

    return names;
};

const frameworkEnvPatterns = async (packageJsonPath: string): Promise<string[]> => {
    const frameworks = await detectFrameworks(packageJsonPath);

    return frameworks.flatMap((framework) => framework.envPrefixes.map((prefix) => `${prefix}*`));
};

/** `a, b or c`, the fix hints on one env-coverage line. */
const joinHints = (hints: ReadonlyArray<EnvCoverageHint>): string => (hints.length <= 1 ? hints.join("") : `${hints.slice(0, -1).join(", ")} or ${hints.at(-1)}`);

/** One human line for a target: its uncovered names, then the keys that cover them. */
export const describeEnvCoverageTarget = (target: EnvCoverageTarget): string => {
    const omitted = target.total - target.variables.length;
    const more = omitted > 0 ? ` (+${String(omitted)} more)` : "";

    return `${target.target}: ${target.variables.join(", ")}${more}. fix: ${joinHints(target.hints)}`;
};

const toTarget = (target: string, gaps: ReadonlyArray<EnvCoverageGap>): EnvCoverageTarget => {
    const hints: EnvCoverageHint[] = ["fingerprintEnv"];

    if (gaps.some((gap) => gap.shellOnly)) {
        hints.push("autoEnvVars");
    }

    hints.push("untrackedEnv");

    return {
        hints,
        target,
        total: gaps.length,
        variables: gaps
            .map((gap) => gap.name)
            .toSorted()
            .slice(0, ENV_COVERAGE_NAME_LIMIT),
    };
};

/**
 * Builds the workspace's env coverage. Workspace discovery is the same pass
 * `vis run` makes, so the targets, their merged fields and their clean-env
 * policy match what the hasher sees.
 */
export const buildEnvCoveragePosture = async (config: VisConfig, workspaceRoot: string): Promise<EnvCoveragePosture> => {
    const runner = config.taskRunner ?? {};
    const targets: EnvCoverageTarget[] = [];

    // `autoFingerprint` routes every task through syscall tracking, so no
    // declared key exists to check.
    if (runner.autoFingerprint === true) {
        return { status: "ok", targets };
    }

    // Without a workspace there are no targets. `discoverWorkspace` would
    // throw here, and doctor has to run in a plain single-package repo too.
    if (discoverWorkspacePackages(workspaceRoot).length === 0) {
        return { status: "ok", targets };
    }

    const { projectOptions, workspace } = discoverWorkspace(workspaceRoot, config, await loadVisTaskConfigsForWorkspace(workspaceRoot));
    const workspaceExact = [...(runner.envVars ?? []), ...(runner.globalEnv ?? [])];
    const workspaceUntracked = [...DEFAULT_UNTRACKED_ENV_PATTERNS, ...(runner.untrackedEnvVars ?? [])];
    const namedInputs = config.namedInputs ?? {};

    for (const [projectName, projectTargets] of projectOptions) {
        const project = workspace.projects[projectName];

        if (!project) {
            continue;
        }

        const frameworkPatterns = runner.frameworkInference ? await frameworkEnvPatterns(join(workspaceRoot, project.root, "package.json")) : [];

        for (const [targetName, target] of Object.entries(projectTargets)) {
            // Trace-mode targets track env through syscalls, and an uncached
            // target has no key that can go stale.
            if (target.hashMode === "trace" || target.cache === false || target.always === true) {
                continue;
            }

            // Mirrors the hasher: the target's own field wins, the workspace
            // default fills in when the target has none.
            const command = target.command ?? runner.targetDefaults?.[targetName]?.command;

            if (typeof command !== "string" || command.length === 0) {
                continue;
            }

            const inputs: ReadonlyArray<unknown> = target.inputs ?? runner.targetDefaults?.[targetName]?.inputs ?? [];
            const policy = resolveChildEnvPolicy(runner.env, target.options?.env);
            const isUntracked = createEnvMatcher([...workspaceUntracked, ...(target.untrackedEnv ?? [])]);

            const gaps = findEnvCoverageGaps(command, {
                autoEnvVars: runner.autoEnvVars === true,
                coveredByPattern: createEnvMatcher([...(target.fingerprintEnv ?? []), ...frameworkPatterns]),
                exact: new Set([...workspaceExact, ...envInputNames(inputs, namedInputs)]),
                excluded: (name) => VIS_OWNED(name) || isUntracked(name),
                visible: policy.mode === "clean" ? cleanChildNameFilter(policy.allow) : () => true,
            });

            if (gaps.length > 0) {
                targets.push(toTarget(`${projectName}:${targetName}`, gaps));
            }
        }
    }

    targets.sort((a, b) => a.target.localeCompare(b.target));

    return { status: targets.length > 0 ? "warn" : "ok", targets };
};
