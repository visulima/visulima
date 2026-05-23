/**
 * Single seam between the task runner / service lifecycle APIs and the
 * dock store. Two channels per service:
 *
 *  Boot phase (ephemeral) — bootstrap is alive; runner stdout carries
 *    `[[VIS_BOOT]]{json}` markers interleaved with tailed child output.
 *
 *  Running phase — bootstrap has exited, child is detached. The bridge
 *    keeps a polling tail on the on-disk logfile and watches the pid
 *    for liveness. ESRCH triggers a `crashed` event.
 *
 * Registry mode skips the marker channel entirely; `notifyRegistry…`
 * methods are driven by handler.ts around `startService` / `stopService`
 * and the running-phase tail kicks in after `notifyRegistryReady`.
 */
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";

import type { ProcessEvent } from "@visulima/task-runner";

import { startService, stopService } from "../../services/lifecycle";
import { readEntry } from "../../services/registry";
import type { ServiceConfig } from "../../services/types";

const MARKER_PREFIX = "[[VIS_BOOT]]";
const TAIL_POLL_MS = 250;
const LIVENESS_POLL_MS = 1000;
const CRASH_TAIL_LINES = 3;

export type ServiceMode = "ephemeral" | "registry";

export interface EphemeralEntry {
    /** Path to per-service json config (bootstrap reads this). */
    configFile: string;
    cwd: string;
    /** Path to the on-disk logfile the bootstrap tails. */
    logFile: string;
    /** Path to the pid file the bootstrap writes after spawn. */
    pidFile: string;
    /** Shared bootstrap script path (`&lt;runDir>/bootstrap.mjs`). */
    scriptPath: string;
}

export interface RegistryEntry {
    command: string;
    config: ServiceConfig;
    cwd: string;
    env: Record<string, string>;
}

export interface ServiceBridgeEntry {
    ephemeral?: EphemeralEntry;
    mode: ServiceMode;
    registry?: RegistryEntry;
}

export interface ServiceEventSink {
    crashed: (id: string, tail: string[]) => void;
    failed: (id: string, reason: string, detail?: Record<string, unknown>) => void;
    log: (id: string, chunk: string) => void;
    ready: (id: string, info: { host: string; port: number }) => void;
    started: (id: string, pid: number | null) => void;
    starting: (id: string) => void;
}

export interface ServiceEventBridgeInput {
    /** Maps task-runner index → service id (used to route boot-phase events). */
    indexToId: ReadonlyMap<number, string>;
    services: ReadonlyMap<string, ServiceBridgeEntry>;
    sink: ServiceEventSink;
    workspaceRoot: string;
}

interface TailHandle {
    fd: number;
    /** Path captured at start so `#flushTail` doesn't have to re-derive it from the entry (which differs by mode). */
    logFile: string;
    pollTimer: NodeJS.Timeout;
    position: number;
}

interface LivenessHandle {
    pid: number;
    timer: NodeJS.Timeout;
}

/** Probe whether a pid is alive. Returns false on ESRCH; true otherwise. */
const isAlive = (pid: number): boolean => {
    try {
        process.kill(pid, 0);

        return true;
    } catch {
        return false;
    }
};

/** Read a stored pid file written by the bootstrap. Returns null if unreadable. */
const readPidFile = (path: string): number | null => {
    try {
        const raw = readFileSync(path, "utf8").trim();
        const pid = Number.parseInt(raw, 10);

        return Number.isFinite(pid) && pid > 0 ? pid : null;
    } catch {
        return null;
    }
};

export class ServiceEventBridge {
    readonly #indexToId: ReadonlyMap<number, string>;

    readonly #services: Map<string, ServiceBridgeEntry>;

    readonly #sink: ServiceEventSink;

    readonly #workspaceRoot: string;

    /** Per-service partial-line buffer for chunked stdout. */
    readonly #partialLines = new Map<string, string>();

    /** Per-service rolling tail used to provide crash context. */
    readonly #recentTail = new Map<string, string[]>();

    readonly #tails = new Map<string, TailHandle>();

    readonly #liveness = new Map<string, LivenessHandle>();

