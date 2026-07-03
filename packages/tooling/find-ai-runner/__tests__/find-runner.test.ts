import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { detectAllProviders, detectAllProvidersAsync, detectProvider, findRunner } from "../src/index";

const IS_WINDOWS = platform() === "win32";
const WHICH_CMD = IS_WINDOWS ? "where" : "which";

vi.mock(import("node:child_process"), () => {
    return {
        execFile: vi.fn<typeof execFile>(),
        execFileSync: vi.fn<typeof execFileSync>(),
        spawn: vi.fn<typeof import("node:child_process").spawn>(),
    };
});

vi.mock(import("node:fs"), () => {
    return {
        existsSync: vi.fn<typeof existsSync>(() => false),
    };
});

const mockExecFileSync = vi.mocked(execFileSync);
const mockExecFile = vi.mocked(execFile);
const mockExistsSync = vi.mocked(existsSync);

/** Make `which` succeed only for the given command names. */
const whichResolves = (...commands: string[]): void => {
    mockExecFileSync.mockImplementation((cmd: string, arguments_?: ReadonlyArray<string>) => {
        if (cmd === WHICH_CMD && arguments_ && commands.includes(arguments_[0] as string)) {
            return `/usr/bin/${arguments_[0] as string}\n`;
        }

        if (arguments_?.[0] === "--version") {
            return "1.0.0\n";
        }

        throw new Error("not found");
    });
};

/**
 * Drive the callback-style `execFile` mock (what `promisify(execFile)` wraps)
 * so the async detection path resolves. `which`/`where` succeeds only for the
 * given command names; `--version` always returns a semver.
 */
const whichResolvesAsync = (...commands: string[]): void => {
    // The promisified call signature is execFile(file, args, options, callback).
    mockExecFile.mockImplementation(((file: string, arguments_: ReadonlyArray<string>, _options: unknown, callback: unknown) => {
        const done = callback as (error: Error | null, result?: { stderr: string; stdout: string }) => void;

        if (file === WHICH_CMD && commands.includes(arguments_[0] as string)) {
            // eslint-disable-next-line unicorn/no-null -- Node callback convention
            done(null, { stderr: "", stdout: `/usr/bin/${arguments_[0] as string}\n` });

            return undefined as never;
        }

        if (arguments_[0] === "--version") {
            // eslint-disable-next-line unicorn/no-null -- Node callback convention
            done(null, { stderr: "", stdout: "1.0.0\n" });

            return undefined as never;
        }

        done(new Error("not found"));

        return undefined as never;
    }) as unknown as typeof execFile);
};

describe(findRunner, () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockExecFileSync.mockImplementation(() => {
            throw new Error("not found");
        });
        mockExistsSync.mockReturnValue(false);
    });

    it("should return undefined when nothing is installed", () => {
        expect.assertions(1);

        expect(findRunner()).toBeUndefined();
    });

    it("should return the first installed provider in default order", () => {
        expect.assertions(1);

        whichResolves("claude", "amp");

        // Default preference order starts at "amp".
        expect(findRunner()?.name).toBe("amp");
    });

    it("should honor a custom preference order", () => {
        expect.assertions(1);

        whichResolves("claude", "amp");

        expect(findRunner(["claude", "amp"])?.name).toBe("claude");
    });

    it("should skip missing preferred providers and fall through to the next", () => {
        expect.assertions(1);

        whichResolves("gemini");

        expect(findRunner(["claude", "codex", "gemini"])?.name).toBe("gemini");
    });

    it("should not probe the version by default", () => {
        expect.assertions(1);

        whichResolves("claude");

        const found = findRunner(["claude"]);

        expect(found?.version).toBeUndefined();
    });

    it("should probe the version when explicitly requested", () => {
        expect.assertions(1);

        whichResolves("claude");

        const found = findRunner(["claude"], { version: true });

        expect(found?.version).toBe("1.0.0");
    });
});

describe(detectProvider, () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockExistsSync.mockReturnValue(false);
    });

    it("should skip the version probe when version is false", () => {
        expect.assertions(2);

        whichResolves("claude");

        const result = detectProvider("claude", { version: false });

        expect(result.available).toBe(true);
        expect(result.version).toBeUndefined();
    });
});

describe(detectAllProvidersAsync, () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockExecFileSync.mockImplementation(() => {
            throw new Error("not found");
        });
        mockExecFile.mockImplementation(((_file: string, _arguments_: ReadonlyArray<string>, _options: unknown, callback: unknown) => {
            (callback as (error: Error | null) => void)(new Error("not found"));

            return undefined as never;
        }) as unknown as typeof execFile);
        mockExistsSync.mockReturnValue(false);
    });

    it("should resolve to the same name/order shape as the sync variant", async () => {
        expect.assertions(2);

        whichResolvesAsync("claude");
        whichResolves("claude");

        const asyncResults = await detectAllProvidersAsync();
        const syncResults = detectAllProviders({ version: false });

        expect(asyncResults).toHaveLength(11);
        expect(asyncResults.map((p) => p.name)).toStrictEqual(syncResults.map((p) => p.name));
    });

    it("should run the per-provider detection concurrently rather than sequentially", async () => {
        expect.assertions(2);

        let inFlight = 0;
        let maxInFlight = 0;

        // Each `which` probe takes a tick; if detection were sequential, only one
        // would ever be in flight at a time. Concurrency drives the peak above 1.
        mockExecFile.mockImplementation(((_file: string, _arguments_: ReadonlyArray<string>, _options: unknown, callback: unknown) => {
            const done = callback as (error: Error | null) => void;

            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);

            setTimeout(() => {
                inFlight -= 1;
                done(new Error("not found"));
            }, 5);

            return undefined as never;
        }) as unknown as typeof execFile);

        const results = await detectAllProvidersAsync();

        expect(results).toHaveLength(11);
        // 11 providers detected in parallel => well above 1 concurrent probe.
        expect(maxInFlight).toBeGreaterThan(1);
    });

    it("should skip the --version probe by default", async () => {
        expect.assertions(3);

        whichResolvesAsync("claude");

        const results = await detectAllProvidersAsync();
        const claude = results.find((provider) => provider.name === "claude");

        expect(claude?.available).toBe(true);
        expect(claude?.version).toBeUndefined();
        // No `--version` call should have been made when probeVersions is off.
        expect(mockExecFile.mock.calls.some((call) => (call[1] as string[] | undefined)?.[0] === "--version")).toBe(false);
    });

    it("should probe versions when probeVersions is true", async () => {
        expect.assertions(2);

        whichResolvesAsync("claude");

        const results = await detectAllProvidersAsync({ probeVersions: true });
        const claude = results.find((provider) => provider.name === "claude");

        expect(claude?.available).toBe(true);
        expect(claude?.version).toBe("1.0.0");
    });
});
