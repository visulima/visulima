import { open, stat, watch } from "node:fs/promises";

import type { Toolbox } from "@visulima/cerebro";
import { isAccessible } from "@visulima/fs";

import type { VisConfig } from "../../config/types";
import { discoverWorkspace, loadVisTaskConfigsForWorkspace } from "../../config/workspace";
import { pail } from "../../io/logger";
import { startService, stopService } from "../../services/lifecycle";
import { runReadiness, ServiceReadinessError } from "../../services/readiness";
import { isAlive, pruneDead, readAllEntries, readEntry } from "../../services/registry";
import type { ServiceEntry } from "../../services/types";
import { loadEnvFile } from "../../task/target-options";
import type { ServiceConfig, VisTargetConfiguration } from "../../task/types";
import { formatAge } from "../cache/handler";
import type { ServiceListOptions, ServiceLogsOptions, ServiceRestartOptions, ServiceStartOptions, ServiceStatusOptions, ServiceStopOptions } from "./index";

interface ResolvedTarget {
    /** Resolved shell command. Always defined — handlers reject targets without `command`. */
    command: string;
    cwd: string;
    env: Record<string, string>;
    /** Service config block; required for service-mode lifecycle. */
    service: ServiceConfig;
    target: VisTargetConfiguration;
    targetId: string;
}

/**
 * Split `@my/api:db` into `["@my/api", "db"]`. Uses `lastIndexOf(":")`
 * because pkg names can contain `/` and `@` but the trailing `:target`
 * is always the rightmost colon — there's no ambiguity.
 *
 * Trims leading/trailing whitespace before parsing — terminal copy-paste
 * frequently introduces newlines or spaces that would otherwise produce
 * the misleading "not found" diagnostic.
 */
const splitTargetId = (raw: string): { project: string; target: string } | undefined => {
    const id = raw.trim();
    const idx = id.lastIndexOf(":");

    if (idx <= 0 || idx === id.length - 1) {
        return undefined;
    }

    return { project: id.slice(0, idx), target: id.slice(idx + 1) };
};

const resolveCwd = (workspaceRoot: string, projectRoot: string | undefined, runFromWorkspaceRoot: boolean): string => {
    if (runFromWorkspaceRoot || !projectRoot) {
        return workspaceRoot;
    }

    return projectRoot.startsWith("/") ? projectRoot : `${workspaceRoot}/${projectRoot}`;
};

/**
 * Look up `@my/api:db` in the discovered workspace and assemble the
 * inputs `startService` needs. Returns undefined and logs a precise
 * diagnostic on any failure (unparseable id, unknown project, missing
 * target, missing `service` block, missing command).
 */
const resolveTarget = async (workspaceRoot: string, visConfig: VisConfig | undefined, targetId: string): Promise<ResolvedTarget | undefined> => {
    const split = splitTargetId(targetId);

    if (!split) {
        pail.error(`Invalid target id "${targetId}". Expected "<project>:<target>", e.g. "@my/api:db".`);

        return undefined;
    }

    const taskConfigs = await loadVisTaskConfigsForWorkspace(workspaceRoot);
    const { projectOptions, workspace } = discoverWorkspace(workspaceRoot, visConfig, taskConfigs);

    const project = workspace.projects[split.project];
    const target = projectOptions.get(split.project)?.[split.target];

    if (!project || !target) {
        pail.error(`Target "${targetId}" not found in this workspace.`);

        return undefined;
    }

    const service = target.options?.service;

    if (!service) {
        pail.error(`Target "${targetId}" is not a service. Add an \`options.service\` block to make it eligible for \`vis service\`.`);

        return undefined;
    }

    if (!target.command) {
        pail.error(`Target "${targetId}" has no command — services must be runnable.`);

        return undefined;
    }

    const cwd = resolveCwd(workspaceRoot, project.root, target.options?.runFromWorkspaceRoot === true);
    const envFromFiles = target.options?.envFile ? loadEnvFile(cwd, target.options.envFile) : {};

    return {
        command: target.command,
        cwd,
        env: { ...envFromFiles, ...service.env },
        service,
        target,
        targetId,
    };
};

const requireWorkspace = (wsRoot: string | undefined): string => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run `vis service` inside a workspace.");
    }

    return wsRoot;
};