    /**
     * Children spawned by `#retryEphemeral` we still need to await on
     * dispose. In production the respawn is fire-and-forget, but in
     * tests the spawned child can briefly hold the cwd directory open
     * after exit on Windows, causing `rmSync` to fail with EBUSY. The
     * dispose path drains this set with a short timeout so test cleanup
     * is deterministic without breaking real respawns.
     */
    readonly #pendingRespawns = new Set<Promise<void>>();

    public constructor(input: ServiceEventBridgeInput) {
        this.#indexToId = input.indexToId;
        this.#services = new Map(input.services);
        this.#sink = input.sink;
        this.#workspaceRoot = input.workspaceRoot;
    }

    /** Adapter to pass into runConcurrently's `onEvent`. */
    public readonly onProcessEvent = (event: ProcessEvent): void => {
        if (event.kind !== "stdout" && event.kind !== "stderr") {
            return;
        }

        const id = this.#indexToId.get(event.index);

        if (id === undefined || event.text === undefined) {
            return;
        }

        this.onTaskOutput(id, event.text);
    };

    /**
     * Feed a chunk of stdout/stderr text for a known service id. Used
     * when the upstream emits per-task output by id instead of index
     * (e.g. the executor's `onOutput(taskId, text)` callback).
     *
     * No-ops for unknown ids — the executor calls this for every task
     * in PTY mode (it can't tell services from regular tasks), and
     * accumulating partial-line buffers per arbitrary task id would
     * be a slow memory leak for non-services.
     */
    public onTaskOutput(id: string, text: string): void {
        if (!this.#services.has(id)) {
            return;
        }

        const buffered = this.#partialLines.get(id) ?? "";
        const combined = buffered + text;
        const lines = combined.split("\n");
        const trailing = lines.pop() ?? "";

        this.#partialLines.set(id, trailing);

        for (const line of lines) {
            this.#handleLine(id, line);
        }
    }

    public notifyRegistryStarting(id: string): void {
        this.#sink.starting(id);
    }

    public notifyRegistryStarted(id: string, pid: number | null): void {
        this.#sink.started(id, pid);
    }

    /**
     * Called when the task-runner emits a `started` event for a
     * registry-mode service task. The wrapper's pid (from `vis service
     * start`) is not the service's own pid — that comes from the registry
     * entry once `notifyRegistryClosed` reads it back.
     */
    public onRegistryTaskStarted(id: string): void {
        const entry = this.#services.get(id);

        if (entry?.mode !== "registry") {
            return;
        }

        this.notifyRegistryStarting(id);
    }

