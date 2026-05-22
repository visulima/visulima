import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { expandArguments } from "../../../src/command-parser/expand-arguments";
import { expandShortcut } from "../../../src/command-parser/expand-shortcut";
import { expandWildcard } from "../../../src/command-parser/expand-wildcard";
import { parseCommands } from "../../../src/command-parser/index";
import { stripQuotes } from "../../../src/command-parser/strip-quotes";
import type { ConcurrentCommandConfig } from "../../../src/types";

const makeConfig = (command: string, name?: string): ConcurrentCommandConfig => {
    return {
        command,
        name,
    };
};

describe(stripQuotes, () => {
    it("should remove surrounding double quotes", () => {
        expect.assertions(1);

        expect(stripQuotes(makeConfig('"echo hello"')).command).toBe("echo hello");
    });

    it("should remove surrounding single quotes", () => {
        expect.assertions(1);

        expect(stripQuotes(makeConfig("'echo hello'")).command).toBe("echo hello");
    });

    it("should not modify unquoted commands", () => {
        expect.assertions(1);

        expect(stripQuotes(makeConfig("echo hello")).command).toBe("echo hello");
    });

    it("should not modify commands with mismatched quotes", () => {
        expect.assertions(1);

        expect(stripQuotes(makeConfig("\"echo hello'")).command).toBe("\"echo hello'");
    });

    it("should not modify commands with internal quotes", () => {
        expect.assertions(1);

        expect(stripQuotes(makeConfig('echo "hello world"')).command).toBe('echo "hello world"');
    });

    it("should preserve other config fields", () => {
        expect.assertions(2);

        const result = stripQuotes({ command: '"echo"', cwd: "/tmp", name: "test" });

        expect(result.name).toBe("test");
        expect(result.cwd).toBe("/tmp");
    });
});

describe(expandShortcut, () => {
    it("should expand npm:build to npm run build", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("npm:build")).command).toBe("npm run build");
    });

    it("should expand pnpm:test to pnpm run test", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("pnpm:test")).command).toBe("pnpm run test");
    });

    it("should expand yarn:serve to yarn run serve", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("yarn:serve")).command).toBe("yarn run serve");
    });

    it("should expand bun:dev to bun run dev", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("bun:dev")).command).toBe("bun run dev");
    });

    it("should expand node:script to node --run script", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("node:script")).command).toBe("node --run script");
    });

    it("should expand deno:task to deno task task", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("deno:task")).command).toBe("deno task task");
    });

    it("should preserve trailing arguments", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("npm:build --production")).command).toBe("npm run build --production");
    });

    it("should set name to script name when no name given", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("npm:build")).name).toBe("build");
    });

    it("should not override existing name", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("npm:build", "my-build")).name).toBe("my-build");
    });

    it("should not modify non-shortcut commands", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("echo hello")).command).toBe("echo hello");
    });

    it("should not modify full npm run commands", () => {
        expect.assertions(1);

        expect(expandShortcut(makeConfig("npm run build")).command).toBe("npm run build");
    });
});

describe(expandArguments, () => {
    it("should replace {1} with first argument", () => {
        expect.assertions(1);

        const result = expandArguments(makeConfig("echo {1}"), ["hello"]);

        expect(result.command).toBe("echo hello");
    });

    it("should replace {2} with second argument", () => {
        expect.assertions(1);

        const result = expandArguments(makeConfig("echo {2}"), ["a", "b"]);

        expect(result.command).toBe("echo b");
    });

    it("should replace {@} with all arguments individually quoted", () => {
        expect.assertions(1);

        const result = expandArguments(makeConfig("echo {@}"), ["a", "b", "c"]);

        expect(result.command).toBe("echo a b c");
    });

    it("should replace {*} with all arguments as single quoted string", () => {
        // The joined form contains a space and so still needs quoting;
        // POSIX picks single quotes, Windows picks double quotes.
        expect.assertions(1);

        const result = expandArguments(makeConfig("echo {*}"), ["a", "b", "c"]);

        expect(result.command).toBe(process.platform === "win32" ? "echo \"a b c\"" : "echo 'a b c'");
    });

    it("should handle escaped placeholders", () => {
        expect.assertions(1);

        const result = expandArguments(makeConfig(String.raw`echo \{1}`), ["hello"]);

        expect(result.command).toBe("echo {1}");
    });

    it("should replace missing positional with empty string", () => {
        expect.assertions(1);

        const result = expandArguments(makeConfig("echo {5}"), ["a"]);

        expect(result.command).toBe("echo ");
    });

    it("should handle no additional arguments", () => {
        expect.assertions(1);

        const result = expandArguments(makeConfig("echo {1}"), []);

        expect(result.command).toBe("echo {1}");
    });

    it("should handle arguments with single quotes", () => {
        expect.assertions(1);

        const result = expandArguments(makeConfig("echo {1}"), ["it's"]);

        expect(result.command).toBe(String.raw`echo 'it'\''s'`);
    });

    it("should handle multiple placeholders", () => {
        expect.assertions(1);

        const result = expandArguments(makeConfig("{1} && {2}"), ["echo a", "echo b"]);

        expect(result.command).toBe("'echo a' && 'echo b'");
    });
});

