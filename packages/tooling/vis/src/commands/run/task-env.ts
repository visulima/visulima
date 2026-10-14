import type { ChildEnvOptions, ChildSpawnEnv, Task } from "@visulima/task-runner";
import { buildChildEnv, childEnvNameFilter, resolveChildEnvPolicy } from "@visulima/task-runner";

import type { VisTargetOptions } from "../../task/target-options";
import { loadEnvFile, resolveTaskCwd } from "../../task/target-options";

/** Environment variable that carries the affected file paths (`affectedFiles: "env"` / `"both"`). */
export const AFFECTED_FILES_ENV = "VIS_AFFECTED_FILES";

/** Override key carrying validated `VIS_ARG_*` env vars for the target task. */
export const TASK_ARG_ENV_KEY = "visTaskArgEnv";

/**
 * Names vis writes into its own `process.env`. Every child inherits them under
 * `inherit`. Under `clean` they have to be allowed, or the child loses them
 * without any error. The source scan in `__tests__/commands/run/task-env.test.ts`
 * fails when an assignment is added that is neither listed here nor exempt.
 */
export const VIS_PARENT_ENV_NAMES: ReadonlyArray<string> = [
    // Toolchain activation: the version manager's env output (PATH plus its
    // FNM_* state) is merged into process.env, so the tasks that follow see the
    // activated Node.
    "FNM_*",
    // bin.ts / binx.ts: colour policy for the children.
    "FORCE_COLOR",
    // cli-main.ts: early CA certificate forwarding, read by Node in the child.
    "NODE_EXTRA_CA_CERTS",
    // bin.ts / binx.ts: colour policy for the children.
    "NO_COLOR",
    // cli-main.ts: workspace root, re-read by the plugin config loader in a nested vis.
    "VIS_MONOREPO_ROOT",
    // io/terminal.ts and bin.ts: version exported for child processes.
    "VIS_VERSION",
];

/**
 * Assignments to `process.env` that are not listed above, with the reason.
 * Keyed by the variable name, or by a source path (relative to `src/`) for
 * writes whose names are only known at runtime.
 */
export const VIS_PARENT_ENV_EXEMPT: Readonly<Record<string, string>> = {
    "commands/x/run-file.ts": "`vis x` runs a user script in-process, not a `vis run` task child",
    GIGET_GITLAB_URL: "set and restored inside one in-process download; no task child runs in that window",
    "runtime/augment.ts": "`vis x` .env cascade, applied in-process, not a `vis run` task child",
    "runtime/toolchain.ts": "names come from the version manager's env output at runtime; covered by FNM_* above",
};

/**
 * Variables the run executor sets on every task child. They are overlaid on
 * the clean environment and never filtered, so clean mode cannot drop them.
 * `envFile` values and service env are overlaid too, but they come from the
 * user, so they have no fixed name to list here.
 */
export const VIS_TASK_INJECTED_NAMES: Readonly<Record<string, string>> = {
    INIT_CWD: "the directory `vis run` was invoked from",
    VIS_AFFECTED_FILES: "affected file paths, when `affectedFiles` is `env` or `both`",
    VIS_TASK_SLOTS: "the effective parallelism, for nested worker pools",
};

/** Prefix of the variables that carry validated task arguments (`VIS_ARG_&lt;NAME>`). */
export const VIS_TASK_ARG_PREFIX = "VIS_ARG_";

/** The parts the run merges into a task child's environment. */
export interface TaskEnvParts {
    affectedFilesEnv?: Record<string, string>;
    envFileVars?: Record<string, string>;
    execEnv?: Record<string, string>;
    initCwd: string;
    serviceEnv?: Record<string, string>;
    taskArgEnv?: Record<string, string>;
    taskSlots: number;
}

/**
 * Builds the variables vis injects into one task child. Later sources win on
 * a key collision: service env overrides `envFile`, and the task's own
 * `affectedFiles` and `VIS_ARG_*` values override both.
 */
export const composeTaskEnv = (parts: TaskEnvParts): Record<string, string> => {
    return {
        INIT_CWD: parts.initCwd,
        // Effective parallelism vis grants this run, so child tasks can size their
        // own worker pools instead of assuming the whole machine.
        VIS_TASK_SLOTS: String(parts.taskSlots),
        ...parts.envFileVars,
        // Externally registered service env goes below the task's explicit env,
        // so users can override service-provided defaults without a restart.
        ...parts.serviceEnv,
        ...parts.execEnv,
        ...parts.affectedFilesEnv,
        ...parts.taskArgEnv,
    };
};

/**
 * The child-env policy of one target: the task-runner resolution, with the
 * vis-owned parent names added to a clean allow-list. Hashing and spawning both
 * use this, so a name the child can see is always a name the key covers.
 */
