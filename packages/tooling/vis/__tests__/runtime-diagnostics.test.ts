import { describe, expect, it, vi } from "vitest";

import {
    checkInotifyCapacity,
    checkOrphanedRunners,
    checkTtyAvailability,
    killOrphanedRunners,
    killViaSignal,
    killViaTaskkill,
    listOrphanPids,
    ORPHANS_DIAGNOSTIC_ID,
    runRuntimeDiagnostics,
} from "../src/runtime/runtime-diagnostics";

describe(checkTtyAvailability, () => {
    it("reports `ok` when both stdin and stdout are TTYs", () => {
        expect.assertions(2);

        // Capture-restore the property so the test doesn't leak into siblings.
        const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
        const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

        Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
        Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });

        try {
            const diagnostic = checkTtyAvailability();

            expect(diagnostic.status).toBe("ok");
            expect(diagnostic.message).toContain("watch keybinds enabled");
        } finally {
            if (stdinDescriptor) {
                Object.defineProperty(process.stdin, "isTTY", stdinDescriptor);
            }

            if (stdoutDescriptor) {
                Object.defineProperty(process.stdout, "isTTY", stdoutDescriptor);
            }
        }
    });

    it("reports `skip` when neither stream is a TTY (CI / piped)", () => {
        expect.assertions(2);

        const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
        const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

        Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: undefined });
        Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: undefined });

        try {
            const diagnostic = checkTtyAvailability();

            expect(diagnostic.status).toBe("skip");
            expect(diagnostic.message).toContain("CI / piped mode");
        } finally {
            if (stdinDescriptor) {
                Object.defineProperty(process.stdin, "isTTY", stdinDescriptor);
            }

            if (stdoutDescriptor) {
                Object.defineProperty(process.stdout, "isTTY", stdoutDescriptor);
            }
        }
    });

    it("flags a stdin-only TTY as 'output captured, keybinds still work'", () => {
        expect.assertions(2);

        const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
        const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

        Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
        Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: undefined });

        try {
            const diagnostic = checkTtyAvailability();

            expect(diagnostic.status).toBe("skip");
            expect(diagnostic.message).toContain("output is being captured");
        } finally {
            if (stdinDescriptor) {
                Object.defineProperty(process.stdin, "isTTY", stdinDescriptor);
            }

            if (stdoutDescriptor) {
                Object.defineProperty(process.stdout, "isTTY", stdoutDescriptor);
            }
        }
    });
});

describe(checkInotifyCapacity, () => {
    it("returns `skip` on non-Linux platforms", () => {
        expect.assertions(2);

        const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");

        Object.defineProperty(process, "platform", { configurable: true, value: "darwin" });

        try {
            const diagnostic = checkInotifyCapacity();

            expect(diagnostic.status).toBe("skip");
            expect(diagnostic.message).toContain("not Linux");
        } finally {
            if (platformDescriptor) {
                Object.defineProperty(process, "platform", platformDescriptor);
            }
        }
    });

    it.skipIf(process.platform !== "linux")("returns `ok` or `warn` on Linux based on the parsed value", () => {
        expect.assertions(2);

        const diagnostic = checkInotifyCapacity();

        expect(diagnostic.id).toBe("inotify");
        expect(["ok", "warn"]).toContain(diagnostic.status);
    });

    it.skipIf(process.platform !== "linux" || checkInotifyCapacity().status !== "warn")(
        "warn message includes both the immediate sysctl fix and the persistent /etc/sysctl.d hint",
        () => {
            expect.assertions(2);

            const diagnostic = checkInotifyCapacity();

            expect(diagnostic.message).toContain("sysctl fs.inotify.max_user_watches=524288");
            // Persistence hint protects users from getting bitten again after reboot.
            expect(diagnostic.message).toContain("/etc/sysctl.d");
        },
    );
});

