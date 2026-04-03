import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { expandArguments } from "../src/command-parser/expand-arguments";
import { expandShortcut } from "../src/command-parser/expand-shortcut";
import { expandWildcard } from "../src/command-parser/expand-wildcard";
import { stripQuotes } from "../src/command-parser/strip-quotes";
import { parseCommands } from "../src/command-parser/index";
import type { ConcurrentCommandConfig } from "../src/types";

const makeConfig = (command: string, name?: string): ConcurrentCommandConfig => ({
    command,
    name,
});

describe("stripQuotes", () => {
    it("should remove surrounding double quotes", () => {
        expect(stripQuotes(makeConfig('"echo hello"')).command).toBe("echo hello");
    });

    it("should remove surrounding single quotes", () => {
        expect(stripQuotes(makeConfig("'echo hello'")).command).toBe("echo hello");
    });

    it("should not modify unquoted commands", () => {
        expect(stripQuotes(makeConfig("echo hello")).command).toBe("echo hello");
    });

    it("should not modify commands with mismatched quotes", () => {
        expect(stripQuotes(makeConfig("\"echo hello'")).command).toBe("\"echo hello'");
    });

    it("should not modify commands with internal quotes", () => {
        expect(stripQuotes(makeConfig('echo "hello world"')).command).toBe('echo "hello world"');
    });

    it("should preserve other config fields", () => {
        const result = stripQuotes({ command: '"echo"', name: "test", cwd: "/tmp" });
        expect(result.name).toBe("test");
        expect(result.cwd).toBe("/tmp");
    });
});

describe("expandShortcut", () => {
    it("should expand npm:build to npm run build", () => {
        expect(expandShortcut(makeConfig("npm:build")).command).toBe("npm run build");
    });

    it("should expand pnpm:test to pnpm run test", () => {
        expect(expandShortcut(makeConfig("pnpm:test")).command).toBe("pnpm run test");
    });

    it("should expand yarn:serve to yarn run serve", () => {
        expect(expandShortcut(makeConfig("yarn:serve")).command).toBe("yarn run serve");
    });

    it("should expand bun:dev to bun run dev", () => {
        expect(expandShortcut(makeConfig("bun:dev")).command).toBe("bun run dev");
    });

    it("should expand node:script to node --run script", () => {
        expect(expandShortcut(makeConfig("node:script")).command).toBe("node --run script");
    });

    it("should expand deno:task to deno task task", () => {
        expect(expandShortcut(makeConfig("deno:task")).command).toBe("deno task task");
    });

    it("should preserve trailing arguments", () => {
        expect(expandShortcut(makeConfig("npm:build --production")).command).toBe("npm run build --production");
    });

    it("should set name to script name when no name given", () => {
        expect(expandShortcut(makeConfig("npm:build")).name).toBe("build");
    });

    it("should not override existing name", () => {
        expect(expandShortcut(makeConfig("npm:build", "my-build")).name).toBe("my-build");
    });

    it("should not modify non-shortcut commands", () => {
        expect(expandShortcut(makeConfig("echo hello")).command).toBe("echo hello");
    });

    it("should not modify full npm run commands", () => {
        expect(expandShortcut(makeConfig("npm run build")).command).toBe("npm run build");
    });
});

describe("expandArguments", () => {
    it("should replace {1} with first argument", () => {
        const result = expandArguments(makeConfig("echo {1}"), ["hello"]);
        expect(result.command).toBe("echo 'hello'");
    });

    it("should replace {2} with second argument", () => {
        const result = expandArguments(makeConfig("echo {2}"), ["a", "b"]);
        expect(result.command).toBe("echo 'b'");
    });

    it("should replace {@} with all arguments individually quoted", () => {
        const result = expandArguments(makeConfig("echo {@}"), ["a", "b", "c"]);
        expect(result.command).toBe("echo 'a' 'b' 'c'");
    });

    it("should replace {*} with all arguments as single quoted string", () => {
        const result = expandArguments(makeConfig("echo {*}"), ["a", "b", "c"]);
        expect(result.command).toBe("echo 'a b c'");
    });

    it("should handle escaped placeholders", () => {
        const result = expandArguments(makeConfig("echo \\{1}"), ["hello"]);
        expect(result.command).toBe("echo {1}");
    });

    it("should replace missing positional with empty string", () => {
        const result = expandArguments(makeConfig("echo {5}"), ["a"]);
        expect(result.command).toBe("echo ");
    });

    it("should handle no additional arguments", () => {
        const result = expandArguments(makeConfig("echo {1}"), []);
        expect(result.command).toBe("echo {1}");
    });

    it("should handle arguments with single quotes", () => {
        const result = expandArguments(makeConfig("echo {1}"), ["it's"]);
        expect(result.command).toBe("echo 'it'\\''s'");
    });

    it("should handle multiple placeholders", () => {
        const result = expandArguments(makeConfig("{1} && {2}"), ["echo a", "echo b"]);
        expect(result.command).toBe("'echo a' && 'echo b'");
    });
});

