import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildCliArgs, detectProvider, PROVIDERS } from "../src/index";

const IS_WINDOWS = platform() === "win32";
const WHICH_CMD = IS_WINDOWS ? "where" : "which";

vi.mock(import("node:child_process"), () => {
    return {
        execFile: vi.fn<typeof import("node:child_process").execFile>(),
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

describe("detectProvider edge cases", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockExecFileSync.mockImplementation(() => {
            throw new Error("not found");
        });
        mockExistsSync.mockReturnValue(false);
    });

    it("should expand a leading ~ in the env var path to the home directory", () => {
        expect.assertions(3);

        const originalEnvironment = process.env["CLAUDE_PATH"];
        const expanded = join(homedir(), "bin", "claude");

        process.env["CLAUDE_PATH"] = "~/bin/claude";
        mockExistsSync.mockImplementation((path) => path === expanded);
        mockExecFileSync.mockImplementation((_cmd: string, args?: ReadonlyArray<string>) => {
            if (args?.[0] === "--version") {
                return "1.0.0\n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("claude");

        expect(result.available).toBe(true);
        expect(result.detectionMethod).toBe("envvar");
        expect(result.path).toBe(expanded);

        process.env["CLAUDE_PATH"] = originalEnvironment;
    });

    it("should ignore an env var path that does not exist", () => {
        expect.assertions(2);

        const originalEnvironment = process.env["CLAUDE_PATH"];

        process.env["CLAUDE_PATH"] = "/missing/claude";
        mockExistsSync.mockReturnValue(false);

        const result = detectProvider("claude");

        expect(result.available).toBe(false);
        expect(result.detectionMethod).toBeUndefined();

        process.env["CLAUDE_PATH"] = originalEnvironment;
    });

    it("should treat a blank which result as not found", () => {
        expect.assertions(1);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "claude") {
                return "   \n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("claude");

        expect(result.available).toBe(false);
    });

    it("should leave version undefined when --version output has no semver", () => {
        expect.assertions(2);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "claude") {
                return "/usr/bin/claude\n";
            }

            if (args?.[0] === "--version") {
                return "claude code (latest build)\n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("claude");

        expect(result.available).toBe(true);
        expect(result.version).toBeUndefined();
    });
});

describe("buildCliArgs with empty model overrides", () => {
    it("should omit the opencode model flag when the model is an empty string", () => {
        expect.assertions(2);

        const args = buildCliArgs("opencode", "do it", { model: "" });

        expect(args).toStrictEqual(["run", "--", "do it"]);
        expect(args).not.toContain("-m");
    });

    it("should omit the opencode model flag when no default is set (provider-default)", () => {
        expect.assertions(2);

        // opencode now defaults to the provider-default (empty) model.
        expect(PROVIDERS.opencode.defaultModel).toBe("");

        const args = buildCliArgs("opencode", "do it");

        expect(args).not.toContain("-m");
    });
});
