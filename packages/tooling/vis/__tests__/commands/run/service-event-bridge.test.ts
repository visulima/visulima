import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProcessEvent } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceBridgeEntry, ServiceEventSink } from "../../../src/commands/run/service-event-bridge";
import { ServiceEventBridge } from "../../../src/commands/run/service-event-bridge";
import { writeEntry } from "../../../src/services/registry";
import type { ServiceEntry } from "../../../src/services/types";

const buildSink = (): ServiceEventSink & { calls: { args: unknown[]; method: string }[] } => {
    const calls: { args: unknown[]; method: string }[] = [];

    const sink = {
        calls,
        crashed: vi.fn((id: string, tail: string[]) => {
            calls.push({ args: [id, tail], method: "crashed" });
        }),
        failed: vi.fn((id: string, reason: string, detail?: Record<string, unknown>) => {
            calls.push({ args: [id, reason, detail], method: "failed" });
        }),
        log: vi.fn((id: string, chunk: string) => {
            calls.push({ args: [id, chunk], method: "log" });
        }),
        ready: vi.fn((id: string, info: { host: string; port: number }) => {
            calls.push({ args: [id, info], method: "ready" });
        }),
        started: vi.fn((id: string, pid: number | null) => {
            calls.push({ args: [id, pid], method: "started" });
        }),
        starting: vi.fn((id: string) => {
            calls.push({ args: [id], method: "starting" });
        }),
    };

    return sink;
};

const stdoutEvent = (index: number, text: string): ProcessEvent => {
    return {
        index,
        kind: "stdout",
        text,
    };
};

