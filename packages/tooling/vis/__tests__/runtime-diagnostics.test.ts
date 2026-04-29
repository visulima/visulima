import { describe, expect, it } from "vitest";

import { checkInotifyCapacity, checkOrphanedRunners, checkTtyAvailability, runRuntimeDiagnostics } from "../src/runtime-diagnostics";

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

    it("returns `ok` or `warn` on Linux based on the parsed value", () => {
        expect.assertions(2);

        if (process.platform !== "linux") {
            // Skip — the inotify file only exists on Linux. Sanity-check the
            // skip path was already covered above.
            const diagnostic = checkInotifyCapacity();

            expect(diagnostic.status).toBe("skip");
            expect(diagnostic.id).toBe("inotify");

            return;
        }

        const diagnostic = checkInotifyCapacity();

        expect(diagnostic.id).toBe("inotify");
        expect(["ok", "warn"]).toContain(diagnostic.status);
    });

    it("warn message includes both the immediate sysctl fix and the persistent /etc/sysctl.d hint", () => {
        if (process.platform !== "linux") {
            return;
        }

        const diagnostic = checkInotifyCapacity();

        if (diagnostic.status !== "warn") {
            // Host already has a sufficient limit — nothing to assert.
            return;
        }

        expect.assertions(2);
        expect(diagnostic.message).toContain("sysctl fs.inotify.max_user_watches=524288");
        // Persistence hint protects users from getting bitten again after reboot.
        expect(diagnostic.message).toContain("/etc/sysctl.d");
    });
});

describe(checkOrphanedRunners, () => {
    it("does not include the current process in the orphan list", () => {
        expect.assertions(2);

        const diagnostic = checkOrphanedRunners();

        expect(diagnostic.id).toBe("orphans");

        if (diagnostic.detail?.pids === undefined) {
            // No orphans found — pass. The "exclude self" guard cannot
            // be exercised end-to-end without a controlled process tree.
            expect(diagnostic.status).toBe("ok");

            return;
        }

        const pidList = String(diagnostic.detail.pids)
            .split(",")
            .map((p) => Number.parseInt(p, 10))
            .filter((p) => Number.isFinite(p));

        expect(pidList).not.toContain(process.pid);
    });
});

describe(runRuntimeDiagnostics, () => {
    it("returns inotify, tty, and orphans diagnostics in a stable order", () => {
        // 1 ordering check + 3 status checks (one per diagnostic).
        expect.assertions(4);

        const diagnostics = runRuntimeDiagnostics();

        expect(diagnostics.map((d) => d.id)).toStrictEqual(["inotify", "tty", "orphans"]);
        // Every diagnostic must have a recognized status — guards against
        // a future check accidentally returning a typo'd value.
        for (const d of diagnostics) {
            expect(["ok", "skip", "warn"]).toContain(d.status);
        }
    });

    it("each diagnostic has a non-empty message and id", () => {
        expect.assertions(6);

        const diagnostics = runRuntimeDiagnostics();

        for (const d of diagnostics) {
            expect(d.id.length).toBeGreaterThan(0);
            expect(d.message.length).toBeGreaterThan(0);
        }
    });
});