    /**
     * Called when the task-runner emits a `close` event for a registry-mode
     * service task. On success, reads the registry entry to surface the
     * actual service pid + log file, then transitions the dock to ready
     * and starts the running-phase tail.
     */
    public async onRegistryTaskClosed(id: string, exitCode: number, killed: boolean): Promise<void> {
        const entry = this.#services.get(id);

        if (entry?.mode !== "registry") {
            return;
        }

        if (killed || exitCode !== 0) {
            this.notifyRegistryFailed(id, "exit-code", { exitCode, killed });

            return;
        }

        const registered = await readEntry(this.#workspaceRoot, id);

        if (!registered) {
            this.notifyRegistryFailed(id, "missing-registry-entry");

            return;
        }

        const { config } = registered;
        const port = config.readiness?.tcp?.port ?? config.port ?? 0;
        const host = config.readiness?.tcp?.host ?? "127.0.0.1";

        this.notifyRegistryReady(id, { host, logFile: registered.logFile, pid: registered.pid, port });
    }

    /**
     * Registry path: handler awaited `startService`; ready info comes
     * from the returned entry. Kicks off the running-phase tail on the
     * registry logFile.
     */
    public notifyRegistryReady(id: string, info: { host: string; logFile: string; pid: number | null; port: number }): void {
        this.#sink.ready(id, { host: info.host, port: info.port });
        this.#startTail(id, info.logFile);

        if (info.pid !== null) {
            this.#startLiveness(id, info.pid);
        }
    }

    public notifyRegistryFailed(id: string, reason: string, detail?: Record<string, unknown>): void {
        this.#sink.failed(id, reason, detail);
    }

    /**
     * Stop the old service then start a fresh one. Resets store state to
     * `starting` immediately so the dock reflects the action.
     */
    public async retry(id: string): Promise<void> {
        const entry = this.#services.get(id);

        if (!entry) {
            return;
        }

        this.#stopWatchers(id);
        this.#partialLines.delete(id);
        this.#recentTail.delete(id);
        this.#sink.starting(id);

        if (entry.mode === "registry") {
            await this.#retryRegistry(id, entry.registry);

            return;
        }

        if (entry.mode === "ephemeral") {
            this.#retryEphemeral(id, entry.ephemeral);
        }
    }

    public async dispose(): Promise<void> {
        for (const id of [...this.#tails.keys(), ...this.#liveness.keys()]) {
            this.#stopWatchers(id);
        }

        if (this.#pendingRespawns.size > 0) {
            // 2 s is plenty for a respawn that's exiting (no-such-script,
            // crash on boot) but short enough that a *successful* respawn
            // — which keeps running indefinitely — doesn't hang dispose.
            await Promise.race([
                Promise.all([...this.#pendingRespawns]),
                new Promise<void>((resolve) => {
                    setTimeout(resolve, 2000);
                }),
            ]);
            this.#pendingRespawns.clear();
        }

        this.#partialLines.clear();
        this.#recentTail.clear();
    }

    #handleLine(id: string, line: string): void {
        if (line.startsWith(MARKER_PREFIX)) {
            this.#handleMarker(id, line.slice(MARKER_PREFIX.length));

            return;
        }

        // Plain log line — record for crash context, forward to sink.
        const tail = this.#recentTail.get(id) ?? [];

        tail.push(line);

        if (tail.length > CRASH_TAIL_LINES) {
            tail.shift();
        }

        this.#recentTail.set(id, tail);
        this.#sink.log(id, `${line}\n`);
    }

    #handleMarker(id: string, payload: string): void {
        let parsed: { [key: string]: unknown; event: string };

        try {
            parsed = JSON.parse(payload) as typeof parsed;
        } catch {
            // Malformed marker — treat as a regular log line so users can debug it.
            this.#sink.log(id, `${MARKER_PREFIX + payload}\n`);

            return;
        }

        switch (parsed.event) {
            case "failed": {
                const reason = typeof parsed["reason"] === "string" ? parsed["reason"] : "unknown";
                const detail: Record<string, unknown> = {};

                for (const [key, value] of Object.entries(parsed)) {
                    if (key !== "event" && key !== "id" && key !== "reason") {
                        detail[key] = value;
                    }
                }

                this.#sink.failed(id, reason, detail);

                break;
            }

            case "ready": {
                const host = typeof parsed["host"] === "string" ? parsed["host"] : "127.0.0.1";
                const port = typeof parsed["port"] === "number" ? parsed["port"] : 0;

                this.#sink.ready(id, { host, port });
                this.#startRunningPhaseForEphemeral(id);

                break;
            }

            case "started": {
                const pid = typeof parsed["pid"] === "number" ? parsed["pid"] : null;

                this.#sink.started(id, pid);

                break;
            }

            default: {
                // Forward unknown markers as logs so they don't disappear.
                this.#sink.log(id, `${MARKER_PREFIX + payload}\n`);
            }
        }
    }

    #startRunningPhaseForEphemeral(id: string): void {
        const entry = this.#services.get(id);

        if (entry?.ephemeral === undefined) {
            return;
        }

        this.#startTail(id, entry.ephemeral.logFile);

        const pid = readPidFile(entry.ephemeral.pidFile);

        if (pid !== null) {
            this.#startLiveness(id, pid);
        }
    }

    #startTail(id: string, logFile: string): void {
        if (this.#tails.has(id) || !existsSync(logFile)) {
            return;
        }

        const fd = openSync(logFile, "r");
        const initialPosition = (() => {
            try {
                return statSync(logFile).size;
            } catch {
                return 0;
            }
        })();

        const tail: TailHandle = {
            fd,
            logFile,
            pollTimer: setInterval(() => {
                this.#flushTail(id);
            }, TAIL_POLL_MS),
            position: initialPosition,
        };

        this.#tails.set(id, tail);
    }

    #flushTail(id: string): void {
        const tail = this.#tails.get(id);

        if (!tail) {
            return;
        }

