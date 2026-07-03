import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFileSyncMock, exitProcessMock, getArgvMock, getEnvMock, getExecArgvMock, getExecPathMock, totalmemMock } = vi.hoisted(() => {
    return {
        execFileSyncMock: vi.fn(),
        exitProcessMock: vi.fn(),
        getArgvMock: vi.fn(),
        getEnvMock: vi.fn(),
        getExecArgvMock: vi.fn(),
        getExecPathMock: vi.fn(),
        totalmemMock: vi.fn(),
    };
});

vi.mock(import("node:child_process"), () => {
    return {
        execFileSync: execFileSyncMock,
    };
});

vi.mock(import("node:os"), () => {
    return {
        totalmem: totalmemMock,
    };
});

vi.mock(import("../../../../src/util/general/runtime-process"), () => {
    return {
        exitProcess: exitProcessMock,
        getArgv: getArgvMock,
        getEnv: getEnvMock,
        getExecArgv: getExecArgvMock,
        getExecPath: getExecPathMock,
    };
});

// Import AFTER mocks so the module picks them up.
// eslint-disable-next-line import/first
import { applyHeapTuning } from "../../../../src/util/general/heap-tuning";

const MAX_OLD_SPACE_PREFIX_RE = /^--max-old-space-size=/;

const getCallArgs = (): string[] => {
    const call = execFileSyncMock.mock.calls[0];

    if (!call) {
        throw new Error("execFileSyncMock was not called");
    }

    return call[1] as string[];
};

describe(applyHeapTuning, () => {
    beforeEach(() => {
        execFileSyncMock.mockReset();
        totalmemMock.mockReset();
        exitProcessMock.mockReset();
        getArgvMock.mockReset();
        getEnvMock.mockReset();
        getExecArgvMock.mockReset();
        getExecPathMock.mockReset();

        // Sensible defaults.
        getEnvMock.mockReturnValue({});
        getExecPathMock.mockReturnValue("/usr/bin/node");
        getArgvMock.mockReturnValue(["/usr/bin/node", "/script.js", "arg"]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns early without spawning if both flags are already set", () => {
        expect.assertions(2);

        getExecArgvMock.mockReturnValue(["--max-old-space-size=1024", "--max-semi-space-size=8"]);

        applyHeapTuning();

        expect(execFileSyncMock).not.toHaveBeenCalled();
        expect(exitProcessMock).not.toHaveBeenCalled();
    });

    it("re-spawns with computed flags when none are set, then exits with 0", () => {
        expect.assertions(4);

        getExecArgvMock.mockReturnValue([]);
        // 8 GiB total memory * 0.75 = 6144 MiB → semi-space tier = 64
        totalmemMock.mockReturnValue(8 * 1024 * 1024 * 1024);
        execFileSyncMock.mockReturnValue(undefined);

        applyHeapTuning();

        expect(execFileSyncMock).toHaveBeenCalledTimes(1);

        const call = execFileSyncMock.mock.calls[0];
        const args = getCallArgs();

        expect(call?.[0]).toBe("/usr/bin/node");
        expect(args[0]).toBe("--max-old-space-size=6144");
        expect(exitProcessMock).toHaveBeenCalledWith(0);
    });

    it("honors a custom maxOldSpacePercent option", () => {
        expect.assertions(1);

        getExecArgvMock.mockReturnValue([]);
        totalmemMock.mockReturnValue(8 * 1024 * 1024 * 1024); // 8 GiB
        execFileSyncMock.mockReturnValue(undefined);

        applyHeapTuning({ maxOldSpacePercent: 0.5 });

        const args = getCallArgs();

        expect(args[0]).toBe("--max-old-space-size=4096");
    });

    it("uses existing max-old-space-size when only semi-space is missing", () => {
        expect.assertions(2);

        getExecArgvMock.mockReturnValue(["--max-old-space-size=512"]);
        totalmemMock.mockReturnValue(8 * 1024 * 1024 * 1024);
        execFileSyncMock.mockReturnValue(undefined);

        applyHeapTuning();

        const args = getCallArgs();

        // The new flag is prepended; the existing flag is preserved later in the list.
        // 512 MiB tier → 4 MiB semi-space.
        expect(args[0]).toBe("--max-semi-space-size=4");
        // Verify the existing max-old-space-size from execArgv is still passed through.
        expect(args).toContain("--max-old-space-size=512");
    });

    it("uses existing max-semi-space-size when only old-space is missing", () => {
        expect.assertions(2);

        getExecArgvMock.mockReturnValue(["--max-semi-space-size=16"]);
        totalmemMock.mockReturnValue(2 * 1024 * 1024 * 1024); // 2 GiB
        execFileSyncMock.mockReturnValue(undefined);

        applyHeapTuning();

        const args = getCallArgs();

        expect(args[0]).toBe("--max-old-space-size=1536");
        // Existing semi-space flag is preserved.
        expect(args).toContain("--max-semi-space-size=16");
    });

    it("exits with the child process status code when execFileSync throws", () => {
        expect.assertions(1);

        getExecArgvMock.mockReturnValue([]);
        totalmemMock.mockReturnValue(2 * 1024 * 1024 * 1024);
        const error = new Error("child failed") as Error & { status?: number };

        error.status = 137;
        execFileSyncMock.mockImplementation(() => {
            throw error;
        });

        applyHeapTuning();

        expect(exitProcessMock).toHaveBeenCalledWith(137);
    });

    it("exits with code 1 when the thrown error has no status", () => {
        expect.assertions(1);

        getExecArgvMock.mockReturnValue([]);
        totalmemMock.mockReturnValue(2 * 1024 * 1024 * 1024);
        execFileSyncMock.mockImplementation(() => {
            throw new Error("child failed");
        });

        applyHeapTuning();

        expect(exitProcessMock).toHaveBeenCalledWith(1);
    });

    describe("semi-space sizing tiers", () => {
        // > 8 GiB → Math.floor(log2(maxOldSpace)) * 8. Because the implementation
        // computes oldSpace = floor(totalmem * percent), pick RAM such that the
        // computed oldSpace lands strictly above a power of 2.
        // 64 GiB RAM @ 0.75 → 49152 MiB → floor(log2(49152)) = 15 → 15 * 8 = 120.
        it.each<{ expected: string; oldSize: number; ramMiB: number }>([
            { expected: "--max-semi-space-size=4", oldSize: 512, ramMiB: 512 / 0.75 },
            { expected: "--max-semi-space-size=8", oldSize: 1024, ramMiB: 1024 / 0.75 },
            { expected: "--max-semi-space-size=16", oldSize: 2048, ramMiB: 2048 / 0.75 },
            { expected: "--max-semi-space-size=32", oldSize: 4096, ramMiB: 4096 / 0.75 },
            { expected: "--max-semi-space-size=64", oldSize: 8192, ramMiB: 8192 / 0.75 },
            { expected: "--max-semi-space-size=120", oldSize: 49_152, ramMiB: 64 * 1024 },
        ])("tier: old=$oldSize MiB → $expected", ({ expected, ramMiB }) => {
            expect.assertions(2);

            getExecArgvMock.mockReturnValue([]);
            totalmemMock.mockReturnValue(Math.floor(ramMiB) * 1024 * 1024);
            execFileSyncMock.mockReturnValue(undefined);

            applyHeapTuning();

            const args = getCallArgs();

            expect(args[0]).toMatch(MAX_OLD_SPACE_PREFIX_RE);
            expect(args[1]).toBe(expected);
        });
    });
});