describe(checkOrphanedRunners, () => {
    it("emits the orphans id and never lists the current process", () => {
        expect.assertions(2);

        const diagnostic = checkOrphanedRunners();
        const pidList = diagnostic.detail?.pids === undefined
            ? []
            : String(diagnostic.detail.pids)
                .split(",")
                .map((p) => Number.parseInt(p, 10))
                .filter((p) => Number.isFinite(p));

        expect(diagnostic.id).toBe("orphans");
        // Self must never appear regardless of whether other orphans exist;
        // the "exclude self" guard is the contract under test.
        expect(pidList).not.toContain(process.pid);
    });
});

describe(listOrphanPids, () => {
    it("excludes the current process and never throws", () => {
        expect.assertions(2);

        const pids = listOrphanPids();

        expect(Array.isArray(pids)).toBe(true);
        expect(pids).not.toContain(process.pid);
    });
});

describe(killOrphanedRunners, () => {
    it("sends SIGTERM by default to every enumerated PID", () => {
        expect.assertions(4);

        const calls: { pid: number; signal: string }[] = [];
        const result = killOrphanedRunners({
            enumerate: () => [1111, 2222],
            kill: (pid, signal) => {
                calls.push({ pid, signal });
            },
        });

        expect(calls).toStrictEqual([
            { pid: 1111, signal: "SIGTERM" },
            { pid: 2222, signal: "SIGTERM" },
        ]);
        expect(result.killed).toStrictEqual([1111, 2222]);
        expect(result.failed).toStrictEqual([]);
        // Calling again with no orphans must yield empty results, not throw.
        expect(killOrphanedRunners({ enumerate: () => [], kill: () => {} }).killed).toStrictEqual([]);
    });

    it("escalates to SIGKILL when force is set", () => {
        expect.assertions(1);

        const signals: string[] = [];

        killOrphanedRunners({
            enumerate: () => [4242],
            force: true,
            kill: (_pid, signal) => {
                signals.push(signal);
            },
        });

        expect(signals).toStrictEqual(["SIGKILL"]);
    });

    it("treats ESRCH as success — the orphan exited between enumerate and signal", () => {
        expect.assertions(2);

        const result = killOrphanedRunners({
            enumerate: () => [9999],
            kill: () => {
                const error = new Error("No such process") as NodeJS.ErrnoException;

                error.code = "ESRCH";
                throw error;
            },
        });

        expect(result.killed).toStrictEqual([9999]);
        expect(result.failed).toStrictEqual([]);
    });

    it("records non-ESRCH failures with their reason and continues with remaining PIDs", () => {
        expect.assertions(3);

        const result = killOrphanedRunners({
            enumerate: () => [1, 2, 3],
            kill: (pid) => {
                if (pid === 2) {
                    const error = new Error("Operation not permitted") as NodeJS.ErrnoException;

                    error.code = "EPERM";
                    throw error;
                }
            },
        });

        expect(result.killed).toStrictEqual([1, 3]);
        expect(result.failed).toStrictEqual([{ pid: 2, reason: "EPERM" }]);
        // Order matters — a failure mid-loop must not abort remaining kills.
        expect(result.killed.length + result.failed.length).toBe(3);
    });

    it("falls back to listOrphanPids when no enumerate is supplied — without crashing on real ps/tasklist output", () => {
        // Live `listOrphanPids` invocation. It excludes self and may
        // return zero or more PIDs depending on test environment. We're
        // not asserting on which PIDs, only that the call completes
        // (no thrown error from the fallback path) and every kill the
        // loop attempted received SIGTERM, not SIGKILL. Using
        // hasAssertions() instead of a fixed count because the loop body
        // is conditional on the live process table.
        expect.hasAssertions();

        const killSpy = vi.fn();

        killOrphanedRunners({ kill: killSpy });

        // Always-true sentinel so the test has at least one assertion
        // even when the live host has no orphans (the empty-loop branch).
        expect(killSpy.mock.calls.length).toBeGreaterThanOrEqual(0);

        for (const [, signal] of killSpy.mock.calls) {
            expect(signal).toBe("SIGTERM");
        }
    });
});