        try {
            const stat = statSync(tail.logFile);

            if (stat.size <= tail.position) {
                return;
            }

            const buffer = Buffer.alloc(stat.size - tail.position);
            const bytesRead = readSync(tail.fd, buffer, 0, buffer.length, tail.position);

            if (bytesRead > 0) {
                tail.position += bytesRead;

                const chunk = buffer.subarray(0, bytesRead).toString("utf8");

                for (const line of chunk.split("\n")) {
                    if (line.length === 0) {
                        continue;
                    }

                    this.#trackTail(id, line);
                }

                this.#sink.log(id, chunk);
            }
        } catch {
            // logfile vanished or transient read error — silently ignore.
        }
    }

    #trackTail(id: string, line: string): void {
        const tail = this.#recentTail.get(id) ?? [];

        tail.push(line);

        while (tail.length > CRASH_TAIL_LINES) {
            tail.shift();
        }

        this.#recentTail.set(id, tail);
    }

    #startLiveness(id: string, pid: number): void {
        if (this.#liveness.has(id)) {
            return;
        }

        const handle: LivenessHandle = {
            pid,
            timer: setInterval(() => {
                if (!isAlive(pid)) {
                    const tail = [...(this.#recentTail.get(id) ?? [])];

                    this.#stopWatchers(id);
                    this.#sink.crashed(id, tail);
                }
            }, LIVENESS_POLL_MS),
        };

        this.#liveness.set(id, handle);
    }

    #stopWatchers(id: string): void {
        const tail = this.#tails.get(id);

        if (tail) {
            clearInterval(tail.pollTimer);

            try {
                closeSync(tail.fd);
            } catch {
                // already closed
            }

            this.#tails.delete(id);
        }

        const liveness = this.#liveness.get(id);

        if (liveness) {
            clearInterval(liveness.timer);
            this.#liveness.delete(id);
        }
    }

    #retryEphemeral(id: string, entry: EphemeralEntry | undefined): void {
        if (entry === undefined) {
            return;
        }

        const oldPid = readPidFile(entry.pidFile);

        if (oldPid !== null) {
            try {
                process.kill(-oldPid, "SIGTERM");
            } catch {
                // already dead
            }
        }

        // Side-channel respawn — not through the main runner pipeline.
        // Bootstrap stdout flows back through this child process and gets
        // re-parsed via #handleLine when we wire up the spawn streams.
        const child = spawn("node", [entry.scriptPath, entry.configFile], {
            cwd: entry.cwd,
            stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout.on("data", (chunk: Buffer) => {
            this.#feedRespawnStream(id, chunk);
        });
        child.stderr.on("data", (chunk: Buffer) => {
            this.#feedRespawnStream(id, chunk);
        });
        child.on("error", (error) => {
            this.#sink.failed(id, "respawn-error", { message: error.message });
        });

        const exited = new Promise<void>((resolve) => {
            const settle = (): void => {
                this.#pendingRespawns.delete(exited);
                resolve();
            };

            child.once("exit", settle);
            child.once("error", settle);
        });

        this.#pendingRespawns.add(exited);
    }

    #feedRespawnStream(id: string, chunk: Buffer): void {
        const buffered = this.#partialLines.get(id) ?? "";
        const combined = buffered + chunk.toString("utf8");
        const lines = combined.split("\n");
        const trailing = lines.pop() ?? "";

        this.#partialLines.set(id, trailing);

        for (const line of lines) {
            this.#handleLine(id, line);
        }
    }

    async #retryRegistry(id: string, entry: RegistryEntry | undefined): Promise<void> {
        if (entry === undefined) {
            return;
        }

        try {
            await stopService({ id, workspaceRoot: this.#workspaceRoot });
        } catch {
            // Best-effort; if it was already gone we still want to start.
        }

        try {
            const result = await startService({
                command: entry.command,
                config: entry.config,
                cwd: entry.cwd,
                env: entry.env,
                id,
                workspaceRoot: this.#workspaceRoot,
            });

            const port = entry.config.readiness?.tcp?.port ?? entry.config.port ?? 0;
            const host = entry.config.readiness?.tcp?.host ?? "127.0.0.1";

            this.#sink.started(id, result.entry.pid);
            this.notifyRegistryReady(id, { host, logFile: result.entry.logFile, pid: result.entry.pid, port });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            this.#sink.failed(id, "retry-failed", { message });
        }
    }
}