export const effectiveChildEnvPolicy = (workspace?: ChildEnvOptions, target?: ChildEnvOptions): Required<ChildEnvOptions> => {
    const policy = resolveChildEnvPolicy(workspace, target);

    return policy.mode === "clean" ? { allow: [...policy.allow, ...VIS_PARENT_ENV_NAMES], mode: "clean" } : policy;
};

/**
 * Whether a parent variable survives clean mode for a policy. Used for the
 * strict-env check, so an unset-by-clean `$VAR` fails the task instead of
 * expanding to an empty string.
 */
export const cleanChildNameFilter = (
    allow: ReadonlyArray<string>,
    platform: NodeJS.Platform = process.platform,
): ((name: string) => boolean) => childEnvNameFilter({ allow: [...allow, ...VIS_PARENT_ENV_NAMES], mode: "clean" }, platform);

/**
 * How one spawn of a task is launched under its child-env policy. Clean builds
 * the complete environment from the parent (policy-filtered) and the injected
 * entries, and turns parent inheritance off on the spawn. Inherit leaves the
 * spawner's default, which merges the parent env in.
 */
export const taskSpawnOptions = (
    policy: Required<ChildEnvOptions>,
    injected: Record<string, string>,
    platform: NodeJS.Platform = process.platform,
): ChildSpawnEnv => {
    if (policy.mode === "clean") {
        return {
            env: buildChildEnv({ injected, parentEnv: process.env, platform, policy: { allow: policy.allow, mode: "clean" } }),
            inheritEnv: false,
        };
    }

    return { env: injected, inheritEnv: true };
};

/** Returns the visible target options of a task, as the executor reads them. */
export const getTaskOptions = (task: Task): VisTargetOptions | undefined => {
    const options = task.overrides["visOptions"];

    if (options && typeof options === "object") {
        return options;
    }

    return undefined;
};

/**
 * Per-run env-file cache: (cwd, envFileSpec) → parsed env vars.
 * With `envFile: true` or a shared config pointing at one dotenv
 * path, every task would otherwise re-read + re-parse the same file.
 */
type EnvFileCache = Map<string, Record<string, string>>;

const loadEnvFileCached = (cache: EnvFileCache, cwd: string, envFileSpec: NonNullable<VisTargetOptions["envFile"]>): Record<string, string> => {
    const key = `${cwd}\0${typeof envFileSpec === "string" ? envFileSpec : String(envFileSpec)}`;
    const hit = cache.get(key);

    if (hit) {
        return hit;
    }

    const parsed = loadEnvFile(cwd, envFileSpec);

    cache.set(key, parsed);

    return parsed;
};

/**
 * What every spawn of a task in one run shares: the affected files, the
 * policy, the invocation directory, service env and the granted parallelism.
 */
export interface TaskSpawnContext {
    affectedFiles?: string[];
    childEnvPolicy: (task: Task) => Required<ChildEnvOptions>;
    envFileCache: EnvFileCache;
    initCwd: string;
    serviceEnvByTaskId?: ReadonlyMap<string, Record<string, string>>;
    taskSlots: number;
    workspaceRoot: string;
}

/** Creates the per-run spawn context, with its own env-file cache. */
export const createTaskSpawnContext = (input: Omit<TaskSpawnContext, "envFileCache">): TaskSpawnContext => {
    return {
        ...input,
        envFileCache: new Map(),
    };
};

/**
 * The environment one spawn of a task runs with. It is the single place the
 * child environment is built: the executor, the persistent-target launch and
 * the traced run all call it, so they cannot drift apart.
 *
 * `cwd` and `env` mirror the task-runner's `TaskExecutionOptions`. The
 * `envFile` cascade is resolved from the same working directory the child runs in.
 */
export const resolveTaskSpawn = (context: TaskSpawnContext, task: Task, options: { cwd?: string; env?: Record<string, string> } = {}): ChildSpawnEnv => {
    const visOptions = getTaskOptions(task);
    const cwd = resolveTaskCwd(context.workspaceRoot, options.cwd ?? task.projectRoot, visOptions?.runFromWorkspaceRoot === true);

    const envFileVars = visOptions?.envFile ? loadEnvFileCached(context.envFileCache, cwd, visOptions.envFile) : undefined;

    const affectedFilesEnv: Record<string, string> = {};

    if (context.affectedFiles && context.affectedFiles.length > 0 && (visOptions?.affectedFiles === "env" || visOptions?.affectedFiles === "both")) {
        affectedFilesEnv[AFFECTED_FILES_ENV] = context.affectedFiles.join("\n");
    }

    const injected = composeTaskEnv({
        affectedFilesEnv,
        envFileVars,
        execEnv: options.env,
        initCwd: context.initCwd,
        serviceEnv: context.serviceEnvByTaskId?.get(task.id),
        taskArgEnv: task.overrides[TASK_ARG_ENV_KEY] as Record<string, string> | undefined,
        taskSlots: context.taskSlots,
    });

    return taskSpawnOptions(context.childEnvPolicy(task), injected);
};