describe(expandWildcard, () => {
    let fixtureDir: string;

    beforeEach(() => {
        fixtureDir = join(tmpdir(), `expand-wildcard-test-${Date.now()}`);
        mkdirSync(fixtureDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(fixtureDir, { force: true, recursive: true });
    });

    it("should expand npm run watch-* against package.json scripts", () => {
        expect.assertions(3);

        writeFileSync(
            join(fixtureDir, "package.json"),
            JSON.stringify({
                scripts: {
                    build: "tsc",
                    "watch-css": "sass --watch",
                    "watch-js": "tsc --watch",
                    "watch-tests": "vitest --watch",
                },
            }),
        );

        const result = expandWildcard({ command: "npm run watch-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs).toHaveLength(3);

        const commands = configs.map((c) => c.command).sort();

        expect(commands).toStrictEqual(["npm run watch-css", "npm run watch-js", "npm run watch-tests"]);
    });

    it("should set name to matched script name", () => {
        expect.assertions(3);

        writeFileSync(join(fixtureDir, "package.json"), JSON.stringify({ scripts: { "dev-server": "node server.js" } }));

        const result = expandWildcard({ command: "npm run dev-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs).toHaveLength(1);
        expect(configs[0]!.name).toBe("dev-server");
    });

    it("should not expand when no wildcard present", () => {
        expect.assertions(1);

        const config = makeConfig("npm run build");
        const result = expandWildcard(config);

        expect(result).toStrictEqual(config);
    });

    it("should not expand non-run commands", () => {
        expect.assertions(1);

        const config = makeConfig("echo watch-*");
        const result = expandWildcard(config);

        expect(result).toStrictEqual(config);
    });

    it("should return original config when no scripts match", () => {
        expect.assertions(1);

        writeFileSync(join(fixtureDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));

        const result = expandWildcard({ command: "npm run watch-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(false);
    });

    it("should return original config when package.json is missing", () => {
        expect.assertions(1);

        const result = expandWildcard({ command: "npm run watch-*", cwd: `${fixtureDir}/nonexistent` });

        expect(Array.isArray(result)).toBe(false);
    });

    it("should work with pnpm run wildcards", () => {
        expect.assertions(2);

        writeFileSync(join(fixtureDir, "package.json"), JSON.stringify({ scripts: { "lint-css": "stylelint", "lint-js": "eslint" } }));

        const result = expandWildcard({ command: "pnpm run lint-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs).toHaveLength(2);
    });

    it("should preserve trailing arguments after wildcard", () => {
        expect.assertions(2);

        writeFileSync(join(fixtureDir, "package.json"), JSON.stringify({ scripts: { "test-e2e": "playwright", "test-unit": "vitest" } }));

        const result = expandWildcard({ command: "npm run test-* --verbose", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs.every((c) => c.command.endsWith(" --verbose"))).toBe(true);
    });

    it("should not override existing name", () => {
        expect.assertions(2);

        writeFileSync(join(fixtureDir, "package.json"), JSON.stringify({ scripts: { "dev-app": "node app.js" } }));

        const result = expandWildcard({ command: "npm run dev-*", cwd: fixtureDir, name: "my-name" });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs[0]!.name).toBe("my-name");
    });

    it("should expand deno task wildcards from deno.json", () => {
        expect.assertions(3);

        writeFileSync(
            join(fixtureDir, "deno.json"),
            JSON.stringify({
                tasks: {
                    build: "deno compile",
                    "dev-api": "deno run api.ts",
                    "dev-web": "deno run web.ts",
                },
            }),
        );

        const result = expandWildcard({ command: "deno task dev-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs).toHaveLength(2);

        const commands = configs.map((c) => c.command).sort();

        expect(commands).toStrictEqual(["deno task dev-api", "deno task dev-web"]);
    });

    it("should expand deno task wildcards from deno.jsonc", () => {
        expect.assertions(2);

        writeFileSync(
            join(fixtureDir, "deno.jsonc"),
            `{
                // This is a comment
                "tasks": {
                    "test-unit": "deno test unit/",
                    "test-e2e": "deno test e2e/"
                }
            }`,
        );

        const result = expandWildcard({ command: "deno task test-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs).toHaveLength(2);
    });

    it("should handle deno.jsonc with URLs in string values", () => {
        expect.assertions(3);

        writeFileSync(
            join(fixtureDir, "deno.jsonc"),
            `{
                // Import map
                "imports": { "std/": "https://deno.land/std/" },
                "tasks": {
                    "dev-serve": "deno run --allow-net https://example.com/server.ts"
                }
            }`,
        );

        const result = expandWildcard({ command: "deno task dev-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs).toHaveLength(1);
        expect(configs[0]!.command).toContain("dev-serve");
    });

    it("should give deno.json tasks precedence over package.json scripts", () => {
        expect.assertions(3);

        writeFileSync(join(fixtureDir, "deno.json"), JSON.stringify({ tasks: { "dev-app": "deno run app.ts" } }));
        writeFileSync(join(fixtureDir, "package.json"), JSON.stringify({ scripts: { "dev-app": "node app.js" } }));

        const result = expandWildcard({ command: "deno task dev-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs).toHaveLength(1);
        // deno.json task should win over package.json script
        expect(configs[0]!.command).toContain("dev-app");
    });

    it("should merge deno.json tasks with package.json scripts for deno", () => {
        expect.assertions(3);

        writeFileSync(join(fixtureDir, "deno.json"), JSON.stringify({ tasks: { "dev-deno": "deno run main.ts" } }));
        writeFileSync(join(fixtureDir, "package.json"), JSON.stringify({ scripts: { "dev-node": "node main.js" } }));

        const result = expandWildcard({ command: "deno task dev-*", cwd: fixtureDir });

        expect(Array.isArray(result)).toBe(true);

        const configs = result as ConcurrentCommandConfig[];

        expect(configs).toHaveLength(2);

        const names = configs.map((c) => c.name).sort();

        expect(names).toStrictEqual(["dev-deno", "dev-node"]);
    });
});

describe(parseCommands, () => {
    it("should normalize string inputs", () => {
        expect.assertions(2);

        const result = parseCommands(["echo hello"]);

        expect(result).toHaveLength(1);
        expect(result[0]!.command).toBe("echo hello");
    });

    it("should normalize object inputs", () => {
        expect.assertions(3);

        const result = parseCommands([{ command: "echo hello", name: "test" }]);

        expect(result).toHaveLength(1);
        expect(result[0]!.command).toBe("echo hello");
        expect(result[0]!.name).toBe("test");
    });

    it("should strip quotes and expand shortcuts in pipeline", () => {
        expect.assertions(3);

        const result = parseCommands(['"npm:build"']);

        expect(result).toHaveLength(1);
        expect(result[0]!.command).toBe("npm run build");
        expect(result[0]!.name).toBe("build");
    });

    it("should expand arguments when provided", () => {
        expect.assertions(2);

        const result = parseCommands(["echo {1}"], { additionalArguments: ["world"] });

        expect(result).toHaveLength(1);
        expect(result[0]!.command).toBe("echo world");
    });

    it("should handle empty input", () => {
        expect.assertions(1);

        expect(parseCommands([])).toStrictEqual([]);
    });

    it("should handle mixed string and object inputs", () => {
        expect.assertions(3);

        const result = parseCommands(["echo one", { command: "echo two", name: "second" }]);

        expect(result).toHaveLength(2);
        expect(result[0]!.command).toBe("echo one");
        expect(result[1]!.name).toBe("second");
    });
});