describe(ServiceEventBridge, () => {
    let tempRoot: string;
    let homeOverride: string;
    let originalHome: string | undefined;

    beforeEach(() => {
        tempRoot = mkdtempSync(join(tmpdir(), "vis-bridge-"));
        // Per-test HOME so the registry directory the bridge reads via
        // `readEntry` lives in a fresh tmp tree. Mirrors the registry
        // test pattern; keeps the user's real ~/.vis untouched.
        homeOverride = mkdtempSync(join(tmpdir(), "vis-bridge-home-"));
        originalHome = process.env["HOME"];
        process.env["HOME"] = homeOverride;
    });

    afterEach(() => {
        if (originalHome === undefined) {
            delete process.env["HOME"];
        } else {
            process.env["HOME"] = originalHome;
        }

        // `force: true` swallows ENOENT, so the existsSync guard is
        // redundant; `maxRetries` is the Windows-only piece — a brief
        // file-handle/AV race on the runner sporadically fails the rmdir
        // with EBUSY, and Node's built-in linear backoff (100, 200, 300
        // ms…) is enough to ride it out.
        rmSync(tempRoot, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
        rmSync(homeOverride, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
    });

    describe("marker parsing", () => {
        it("parses a well-formed started marker and emits started", () => {
            expect.assertions(2);

            const sink = buildSink();
            const entry: ServiceBridgeEntry = { mode: "ephemeral" };
            const bridge = new ServiceEventBridge({
                indexToId: new Map([[0, "api:db"]]),
                services: new Map([["api:db", entry]]),
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.onProcessEvent(stdoutEvent(0, `[[VIS_BOOT]]${JSON.stringify({ event: "started", id: "api:db", pid: 4242 })}\n`));

            expect(sink.started).toHaveBeenCalledTimes(1);
            expect(sink.started).toHaveBeenCalledWith("api:db", 4242);
        });

        it("parses a ready marker with host/port and emits ready", () => {
            expect.assertions(1);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map([[0, "api:db"]]),
                services: new Map([["api:db", { mode: "ephemeral" }]]),
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.onProcessEvent(stdoutEvent(0, `[[VIS_BOOT]]${JSON.stringify({ event: "ready", host: "127.0.0.1", id: "api:db", port: 5432 })}\n`));

            expect(sink.ready).toHaveBeenCalledWith("api:db", { host: "127.0.0.1", port: 5432 });
        });

        it("parses a failed marker and forwards detail fields (excluding event/id/reason)", () => {
            expect.assertions(2);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map([[0, "api:db"]]),
                services: new Map([["api:db", { mode: "ephemeral" }]]),
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.onProcessEvent(stdoutEvent(0, `[[VIS_BOOT]]${JSON.stringify({ code: 1, event: "failed", id: "api:db", reason: "exited-before-ready" })}\n`));

            expect(sink.failed).toHaveBeenCalledTimes(1);
            expect(sink.failed).toHaveBeenCalledWith("api:db", "exited-before-ready", { code: 1 });
        });

        it("treats a malformed marker as a regular log line", () => {
            expect.assertions(2);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map([[0, "api:db"]]),
                services: new Map([["api:db", { mode: "ephemeral" }]]),
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.onProcessEvent(stdoutEvent(0, "[[VIS_BOOT]]not-json\n"));

            expect(sink.failed).not.toHaveBeenCalled();
            expect(sink.log).toHaveBeenCalledWith("api:db", "[[VIS_BOOT]]not-json\n");
        });

        it("handles multiple events arriving in a single chunk", () => {
            expect.assertions(2);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map([[0, "api:db"]]),
                services: new Map([["api:db", { mode: "ephemeral" }]]),
                sink,
                workspaceRoot: tempRoot,
            });

            const chunk
                = `[[VIS_BOOT]]${JSON.stringify({ event: "started", id: "api:db", pid: 1 })}\n`
                    + `[[VIS_BOOT]]${JSON.stringify({ event: "ready", host: "127.0.0.1", id: "api:db", port: 5432 })}\n`;

            bridge.onProcessEvent(stdoutEvent(0, chunk));

            expect(sink.started).toHaveBeenCalledWith("api:db", 1);
            expect(sink.ready).toHaveBeenCalledWith("api:db", { host: "127.0.0.1", port: 5432 });
        });

        it("buffers partial lines across chunks", () => {
            expect.assertions(2);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map([[0, "api:db"]]),
                services: new Map([["api:db", { mode: "ephemeral" }]]),
                sink,
                workspaceRoot: tempRoot,
            });

            const full = `[[VIS_BOOT]]${JSON.stringify({ event: "started", id: "api:db", pid: 7 })}\n`;
            const splitAt = Math.floor(full.length / 2);

            bridge.onProcessEvent(stdoutEvent(0, full.slice(0, splitAt)));

            expect(sink.started).not.toHaveBeenCalled();

            bridge.onProcessEvent(stdoutEvent(0, full.slice(splitAt)));

            expect(sink.started).toHaveBeenCalledWith("api:db", 7);
        });

        it("forwards plain (non-marker) lines to log with a trailing newline", () => {
            expect.assertions(1);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map([[0, "api:db"]]),
                services: new Map([["api:db", { mode: "ephemeral" }]]),
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.onProcessEvent(stdoutEvent(0, "postgres ready\n"));

            expect(sink.log).toHaveBeenCalledWith("api:db", "postgres ready\n");
        });

        it("ignores events for unknown indices", () => {
            expect.assertions(1);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services: new Map(),
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.onProcessEvent(stdoutEvent(99, "anything\n"));

            expect(sink.calls).toStrictEqual([]);
        });
    });

    describe("running phase", () => {
        it("starts polling tail when the ready marker arrives", async () => {
            expect.assertions(1);

            const logFile = join(tempRoot, "api-db.log");
            const pidFile = join(tempRoot, "api-db.pid");

            writeFileSync(logFile, "");
            writeFileSync(pidFile, String(process.pid));

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map([[0, "api:db"]]),
                services: new Map([
                    [
                        "api:db",
                        {
                            ephemeral: {
                                configFile: "",
                                cwd: tempRoot,
                                logFile,
                                pidFile,
                                scriptPath: "",
                            },
                            mode: "ephemeral",
                        },
                    ],
                ]),
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.onProcessEvent(stdoutEvent(0, `[[VIS_BOOT]]${JSON.stringify({ event: "ready", host: "127.0.0.1", id: "api:db", port: 5432 })}\n`));

            // Append data to the log; the tail should pick it up on the next poll.
            writeFileSync(logFile, "hello world\n");

            await new Promise<void>((resolve) => {
                setTimeout(resolve, 350);
            });

            await bridge.dispose();

            const logCalls = sink.log.mock.calls.filter((call: [string, string]) => call[1].includes("hello world"));

            expect(logCalls.length).toBeGreaterThan(0);
        });

        it("detects pid death (ESRCH) and emits crashed with rolling tail", async () => {
            expect.assertions(2);

            const logFile = join(tempRoot, "api-db.log");
            const pidFile = join(tempRoot, "api-db.pid");

            writeFileSync(logFile, "");
            // 0xFFFF_FFFF guaranteed-dead pid for the liveness probe to trip.
            writeFileSync(pidFile, "4294967295");

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map([[0, "api:db"]]),
                services: new Map([
                    [
                        "api:db",
                        {
                            ephemeral: {
                                configFile: "",
                                cwd: tempRoot,
                                logFile,
                                pidFile,
                                scriptPath: "",
                            },
                            mode: "ephemeral",
                        },
                    ],
                ]),
                sink,
                workspaceRoot: tempRoot,
            });

            // Seed crash context with a couple of plain lines.
            bridge.onProcessEvent(stdoutEvent(0, "boot line A\nboot line B\n"));

            bridge.onProcessEvent(stdoutEvent(0, `[[VIS_BOOT]]${JSON.stringify({ event: "ready", host: "127.0.0.1", id: "api:db", port: 5432 })}\n`));

            await new Promise<void>((resolve) => {
                setTimeout(resolve, 1300);
            });

            await bridge.dispose();

            expect(sink.crashed).toHaveBeenCalledTimes(1);

            const [crashedId, tail] = sink.crashed.mock.calls[0]! as [string, string[]];

            expect({ crashedId, tailHasBoot: tail.some((line) => line.includes("boot line")) }).toStrictEqual({
                crashedId: "api:db",
                tailHasBoot: true,
            });
        });
    });

    describe("registry-mode notifications", () => {
        it("forwards starting/started/ready/failed straight through", async () => {
            expect.assertions(4);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services: new Map(),
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.notifyRegistryStarting("api:db");
            bridge.notifyRegistryStarted("api:db", 99);

            const logFile = join(tempRoot, "registry-db.log");

            writeFileSync(logFile, "");
            bridge.notifyRegistryReady("api:db", { host: "127.0.0.1", logFile, pid: 99, port: 5432 });
            bridge.notifyRegistryFailed("api:db", "boom", { code: 7 });

            await bridge.dispose();

            expect(sink.starting).toHaveBeenCalledWith("api:db");
            expect(sink.started).toHaveBeenCalledWith("api:db", 99);
            expect(sink.ready).toHaveBeenCalledWith("api:db", { host: "127.0.0.1", port: 5432 });
            expect(sink.failed).toHaveBeenCalledWith("api:db", "boom", { code: 7 });
        });

        it("flushes the running-phase tail for registry-mode services", async () => {
            // Regression: the tail handle previously re-derived `logFile`
            // from `entry.ephemeral?.logFile`, which is undefined for
            // registry-mode services — the timer ran but nothing flushed.
            expect.assertions(1);

            const logFile = join(tempRoot, "registry-tail.log");

            writeFileSync(logFile, "");

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services: new Map<string, ServiceBridgeEntry>([
                    ["api:db", { mode: "registry", registry: { command: "cmd", config: {}, cwd: tempRoot, env: {} } }],
                ]),
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.notifyRegistryReady("api:db", { host: "127.0.0.1", logFile, pid: 99, port: 5432 });

            writeFileSync(logFile, "running phase log line\n");

            await new Promise<void>((resolve) => {
                setTimeout(resolve, 350);
            });

            await bridge.dispose();

            const matched = sink.log.mock.calls.some((call) => String(call[1]).includes("running phase log line"));

            expect(matched).toBe(true);
        });
    });

    describe("registry-mode lifecycle hooks", () => {
        const buildRegistryEntry = (overrides: Partial<ServiceEntry> = {}): ServiceEntry => {
            return {
                command: "node -e 'setInterval(()=>{},1000)'",
                config: { readiness: { tcp: { host: "127.0.0.1", port: 5432 } } },
                cwd: tempRoot,
                env: {},
                id: "api:db",
                logFile: join(tempRoot, "api__db.log"),
                pid: process.pid,
                slug: "api__db",
                startedAt: new Date().toISOString(),
                visVersion: "0.0.0-test",
                ...overrides,
            };
        };

        it("transitions a registry entry to starting on task started", async () => {
            expect.assertions(2);

            const sink = buildSink();
            const services = new Map<string, ServiceBridgeEntry>([
                ["api:db", { mode: "registry", registry: { command: "cmd", config: {}, cwd: tempRoot, env: {} } }],
            ]);
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services,
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.onRegistryTaskStarted("api:db");

            await bridge.dispose();

            expect(sink.starting).toHaveBeenCalledTimes(1);
            expect(sink.starting).toHaveBeenCalledWith("api:db");
        });

        it("is a no-op when the entry is ephemeral", async () => {
            expect.assertions(1);

            const sink = buildSink();
            const services = new Map<string, ServiceBridgeEntry>([
                [
                    "api:db",
                    {
                        ephemeral: {
                            configFile: join(tempRoot, "cfg.json"),
                            cwd: tempRoot,
                            logFile: join(tempRoot, "db.log"),
                            pidFile: join(tempRoot, "db.pid"),
                            scriptPath: join(tempRoot, "boot.mjs"),
                        },
                        mode: "ephemeral",
                    },
                ],
            ]);
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services,
                sink,
                workspaceRoot: tempRoot,
            });

            bridge.onRegistryTaskStarted("api:db");

            await bridge.dispose();

            expect(sink.starting).not.toHaveBeenCalled();
        });

        it("reads the registry on close and transitions to ready", async () => {
            expect.assertions(3);

            const logFile = join(tempRoot, "api__db.log");

            writeFileSync(logFile, "");

            await writeEntry(tempRoot, buildRegistryEntry({ logFile }));

            const sink = buildSink();
            const services = new Map<string, ServiceBridgeEntry>([
                ["api:db", { mode: "registry", registry: { command: "cmd", config: {}, cwd: tempRoot, env: {} } }],
            ]);
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services,
                sink,
                workspaceRoot: tempRoot,
            });

            await bridge.onRegistryTaskClosed("api:db", 0, false);

            await bridge.dispose();

            expect(sink.ready).toHaveBeenCalledTimes(1);
            expect(sink.ready).toHaveBeenCalledWith("api:db", { host: "127.0.0.1", port: 5432 });
            expect(sink.failed).not.toHaveBeenCalled();
        });

        it("transitions to failed on non-zero exit", async () => {
            expect.assertions(2);

            const sink = buildSink();
            const services = new Map<string, ServiceBridgeEntry>([
                ["api:db", { mode: "registry", registry: { command: "cmd", config: {}, cwd: tempRoot, env: {} } }],
            ]);
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services,
                sink,
                workspaceRoot: tempRoot,
            });

            await bridge.onRegistryTaskClosed("api:db", 7, false);

            await bridge.dispose();

            expect(sink.failed).toHaveBeenCalledTimes(1);
            expect(sink.failed).toHaveBeenCalledWith("api:db", "exit-code", { exitCode: 7, killed: false });
        });

        it("transitions to failed on killed even when exitCode is 0", async () => {
            expect.assertions(1);

            const sink = buildSink();
            const services = new Map<string, ServiceBridgeEntry>([
                ["api:db", { mode: "registry", registry: { command: "cmd", config: {}, cwd: tempRoot, env: {} } }],
            ]);
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services,
                sink,
                workspaceRoot: tempRoot,
            });

            await bridge.onRegistryTaskClosed("api:db", 0, true);

            await bridge.dispose();

            expect(sink.failed).toHaveBeenCalledWith("api:db", "exit-code", { exitCode: 0, killed: true });
        });

        it("transitions to failed when no registry entry was written", async () => {
            expect.assertions(2);

            const sink = buildSink();
            const services = new Map<string, ServiceBridgeEntry>([
                ["api:db", { mode: "registry", registry: { command: "cmd", config: {}, cwd: tempRoot, env: {} } }],
            ]);
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services,
                sink,
                workspaceRoot: tempRoot,
            });

            await bridge.onRegistryTaskClosed("api:db", 0, false);

            await bridge.dispose();

            expect(sink.failed).toHaveBeenCalledTimes(1);
            expect(sink.failed).toHaveBeenCalledWith("api:db", "missing-registry-entry", undefined);
        });

        it("close hook is a no-op for ephemeral entries", async () => {
            expect.assertions(2);

            const sink = buildSink();
            const services = new Map<string, ServiceBridgeEntry>([
                [
                    "api:db",
                    {
                        ephemeral: {
                            configFile: join(tempRoot, "cfg.json"),
                            cwd: tempRoot,
                            logFile: join(tempRoot, "db.log"),
                            pidFile: join(tempRoot, "db.pid"),
                            scriptPath: join(tempRoot, "boot.mjs"),
                        },
                        mode: "ephemeral",
                    },
                ],
            ]);
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services,
                sink,
                workspaceRoot: tempRoot,
            });

            await bridge.onRegistryTaskClosed("api:db", 7, true);

            await bridge.dispose();

            expect(sink.failed).not.toHaveBeenCalled();
            expect(sink.ready).not.toHaveBeenCalled();
        });
    });

    describe("retry", () => {
        it("resets state to starting and is a no-op for unknown ids", async () => {
            expect.assertions(1);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services: new Map(),
                sink,
                workspaceRoot: tempRoot,
            });

            await bridge.retry("unknown");

            expect(sink.starting).not.toHaveBeenCalled();
        });

        it("transitions a known service to starting before dispatching", async () => {
            expect.assertions(1);

            const sink = buildSink();
            const bridge = new ServiceEventBridge({
                indexToId: new Map(),
                services: new Map([
                    [
                        "api:db",
                        {
                            ephemeral: {
                                configFile: join(tempRoot, "cfg.json"),
                                cwd: tempRoot,
                                logFile: join(tempRoot, "db.log"),
                                pidFile: join(tempRoot, "db.pid"),
                                scriptPath: join(tempRoot, "no-such-script.mjs"),
                            },
                            mode: "ephemeral",
                        },
                    ],
                ]),
                sink,
                workspaceRoot: tempRoot,
            });

            // Make a benign config so the bootstrap respawn at least gets to spawn.
            mkdirSync(tempRoot, { recursive: true });
            writeFileSync(join(tempRoot, "db.pid"), "0");

            await bridge.retry("api:db");
            await bridge.dispose();

            expect(sink.starting).toHaveBeenCalledWith("api:db");
        });
    });
});