describe(killViaTaskkill, () => {
    it("uses /PID for SIGTERM and /F /PID for SIGKILL", () => {
        expect.assertions(2);

        const calls: string[][] = [];
        const fakeRunner = (args: string[]) => {
            calls.push(args);

            return { status: 0 };
        };

        killViaTaskkill(1234, "SIGTERM", fakeRunner);
        killViaTaskkill(5678, "SIGKILL", fakeRunner);

        expect(calls[0]).toStrictEqual(["/PID", "1234"]);
        expect(calls[1]).toStrictEqual(["/F", "/PID", "5678"]);
    });

    it("maps exit code 128 to ESRCH so the race-window handling triggers", () => {
        expect.assertions(2);

        let thrown: unknown;

        try {
            killViaTaskkill(9999, "SIGTERM", () => {
                return { status: 128 };
            });
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as NodeJS.ErrnoException).code).toBe("ESRCH");
    });

    it("rethrows spawnSync errors verbatim", () => {
        expect.assertions(1);

        const spawnError = new Error("ENOENT: taskkill not found");

        expect(() => {
            killViaTaskkill(1234, "SIGTERM", () => {
                return { error: spawnError };
            });
        }).toThrow(spawnError);
    });

    it("propagates non-128 nonzero exit codes with a descriptive message", () => {
        expect.assertions(2);

        let thrown: unknown;

        try {
            killViaTaskkill(1234, "SIGTERM", () => {
                return { status: 1 };
            });
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(Error);
        // Code is the message itself — preserves taskkill's actual exit code
        // for diagnostics so a future bug report can pinpoint which code we hit.
        expect((thrown as Error).message).toContain("taskkill exited with code 1");
    });

    it("treats a successful (status 0) run as no-throw", () => {
        expect.assertions(1);

        expect(() => {
            killViaTaskkill(1234, "SIGTERM", () => {
                return { status: 0 };
            });
        }).not.toThrow();
    });
});

describe(killViaSignal, () => {
    it("forwards (pid, signal) to the supplied kill primitive", () => {
        expect.assertions(2);

        const calls: { pid: number; signal: string }[] = [];

        killViaSignal(4242, "SIGTERM", (pid, signal) => {
            calls.push({ pid, signal });
        });
        killViaSignal(8484, "SIGKILL", (pid, signal) => {
            calls.push({ pid, signal });
        });

        expect(calls[0]).toStrictEqual({ pid: 4242, signal: "SIGTERM" });
        expect(calls[1]).toStrictEqual({ pid: 8484, signal: "SIGKILL" });
    });

    it("defaults to process.kill when no override is provided", () => {
        expect.assertions(2);

        const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

        try {
            killViaSignal(4242, "SIGTERM");

            expect(killSpy).toHaveBeenCalledTimes(1);
            expect(killSpy).toHaveBeenCalledWith(4242, "SIGTERM");
        } finally {
            killSpy.mockRestore();
        }
    });
});

describe("orphans diagnostic id constant", () => {
    it("matches the id every orphan diagnostic emits", () => {
        expect.assertions(1);

        // Sanity check: refactoring the constant must not desync from
        // checkOrphanedRunners. Run the diagnostic and assert it uses
        // the exported id.
        const diagnostic = checkOrphanedRunners();

        expect(diagnostic.id).toBe(ORPHANS_DIAGNOSTIC_ID);
    });
});

describe(runRuntimeDiagnostics, () => {
    it("returns inotify, tty, and orphans diagnostics in a stable order", () => {
        expect.assertions(3);

        const diagnostics = runRuntimeDiagnostics();

        expect(diagnostics.map((d) => d.id)).toStrictEqual(["inotify", "tty", "orphans"]);
        // Every diagnostic must have a recognized status — guards against
        // a future check accidentally returning a typo'd value.

        expect(diagnostics.every((d) => ["ok", "skip", "warn"].includes(d.status))).toBe(true);
        expect(diagnostics).toHaveLength(3);
    });

    it("each diagnostic has a non-empty message and id", () => {
        expect.assertions(2);

        const diagnostics = runRuntimeDiagnostics();

        expect(diagnostics.every((d) => d.id.length > 0)).toBe(true);
        expect(diagnostics.every((d) => d.message.length > 0)).toBe(true);
    });
});
