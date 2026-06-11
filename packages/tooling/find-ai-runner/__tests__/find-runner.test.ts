import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { detectAllProviders, detectAllProvidersAsync, detectProvider, findRunner } from "../src/index";

const IS_WINDOWS = platform() === "win32";
const WHICH_CMD = IS_WINDOWS ? "where" : "which";

vi.mock(import("node:child_process"), () => {
    return {
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
        mockExistsSync.mockReturnValue(false);
    });

    it("should resolve to the same shape as the sync variant", async () => {
        expect.assertions(2);

        whichResolves("claude");

        const asyncResults = await detectAllProvidersAsync();
        const syncResults = detectAllProviders();

        expect(asyncResults).toHaveLength(11);
        expect(asyncResults.map((p) => p.name)).toStrictEqual(syncResults.map((p) => p.name));
    });
});
