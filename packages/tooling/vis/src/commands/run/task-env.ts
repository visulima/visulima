import type { ChildEnvOptions, Task } from "@visulima/task-runner";
import { buildChildEnv, childEnvNameFilter } from "@visulima/task-runner";

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

/** The parts the run executor merges into a task child's environment. */
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

/** Allow-list a clean child gets on top of the policy: the names vis sets on the parent. */
export const cleanChildAllowList = (allow: ReadonlyArray<string>): string[] => [...allow, ...VIS_PARENT_ENV_NAMES];

/**
 * The full environment for a clean task child: the parent names the policy
 * keeps, plus the executor's injected entries laid on top.
 */
export const buildCleanTaskEnv = (options: {
    allow: ReadonlyArray<string>;
    injected: Record<string, string>;
    parentEnv: NodeJS.ProcessEnv;
}): Record<string, string> =>
    buildChildEnv({
        injected: options.injected,
        parentEnv: options.parentEnv,
        policy: { allow: cleanChildAllowList(options.allow), mode: "clean" },
    });

/**
 * Whether a parent variable survives clean mode for a task with `allow`. Used
 * for the strict-env check, so an unset-by-clean `$VAR` fails the task instead
 * of expanding to an empty string.
 */
export const cleanChildNameFilter = (allow: ReadonlyArray<string>): ((name: string) => boolean) =>
    childEnvNameFilter({ allow: cleanChildAllowList(allow), mode: "clean" });

/**
 * Tasks that would run through syscall tracking while their policy is `clean`.
 * Tracked runs bypass the executor that builds the clean environment, so these
 * must fail loudly instead of inheriting. `always` tasks always use the
 * executor, so they are not included.
 */
export const findTrackedCleanTasks = (
    tasks: ReadonlyArray<Task>,
    options: { autoFingerprint: boolean; policyFor: (task: Task) => ChildEnvOptions },
): string[] =>
    tasks
        .filter((task) => !task.always && options.policyFor(task).mode === "clean" && (options.autoFingerprint || task.hashMode === "trace"))
        .map((task) => task.id);

/**
 * How one spawn of a task is launched under its child-env policy. Clean builds
 * the complete environment here and turns parent inheritance off on the spawn.
 * Inherit leaves the spawner's default, which merges the parent env in.
 */
export const taskSpawnOptions = (policy: Required<ChildEnvOptions>, injected: Record<string, string>): { env: Record<string, string>; inheritEnv: boolean } => {
    if (policy.mode === "clean") {
        return { env: buildCleanTaskEnv({ allow: policy.allow, injected, parentEnv: process.env }), inheritEnv: false };
    }

    return { env: injected, inheritEnv: true };
};