describe("expandWildcard", () => {
    let fixtureDir: string;

    beforeEach(() => {
        fixtureDir = join(tmpdir(), `expand-wildcard-test-${Date.now()}`);
        mkdirSync(fixtureDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(fixtureDir, { recursive: true, force: true });
    });

    it("should expand npm run watch-* against package.json scripts", () => {
        writeFileSync(
            join(fixtureDir, "package.json"),
            JSON.stringify({
                scripts: {
                    "watch-js": "tsc --watch",
                    "watch-css": "sass --watch",
                    "watch-tests": "vitest --watch",
                    "build": "tsc",
                },
            }),
        );

        const result = expandWildcard({ command: "npm run watch-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);
        const configs = result as ConcurrentCommandConfig[];
        expect(configs).toHaveLength(3);

        const commands = configs.map((c) => c.command).sort();
        expect(commands).toEqual([
            "npm run watch-css",
            "npm run watch-js",
            "npm run watch-tests",
        ]);
    });

    it("should set name to matched script name", () => {
        writeFileSync(
            join(fixtureDir, "package.json"),
            JSON.stringify({ scripts: { "dev-server": "node server.js" } }),
        );

        const result = expandWildcard({ command: "npm run dev-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);
        const configs = result as ConcurrentCommandConfig[];
        expect(configs).toHaveLength(1);
        expect(configs[0]!.name).toBe("dev-server");
    });

    it("should not expand when no wildcard present", () => {
        const config = makeConfig("npm run build");
        const result = expandWildcard(config);
        expect(result).toEqual(config);
    });

    it("should not expand non-run commands", () => {
        const config = makeConfig("echo watch-*");
        const result = expandWildcard(config);
        expect(result).toEqual(config);
    });

    it("should return original config when no scripts match", () => {
        writeFileSync(
            join(fixtureDir, "package.json"),
            JSON.stringify({ scripts: { "build": "tsc" } }),
        );

        const result = expandWildcard({ command: "npm run watch-*", cwd: fixtureDir });
        expect(Array.isArray(result)).toBe(false);
    });

    it("should return original config when package.json is missing", () => {
        const result = expandWildcard({ command: "npm run watch-*", cwd: fixtureDir + "/nonexistent" });
        expect(Array.isArray(result)).toBe(false);
    });

    it("should work with pnpm run wildcards", () => {
        writeFileSync(
            join(fixtureDir, "package.json"),
            JSON.stringify({ scripts: { "lint-js": "eslint", "lint-css": "stylelint" } }),
        );

        const result = expandWildcard({ command: "pnpm run lint-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);
        const configs = result as ConcurrentCommandConfig[];
        expect(configs).toHaveLength(2);
    });

    it("should preserve trailing arguments after wildcard", () => {
        writeFileSync(
            join(fixtureDir, "package.json"),
            JSON.stringify({ scripts: { "test-unit": "vitest", "test-e2e": "playwright" } }),
        );

        const result = expandWildcard({ command: "npm run test-* --verbose", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);
        const configs = result as ConcurrentCommandConfig[];
        expect(configs.every((c) => c.command.endsWith(" --verbose"))).toBe(true);
    });

    it("should not override existing name", () => {
        writeFileSync(
            join(fixtureDir, "package.json"),
            JSON.stringify({ scripts: { "dev-app": "node app.js" } }),
        );

        const result = expandWildcard({ command: "npm run dev-*", name: "my-name", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);
        const configs = result as ConcurrentCommandConfig[];
        expect(configs[0]!.name).toBe("my-name");
    });
});

describe("parseCommands", () => {
    it("should normalize string inputs", () => {
        const result = parseCommands(["echo hello"]);
        expect(result).toHaveLength(1);
        expect(result[0]!.command).toBe("echo hello");
    });

    it("should normalize object inputs", () => {
        const result = parseCommands([{ command: "echo hello", name: "test" }]);
        expect(result).toHaveLength(1);
        expect(result[0]!.command).toBe("echo hello");
        expect(result[0]!.name).toBe("test");
    });

    it("should strip quotes and expand shortcuts in pipeline", () => {
        const result = parseCommands(['"npm:build"']);
        expect(result).toHaveLength(1);
        expect(result[0]!.command).toBe("npm run build");
        expect(result[0]!.name).toBe("build");
    });

    it("should expand arguments when provided", () => {
        const result = parseCommands(["echo {1}"], { additionalArguments: ["world"] });
        expect(result).toHaveLength(1);
        expect(result[0]!.command).toBe("echo 'world'");
    });

    it("should handle empty input", () => {
        expect(parseCommands([])).toEqual([]);
    });

    it("should handle mixed string and object inputs", () => {
        const result = parseCommands([
            "echo one",
            { command: "echo two", name: "second" },
        ]);
        expect(result).toHaveLength(2);
        expect(result[0]!.command).toBe("echo one");
        expect(result[1]!.name).toBe("second");
    });
});