export const serviceStartExecute = async ({ argument, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, ServiceStartOptions>): Promise<void> => {
    const workspaceRoot = requireWorkspace(wsRoot);
    const targetId = argument[0]?.trim();

    if (!targetId) {
        pail.error("Missing target id. Usage: vis service start <project>:<target>");
        process.exitCode = 1;

        return;
    }

    const resolved = await resolveTarget(workspaceRoot, visConfig, targetId);

    if (!resolved) {
        process.exitCode = 1;

        return;
    }

    try {
        const { entry } = await startService({
            command: resolved.command,
            config: resolved.service,
            cwd: resolved.cwd,
            env: resolved.env,
            id: targetId,
            readinessTimeoutMs: options.timeout,
            skipReadiness: options.noReadiness === true,
            workspaceRoot,
        });

        pail.success(`Started ${targetId} (pid ${String(entry.pid)})`);
        pail.info(`  log: ${entry.logFile}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (error instanceof ServiceReadinessError) {
            pail.error(`Readiness probe failed for ${targetId}: ${message}`);
        } else {
            pail.error(`Failed to start ${targetId}: ${message}`);
        }

        process.exitCode = 1;
    }
};

const stopOne = async (workspaceRoot: string, id: string, graceMs: number | undefined): Promise<boolean> => {
    const { stopped } = await stopService({ graceMs, id, workspaceRoot });

    if (stopped) {
        pail.success(`Stopped ${id}`);

        return true;
    }

    pail.info(`No running service registered for ${id}`);

    return false;
};

export const serviceStopExecute = async ({ argument, options, workspaceRoot: wsRoot }: Toolbox<Console, ServiceStopOptions>): Promise<void> => {
    const workspaceRoot = requireWorkspace(wsRoot);
    const { graceMs } = options;
    const targetId = argument[0]?.trim();

    if (options.all === true) {
        if (targetId) {
            // Reject the ambiguity rather than silently picking one. A
            // user typing `vis service stop foo --all` clearly meant
            // either-or and deserves a hard error, not a guess.
            pail.error("Cannot combine --all with a target id. Use one or the other.");
            process.exitCode = 1;

            return;
        }

        const entries = await readAllEntries(workspaceRoot);

        if (entries.length === 0) {
            pail.info("No running services registered for this workspace.");

            return;
        }

        for (const entry of entries) {
            await stopOne(workspaceRoot, entry.id, graceMs);
        }

        return;
    }

    if (!targetId) {
        pail.error("Missing target id. Usage: vis service stop <project>:<target> | --all");
        process.exitCode = 1;

        return;
    }

    const stopped = await stopOne(workspaceRoot, targetId, graceMs);

    if (!stopped) {
        process.exitCode = 1;
    }
};

interface ListRow {
    age: string;
    id: string;
    log: string;
    pid: string;
    port: string;
}

const formatPort = (entry: ServiceEntry): string => {
    const port = entry.config.readiness?.tcp.port ?? entry.config.port;

    return port === undefined ? "—" : String(port);
};

const VALID_LIST_FORMATS = new Set(["json", "table"]);

export const serviceListExecute = async ({ logger, options, workspaceRoot: wsRoot }: Toolbox<Console, ServiceListOptions>): Promise<void> => {
    const workspaceRoot = requireWorkspace(wsRoot);
    const format = options.format ?? "table";

    if (!VALID_LIST_FORMATS.has(format)) {
        pail.error(`Invalid --format "${format}". Expected one of: ${[...VALID_LIST_FORMATS].sort().join(", ")}.`);
        process.exitCode = 1;

        return;
    }

    const { surviving: entries } = await pruneDead(workspaceRoot);

    if (format === "json") {
        const now = Date.now();

        process.stdout.write(
            `${JSON.stringify(
                entries.map((entry) => {
                    const startedMs = Date.parse(entry.startedAt);

                    return {
                        ageMs: Number.isFinite(startedMs) ? now - startedMs : null,
                        alive: isAlive(entry.pid),
                        command: entry.command,
                        cwd: entry.cwd,
                        env: entry.env,
                        id: entry.id,
                        logFile: entry.logFile,
                        pid: entry.pid,
                        port: entry.config.readiness?.tcp.port ?? entry.config.port ?? null,
                        startedAt: entry.startedAt,
                        visVersion: entry.visVersion,
                    };
                }),
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    if (entries.length === 0) {
        pail.info("No running services registered for this workspace.");

        return;
    }

    const renderedAt = Date.now();
    const rows: ListRow[] = entries.map((entry) => {
        const startedMs = Date.parse(entry.startedAt);

        return {
            age: Number.isFinite(startedMs) ? formatAge(startedMs, renderedAt) : "?",
            id: entry.id,
            log: entry.logFile,
            pid: String(entry.pid),
            port: formatPort(entry),
        };
    });

    const idWidth = Math.max(2, ...rows.map((r) => r.id.length));
    const pidWidth = Math.max(3, ...rows.map((r) => r.pid.length));
    const portWidth = Math.max(4, ...rows.map((r) => r.port.length));
    const ageWidth = Math.max(3, ...rows.map((r) => r.age.length));

    logger.info(`  ${"id".padEnd(idWidth)}  ${"pid".padEnd(pidWidth)}  ${"port".padEnd(portWidth)}  ${"age".padEnd(ageWidth)}  log`);
    logger.info(`  ${"-".repeat(idWidth)}  ${"-".repeat(pidWidth)}  ${"-".repeat(portWidth)}  ${"-".repeat(ageWidth)}  ---`);

    for (const row of rows) {
        logger.info(`  ${row.id.padEnd(idWidth)}  ${row.pid.padEnd(pidWidth)}  ${row.port.padEnd(portWidth)}  ${row.age.padEnd(ageWidth)}  ${row.log}`);
    }
};

export const serviceStatusExecute = async ({ argument, options, workspaceRoot: wsRoot }: Toolbox<Console, ServiceStatusOptions>): Promise<void> => {
    const workspaceRoot = requireWorkspace(wsRoot);
    const targetId = argument[0]?.trim();

    if (!targetId) {
        pail.error("Missing target id. Usage: vis service status <project>:<target>");
        process.exitCode = 1;

        return;
    }

    const entry = await readEntry(workspaceRoot, targetId);

    if (!entry) {
        pail.error(`No service registered for ${targetId}.`);
        process.exitCode = 1;

        return;
    }

    if (!isAlive(entry.pid)) {
        pail.error(`Service ${targetId} is not running (pid ${String(entry.pid)} is dead). Run \`vis service start ${targetId}\` to recover.`);
        process.exitCode = 1;

        return;
    }

    try {
        await runReadiness(entry.config, { timeoutMs: options.timeout });
        pail.success(`${targetId} healthy (pid ${String(entry.pid)})`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        pail.error(`${targetId} probe failed: ${message}`);
        process.exitCode = 1;
    }
};

export const serviceRestartExecute = async ({
    argument,
    options,
    visConfig,
    workspaceRoot: wsRoot,
}: Toolbox<Console, ServiceRestartOptions>): Promise<void> => {
    const workspaceRoot = requireWorkspace(wsRoot);
    const targetId = argument[0]?.trim();

    if (!targetId) {
        pail.error("Missing target id. Usage: vis service restart <project>:<target>");
        process.exitCode = 1;

        return;
    }

    await stopService({ graceMs: options.graceMs, id: targetId, workspaceRoot });

    const resolved = await resolveTarget(workspaceRoot, visConfig, targetId);

    if (!resolved) {
        process.exitCode = 1;

        return;
    }

    try {
        const { entry } = await startService({
            command: resolved.command,
            config: resolved.service,
            cwd: resolved.cwd,
            env: resolved.env,
            id: targetId,
            readinessTimeoutMs: options.timeout,
            skipReadiness: options.noReadiness === true,
            workspaceRoot,
        });

        pail.success(`Restarted ${targetId} (pid ${String(entry.pid)})`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        pail.error(`Failed to restart ${targetId}: ${message}`);
        process.exitCode = 1;
    }
};

const TAIL_POLL_MS = 200;

/**
 * Cap on bytes copied per tick. A service that suddenly dumps gigabytes
 * (verbose log mode, panic stack dumps) shouldn't blow Node's heap with
 * a single Buffer.alloc — we just chunk the catch-up across ticks.
 */
const TAIL_MAX_CHUNK_BYTES = 1024 * 1024;

const tailLog = async (logFile: string): Promise<void> => {
    let position = 0;

    try {
        const initial = await stat(logFile);

        position = initial.size;
    } catch {
        position = 0;
    }

    // AbortController gives us a single signal to (a) break out of
    // `for await (... of watch(file, { signal }))` (which otherwise
    // ignores `stopped` between events), (b) cut the polling sleep
    // short, and (c) propagate cancellation into in-flight `tickOnce`.
    const controller = new AbortController();
    let sigintReceived = false;
    const onSigint = (): void => {
        sigintReceived = true;
        controller.abort();
    };
    const onSigterm = (): void => {
        controller.abort();
    };

    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);

    // Serialize tickOnce: the watcher event and the polling tick can
    // fire in the same ms, and concurrent reads from the same `position`
    // would double-print bytes (or worse, race on `position` writes).
    // A simple in-flight flag turns the second caller into a no-op —
    // they'll retry on the next event/tick anyway.
    let tickInFlight = false;

    // Native `fs.watch` is fastest where it works, but on networked
    // filesystems (NFS, SMB) it silently drops events. The polling
    // fallback below is the floor — `watch` only kicks tail forward
    // earlier when it does fire. Either way we read with a fresh
    // handle each tick so a log rotation can't strand us on a stale
    // inode.
    const tickOnce = async (): Promise<void> => {
        if (tickInFlight) {
            return;
        }

        tickInFlight = true;

        try {
            const stats = await stat(logFile).catch(() => undefined);

            if (!stats) {
                return;
            }

            // Detect rotation: file shrunk → start over from byte 0.
            if (stats.size < position) {
                position = 0;
            }

            if (stats.size === position) {
                return;
            }

            const available = stats.size - position;
            const chunkSize = Math.min(available, TAIL_MAX_CHUNK_BYTES);
            const handle = await open(logFile, "r");

            try {
                const buffer = Buffer.alloc(chunkSize);

                await handle.read(buffer, 0, chunkSize, position);
                process.stdout.write(buffer);
                position += chunkSize;
            } finally {
                await handle.close().catch(() => {});
            }
        } finally {
            tickInFlight = false;
        }
    };

    try {
        const watcher = (async () => {
            try {
                for await (const _event of watch(logFile, { signal: controller.signal })) {
                    await tickOnce();
                }
            } catch {
                // `watch` rejects with AbortError on shutdown and may
                // throw on rotation/unavailable backends — swallow.
                // The polling loop carries the load when watch is dead.
            }
        })();

        while (!controller.signal.aborted) {
            await tickOnce();

            await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, TAIL_POLL_MS);

                controller.signal.addEventListener(
                    "abort",
                    () => {
                        clearTimeout(timer);
                        resolve();
                    },
                    { once: true },
                );
            });
        }

        await watcher.catch(() => {});
        // One last flush so a write that happened just before SIGINT
        // doesn't get truncated from the user's view.
        await tickOnce().catch(() => {});
    } finally {
        process.off("SIGINT", onSigint);
        process.off("SIGTERM", onSigterm);
    }

    if (sigintReceived) {
        // Conventional exit code for SIGINT-terminated processes.
        // Setting exitCode (not process.exit) lets Node finish flushing
        // its own stdio buffer.
        process.exitCode = 130;
    }
};

export const serviceLogsExecute = async ({ argument, options, workspaceRoot: wsRoot }: Toolbox<Console, ServiceLogsOptions>): Promise<void> => {
    const workspaceRoot = requireWorkspace(wsRoot);
    const targetId = argument[0]?.trim();

    if (!targetId) {
        pail.error("Missing target id. Usage: vis service logs <project>:<target>");
        process.exitCode = 1;

        return;
    }

    const entry = await readEntry(workspaceRoot, targetId);

    if (!entry) {
        pail.error(`No service registered for ${targetId}.`);
        process.exitCode = 1;

        return;
    }

    if (!(await isAccessible(entry.logFile))) {
        pail.warn(`Log file is missing for ${targetId}: ${entry.logFile}`);
        process.exitCode = 1;

        return;
    }

    if (options.follow === true) {
        await tailLog(entry.logFile);

        return;
    }

    // One-shot dump: stream the whole file directly to stdout. Avoids
    // pulling potentially-large logs through Node strings.
    const handle = await open(entry.logFile, "r");

    try {
        const stream = handle.createReadStream();

        await new Promise<void>((resolve, reject) => {
            stream.on("end", resolve);
            stream.on("error", reject);
            stream.pipe(process.stdout, { end: false });
        });
    } finally {
        await handle.close().catch(() => {});
    }
};
