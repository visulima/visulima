import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

import { writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import type { Task, TaskGraph } from "@visulima/task-runner";
import { buildEnhancedPath } from "@visulima/task-runner";

import type { ServiceConfig } from "../../services/types";
import type { VisTargetOptions } from "../../task/target-options";
import { loadEnvFile, resolveTaskCwd } from "../../task/target-options";

/** Lifecycle mode for an auto-started service. */
export type PreflightMode = "ephemeral" | "registry";

interface PreflightServiceTask {
    /** Resolved shell command to spawn. */
    command: string;
    config: ServiceConfig;
    cwd: string;
    /** Environment merged from service config + envFile. Process env is layered later. */
    env: Record<string, string>;
    id: string;
}

interface PreflightTaskExtraction {
    services: PreflightServiceTask[];
    /** Service ids that were missing but lacked a `service:` config or command — diagnostic only. */
    skipped: { id: string; reason: string }[];
}

const getVisOptions = (task: Task): VisTargetOptions | undefined => {
    const options = task.overrides["visOptions"];

    return options && typeof options === "object" ? options : undefined;
};

/**
 * Walk `taskGraph.tasks[id]` for each missing service id and produce the
 * spawnable shape the orchestrator needs. Tasks without a `service:`
 * config or a resolvable command are reported in `skipped` so the caller
 * can fall back to today's diagnostic instead of blindly spawning.
 */
export const extractPreflightTasks = (workspaceRoot: string, missingIds: ReadonlyArray<string>, taskGraph: TaskGraph): PreflightTaskExtraction => {
    const services: PreflightServiceTask[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const id of missingIds) {
        const task = taskGraph.tasks[id];

        if (!task) {
            skipped.push({ id, reason: "task not in graph" });
            continue;
        }

        const command = task.overrides["command"] as string | undefined;

        if (!command) {
            skipped.push({ id, reason: "no command resolved" });
            continue;
        }

        const visOptions = getVisOptions(task);

        if (!visOptions?.service) {
            skipped.push({ id, reason: "no service config" });
            continue;
        }

        const cwd = resolveTaskCwd(workspaceRoot, task.projectRoot, Boolean(visOptions.runFromWorkspaceRoot));
        const { envFile } = visOptions;
        const envFromFile = envFile === undefined || envFile === false ? {} : loadEnvFile(cwd, envFile);
        const serviceEnv = visOptions.service.env ?? {};

        services.push({
            command,
            config: visOptions.service,
            cwd,
            env: { ...envFromFile, ...serviceEnv },
            id,
        });
    }

    return { services, skipped };
};

interface TopoLevel {
    /** Service ids whose remaining service-deps are all satisfied. */
    ids: string[];
}

/**
 * Build a service-only sub-DAG from the task graph and partition the
 * missing-set into topological "levels". The injection path collapses
 * these into a strict sequential chain — see `linearize` below — but the
 * level structure is preserved here for tests and future use.
 *
 * Edges = `serviceA dependsOn serviceB` where both are in `missingIds`.
 * Cycles short-circuit by emitting the remaining cycle members as a
 * single level so the orchestrator never deadlocks (it'll fail readiness
 * for whichever service genuinely needs the other).
 */
export const planTopoLevels = (missingIds: ReadonlyArray<string>, taskGraph: TaskGraph): TopoLevel[] => {
    const set = new Set(missingIds);
    const remaining = new Map<string, Set<string>>();

    for (const id of missingIds) {
        const deps = (taskGraph.dependencies[id] ?? []).filter((dep) => set.has(dep));

        remaining.set(id, new Set(deps));
    }

    const levels: TopoLevel[] = [];
    const completed = new Set<string>();

    while (remaining.size > 0) {
        const level: string[] = [];

        for (const [id, deps] of remaining) {
            for (const dep of deps) {
                if (completed.has(dep)) {
                    deps.delete(dep);
                }
            }

            if (deps.size === 0) {
                level.push(id);
            }
        }

        if (level.length === 0) {
            level.push(...remaining.keys());
        }

        for (const id of level) {
            completed.add(id);
            remaining.delete(id);
        }

        level.sort();

        levels.push({ ids: level });
    }

    return levels;
};

/**
 * Flatten the topo levels into one strict sequential chain. The user
 * explicitly opted into "no two services boot at once" — independent
 * services within a level are alphabetised so the order is stable across
 * runs and visible in the run TUI.
 */
export const linearize = (missingIds: ReadonlyArray<string>, taskGraph: TaskGraph): string[] => {
    const order: string[] = [];

    for (const level of planTopoLevels(missingIds, taskGraph)) {
        order.push(...level.ids);
    }

    return order;
};

/**
 * Inline node script invoked as the wrapper command for ephemeral
 * service tasks. Reads its config from a JSON file (path passed as the
 * sole argv after the script path), spawns the original service command
 * with stdio bound to a per-service logfile (NOT to the bootstrap's own
 * stdio — `inherit` would make the grandchild hold the run TUI's task
 * pipes and the task would never appear to finish). The bootstrap tails
 * that logfile to its own stdout while it's alive so users see boot
 * logs, then exits 0 once the TCP probe passes. Pid is recorded in
 * `pidFile` for run-end SIGTERM; the child keeps the logfile fd alive
 * after the bootstrap dies and continues writing to it.
 */
const EPHEMERAL_BOOTSTRAP_SCRIPT = String.raw`import { spawn } from "node:child_process";
import { closeSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";

const cfgPath = process.argv[2];

if (!cfgPath) {
    console.error("[vis-service-bootstrap] missing config path");
    process.exit(2);
}

const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));

// Structured marker for service-event-bridge.ts to consume. Plain
// process.stdout.write keeps the line atomic and on the same stream
// as the tailed child log, so the parser sees one stream.
const emit = (event) => {
    process.stdout.write("[[VIS_BOOT]]" + JSON.stringify({ ...event, id: cfg.id }) + "\n");
};

// Spawn the child with its stdio bound to a real file descriptor on
// disk — NOT inherited from the bootstrap. If the child inherited
// our stdio, it would inherit vis run's task pipes, and vis run would
// block waiting for those pipes to close even after this bootstrap
// exits. The logfile gives the grandchild a stable target it can keep
// writing to long after this bootstrap is gone.
const childLogFd = openSync(cfg.logFile, "a");

const child = spawn(cfg.command, {
    cwd: cfg.cwd,
    detached: true,
    env: { ...process.env, ...cfg.env },
    shell: true,
    stdio: ["ignore", childLogFd, childLogFd],
});

// Close the bootstrap's copy of the fd; the child kept its own.
closeSync(childLogFd);

if (child.pid !== undefined) {
    try {
        writeFileSync(cfg.pidFile, String(child.pid));
    } catch (error) {
        console.error("[vis] failed to write pid file: " + (error?.message ?? String(error)));
    }
}

emit({ event: "started", pid: child.pid ?? null });

let exitedEarly = false;

child.once("exit", (code, signal) => {
    exitedEarly = true;
    emit({ code, event: "failed", reason: "exited-before-ready", signal });
});

// Forward new bytes from the logfile to our stdout while we're alive.
// Polling-based tail; preflight is short, ~200ms per cycle is fine.
let tailPos = 0;
const tailFd = openSync(cfg.logFile, "r");

const flushTail = () => {
    try {
        const stat = statSync(cfg.logFile);
        if (stat.size <= tailPos) return;
        const remaining = stat.size - tailPos;
        const buf = Buffer.alloc(remaining);
        const n = readSync(tailFd, buf, 0, remaining, tailPos);
        if (n > 0) {
            process.stdout.write(buf.subarray(0, n));
            tailPos += n;
        }
    } catch {}
};

const probeOnce = () => new Promise((resolve) => {
    const socket = createConnection({ host: cfg.host || "127.0.0.1", port: cfg.port });
    let settled = false;
    const finish = (ok) => {
        if (settled) return;
        settled = true;
        try { socket.destroy(); } catch {}
        resolve(ok);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(1000, () => finish(false));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const deadline = Date.now() + (cfg.timeoutMs ?? 30000);
    while (Date.now() < deadline) {
        flushTail();
        if (exitedEarly) {
            try { closeSync(tailFd); } catch {}
            process.exit(1);
        }
        if (await probeOnce()) {
            flushTail();
            emit({ event: "ready", host: cfg.host || "127.0.0.1", port: cfg.port });
            try { closeSync(tailFd); } catch {}
            child.unref();
            process.exit(0);
        }
        await sleep(200);
    }
    flushTail();
    emit({ event: "failed", reason: "timeout", timeoutMs: cfg.timeoutMs ?? 30000 });
    try { closeSync(tailFd); } catch {}
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
    process.exit(1);
})();
`;

interface BootstrapPaths {
    /** Per-service json config file. */
    configFile: string;
    /** Per-service log file: child stdio is appended here, bootstrap tails it. */
    logFile: string;
    /** Per-service pid file (only meaningful in ephemeral mode). */
    pidFile: string;
    /** Path to the on-disk bootstrap script. Same for every service in this run. */
    scriptPath: string;
}

interface PreparedBootstrap {
    /** Per-run directory holding pid/config files; caller cleans up at run end. */
    runDir: string;
    /** Path to the on-disk bootstrap script. */
    scriptPath: string;
}

/**
 * Prepare a per-run scratch directory + write the inline bootstrap
 * script. Every ephemeral service in this run shares the same script
 * file but gets its own config + pid file inside `runDir`. Caller
 * cleans up `runDir` after the run completes.
 */
export const prepareBootstrap = (): PreparedBootstrap => {
    const runDir = mkdtempSync(join(tmpdir(), "vis-services-"));
    const scriptPath = join(runDir, "bootstrap.mjs");

    writeFileSync(scriptPath, EPHEMERAL_BOOTSTRAP_SCRIPT);

    return { runDir, scriptPath };
};

export const buildBootstrapPaths = (runDir: string, scriptPath: string, id: string): BootstrapPaths => {
    const safe = id.replaceAll(/[^\w-]/g, "_");

    return {
        configFile: join(runDir, `${safe}.json`),
        logFile: join(runDir, `${safe}.log`),
        pidFile: join(runDir, `${safe}.pid`),
        scriptPath,
    };
};

/**
 * Pure builder for the bootstrap config payload. Throws if the service
 * has no TCP readiness port — call this BEFORE creating the run scratch
 * dir to avoid orphaning a `mkdtemp` directory when validation fails.
 */
const buildEphemeralConfig = (params: { paths: Pick<BootstrapPaths, "logFile" | "pidFile">; service: PreflightServiceTask }): Record<string, unknown> => {
    const { paths, service } = params;
    const tcpPort = service.config.readiness?.tcp?.port ?? service.config.port;

    if (typeof tcpPort !== "number") {
        throw new TypeError(`Service ${service.id} has no TCP readiness port — declare \`service.port\` or \`service.readiness.tcp.port\`.`);
    }

    // Prepend the service cwd's `node_modules/.bin` chain to PATH so bare
    // binary names in the service command (e.g. `packem dev`, `next start`)
    // resolve inside the detached bootstrap process. The bootstrap itself
    // inherits the parent's enhanced PATH, but the parent was enhanced for
    // *its* cwd — different from `service.cwd` in any nested-package setup.
    const env: Record<string, string> = {
        ...service.env,
        PATH: buildEnhancedPath(service.cwd, service.env),
    };

    return {
        command: service.command,
        cwd: service.cwd,
        env,
        host: service.config.readiness?.tcp?.host ?? "127.0.0.1",
        id: service.id,
        logFile: paths.logFile,
        pidFile: paths.pidFile,
        port: tcpPort,
        timeoutMs: service.config.readiness?.tcp?.timeoutMs ?? 30_000,
    };
};

/**
 * Pure builder for the shell command that launches a service through the
 * bootstrap script. The config is read from a json file the inject loop
 * writes alongside this — keeps the command line short and avoids shell
 * escaping for env values.
 */
const buildEphemeralCommand = (paths: Pick<BootstrapPaths, "configFile" | "scriptPath">): string =>
    `node ${JSON.stringify(paths.scriptPath)} ${JSON.stringify(paths.configFile)}`;

/**
 * Build the shell command that delegates to `vis service start &lt;id>`
 * for registry-backed services. Reuses the existing CLI: stdout flows
 * naturally into the run TUI, the registry write is handled by the
 * subcommand, and the user can `vis service stop` afterwards.
 */
const buildRegistryCommand = (params: { id: string; visBin: string; workspaceRoot: string }): string => {
    const { id, visBin, workspaceRoot } = params;

    return `node ${JSON.stringify(visBin)} service start ${JSON.stringify(id)} --cwd ${JSON.stringify(workspaceRoot)}`;
};

export interface InjectServiceTasksParams {
    /** Resolved task ids of services missing from the registry. */
    missingServiceIds: ReadonlyArray<string>;
    mode: PreflightMode;
    taskGraph: TaskGraph;
    /** Absolute path to the running vis CLI script (`process.argv[1]`). */
    visBin: string;
    workspaceRoot: string;
}

export interface InjectServiceTasksResult {
    /** Order in which services will boot — used by the caller for the artificial sequential chain. */
    chain: string[];
    /** Pid files to read + SIGTERM at run end (ephemeral mode only). */
    ephemeralPidFiles: string[];
    /** Per-run scratch directory. Caller deletes at run end. */
    runDir: string | undefined;

    /**
     * Per-dependent env to merge in addition to whatever
     * `applyServiceRegistry` already produced. Keyed by *dependent*
     * task id; values are env from the missing service's config. We
     * synthesize this without pruning so the run TUI still shows the
     * service rows.
     */
    serviceEnvByTaskId: Map<string, Record<string, string>>;
    /** Service ids that couldn't be auto-started (no command, no service config). */
    skipped: { id: string; reason: string }[];
}

/**
 * Mutate `taskGraph` in-place so each missing service becomes a regular
 * task whose command is a readiness-gated bootstrap wrapper. The user's
 * tasks already depend on these service ids via `dependsOn`, so the run
 * TUI naturally renders them as preceding rows with live boot logs.
 *
 * Side-effects:
 * - Rewrites `taskGraph.tasks[id].overrides.command` for each missing service.
 * - Marks each service task `cache: false` (services are non-deterministic).
 * - Adds artificial dependencies so services boot strictly sequentially
 *   (caller asked: "not 3 at the same time"). The original topo order
 *   is preserved; ties are broken alphabetically.
 *
 * Returns:
 * - The synthesized `serviceEnvByTaskId` map. Callers merge this on top
 *   of `applyServiceRegistry`'s map before passing to the executor.
 * - A `runDir` path to clean up after the run.
 * - Pid files to SIGTERM on run end (ephemeral mode).
 */
export const injectServiceTasks = (params: InjectServiceTasksParams): InjectServiceTasksResult => {
    const { missingServiceIds, mode, taskGraph, visBin, workspaceRoot } = params;

    const { services, skipped } = extractPreflightTasks(workspaceRoot, missingServiceIds, taskGraph);

    if (services.length === 0) {
        return {
            chain: [],
            ephemeralPidFiles: [],
            runDir: undefined,
            serviceEnvByTaskId: new Map(),
            skipped,
        };
    }

    const chain = linearize(
        services.map((s) => s.id),
        taskGraph,
    );
    const byId = new Map(services.map((service) => [service.id, service]));
    const ephemeralPidFiles: string[] = [];

    // Pre-validate every ephemeral config (port resolution etc.) BEFORE
    // creating the run scratch dir. A throw here means we leak nothing —
    // no tmp dir was made yet. Pids are filled in once we know paths.
    const pendingConfigs: { id: string; payload: Record<string, unknown> }[] = [];

    if (mode === "ephemeral") {
        for (const id of chain) {
            const service = byId.get(id);

            if (!service) {
                continue;
            }

            pendingConfigs.push({
                id,
                payload: buildEphemeralConfig({ paths: { logFile: "", pidFile: "" }, service }),
            });
        }
    }

    let prepared: PreparedBootstrap | undefined;

    if (mode === "ephemeral") {
        prepared = prepareBootstrap();
    }

    let previous: string | undefined;

    for (const id of chain) {
        const service = byId.get(id);
        const task = taskGraph.tasks[id];

        if (!service || !task) {
            continue;
        }

        let command: string;

        if (mode === "ephemeral") {
            const paths = buildBootstrapPaths(prepared!.runDir, prepared!.scriptPath, id);
            const pending = pendingConfigs.find((entry) => entry.id === id);
            const payload = { ...pending!.payload, logFile: paths.logFile, pidFile: paths.pidFile };

            writeFileSync(paths.configFile, JSON.stringify(payload));
            command = buildEphemeralCommand(paths);
            ephemeralPidFiles.push(paths.pidFile);
        } else {
            command = buildRegistryCommand({ id, visBin, workspaceRoot });
        }

        task.overrides = { ...task.overrides, command };
        task.cache = false;
        taskGraph.tasks[id] = task;

        if (previous !== undefined) {
            const deps = taskGraph.dependencies[id] ?? [];

            if (!deps.includes(previous)) {
                taskGraph.dependencies[id] = [...deps, previous];
            }
        }

        previous = id;
    }

    // Synthesize env for every transitive dependent of every missing
    // service. Mirrors apply-service-registry.ts:217 but without
    // pruning — the service nodes stay in the graph as TUI rows.
    const missingSet = new Set(chain);
    const serviceEnvByTaskId = new Map<string, Record<string, string>>();

    const collectTransitive = (start: string): string[] => {
        const found = new Set<string>();
        const stack = [...(taskGraph.dependencies[start] ?? [])];
        const seen = new Set<string>();

        while (stack.length > 0) {
            const next = stack.pop()!;

            if (seen.has(next)) {
                continue;
            }

            seen.add(next);

            if (missingSet.has(next)) {
                found.add(next);
            }

            for (const depOfNext of taskGraph.dependencies[next] ?? []) {
                if (!seen.has(depOfNext)) {
                    stack.push(depOfNext);
                }
            }
        }

        return [...found].sort();
    };

    for (const dependentId of Object.keys(taskGraph.dependencies)) {
        if (missingSet.has(dependentId)) {
            continue;
        }

        const reachable = collectTransitive(dependentId);

        if (reachable.length === 0) {
            continue;
        }

        const merged: Record<string, string> = {};

        for (const serviceId of reachable) {
            const service = byId.get(serviceId);

            if (service?.config.env) {
                Object.assign(merged, service.config.env);
            }
        }

        if (Object.keys(merged).length > 0) {
            serviceEnvByTaskId.set(dependentId, merged);
        }
    }

    return {
        chain,
        ephemeralPidFiles,
        runDir: prepared?.runDir,
        serviceEnvByTaskId,
        skipped,
    };
};

export type ServicesPolicy = "auto" | "ephemeral" | "off" | "persistent";

const VALID_POLICIES: ReadonlySet<string> = new Set(["auto", "ephemeral", "off", "persistent"]);

interface ResolveServicesPolicyInput {
    /** Raw `--services=&lt;mode>` string, or `undefined` if not passed. */
    cli: string | undefined;
    /** Workspace-pinned default from `vis.config.ts → run.services`. */
    config: ServicesPolicy | undefined;
    isCi: boolean;

    /**
     * True when at least one user-invoked target is a persistent task
     * (server / watcher). `auto` treats these the same as `dev`: they
     * own the foreground until the user quits, so supporting services
     * should die with the run rather than leak into the registry.
     */
    isPersistentTarget?: boolean;
    isTty: boolean;
    /** Task name; used by `auto` to pick persistent-style → ephemeral, others → registry. */
    target: string | undefined;
}

/**
 * Resolve the services policy into a concrete decision: skip preflight
 * (`"off"`), boot ephemerally, or boot via the registry. Precedence is
 * CLI > config > TTY-aware default. `auto` collapses to `ephemeral` for
 * `dev` tasks and `registry` everywhere else.
 *
 * Note on naming: the user-facing CLI/config value `"persistent"` maps
 * to the internal `PreflightMode` of `"registry"` — same concept, two
 * names because users think of services that "persist", while the code
 * cares about the registry that backs them.
 *
 * Throws on an unknown CLI value — picking silently is exactly the kind
 * of "what is this thing actually doing?" surprise we want to avoid.
 */
export const resolveServicesPolicy = (input: ResolveServicesPolicyInput): "ephemeral" | "off" | "registry" => {
    const { cli, config, isCi, isPersistentTarget, isTty, target } = input;

    if (cli !== undefined && !VALID_POLICIES.has(cli)) {
        throw new Error(`--services: expected one of auto|ephemeral|persistent|off, got "${cli}"`);
    }

    const policy: ServicesPolicy = (cli as ServicesPolicy | undefined) ?? config ?? (isTty && !isCi ? "auto" : "off");

    if (policy === "off") {
        return "off";
    }

    if (policy === "ephemeral") {
        return "ephemeral";
    }

    if (policy === "persistent") {
        return "registry";
    }

    // `auto`: any persistent target (dev / serve / watcher) treats the run
    // as a foreground session — services should die with the run. One-shot
    // targets (test / build) keep registry mode so the next run can reuse
    // the same DB without re-init churn.
    if (isPersistentTarget || target === "dev") {
        return "ephemeral";
    }

    return "registry";
};
