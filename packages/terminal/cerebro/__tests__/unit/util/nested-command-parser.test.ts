import { describe, expect, it } from "vitest";

import { getCommandPathKey, getFullCommandPath, parseNestedCommand } from "../../../src/util/command-processing/nested-command-parser";

describe("nested-command-parser", () => {
    describe(parseNestedCommand, () => {
        it("should return undefined commandPath when argv is empty", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>();
            const result = parseNestedCommand(availableCommands, []);

            expect(result.commandPath).toBeUndefined();
            expect(result.argv).toStrictEqual([]);
        });

        it("should match single-level flat command", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([["build", ["build"]]]);
            const result = parseNestedCommand(availableCommands, ["build", "--production"]);

            expect(result.commandPath).toStrictEqual(["build"]);
            expect(result.argv).toStrictEqual(["--production"]);
        });

        it("should match nested command with two levels", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([["deploy staging", ["deploy", "staging"]]]);
            const result = parseNestedCommand(availableCommands, ["deploy", "staging", "--dry-run"]);

            expect(result.commandPath).toStrictEqual(["deploy", "staging"]);
            expect(result.argv).toStrictEqual(["--dry-run"]);
        });

        it("should match nested command with three levels", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([["db migrate up", ["db", "migrate", "up"]]]);
            const result = parseNestedCommand(availableCommands, ["db", "migrate", "up", "--force"]);

            expect(result.commandPath).toStrictEqual(["db", "migrate", "up"]);
            expect(result.argv).toStrictEqual(["--force"]);
        });

        it("should prefer the longest matching path when both parent and child are registered", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["deploy", ["deploy"]],
                ["deploy staging", ["deploy", "staging"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["deploy", "staging"]);

            expect(result.commandPath).toStrictEqual(["deploy", "staging"]);
            expect(result.argv).toStrictEqual([]);
        });

        it("should fall back to the parent path when a child segment is absent", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["deploy", ["deploy"]],
                ["deploy staging", ["deploy", "staging"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["deploy"]);

            expect(result.commandPath).toStrictEqual(["deploy"]);
            expect(result.argv).toStrictEqual([]);
        });

        it("should match the parent path when only options follow the parent segment", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["deploy", ["deploy"]],
                ["deploy staging", ["deploy", "staging"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["deploy", "--dry-run"]);

            expect(result.commandPath).toStrictEqual(["deploy"]);
            expect(result.argv).toStrictEqual(["--dry-run"]);
        });

        it("should fall back to the parent path when an unmatched positional follows it", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([["deploy", ["deploy"]]]);
            const result = parseNestedCommand(availableCommands, ["deploy", "staging"]);

            expect(result.commandPath).toStrictEqual(["deploy"]);
            expect(result.argv).toStrictEqual(["staging"]);
        });

        it("should return undefined when no match is found", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([["build", ["build"]]]);
            const result = parseNestedCommand(availableCommands, ["unknown", "command"]);

            expect(result.commandPath).toBeUndefined();
            expect(result.argv).toStrictEqual(["unknown", "command"]);
        });

        it("should handle empty argv after matching command", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([["deploy staging", ["deploy", "staging"]]]);
            const result = parseNestedCommand(availableCommands, ["deploy", "staging"]);

            expect(result.commandPath).toStrictEqual(["deploy", "staging"]);
            expect(result.argv).toStrictEqual([]);
        });

        it("should not match partial paths", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([["deploy staging", ["deploy", "staging"]]]);
            const result = parseNestedCommand(availableCommands, ["deploy"]);

            expect(result.commandPath).toBeUndefined();
            expect(result.argv).toStrictEqual(["deploy"]);
        });

        it("should resolve a 3-level child when parent and grandparent both exist", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["db", ["db"]],
                ["db migrate", ["db", "migrate"]],
                ["db migrate up", ["db", "migrate", "up"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["db", "migrate", "up"]);

            expect(result.commandPath).toStrictEqual(["db", "migrate", "up"]);
            expect(result.argv).toStrictEqual([]);
        });

        it("should resolve to the mid-level path when the deepest child is absent", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["db", ["db"]],
                ["db migrate", ["db", "migrate"]],
                ["db migrate up", ["db", "migrate", "up"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["db", "migrate"]);

            expect(result.commandPath).toStrictEqual(["db", "migrate"]);
            expect(result.argv).toStrictEqual([]);
        });

        it("should resolve to the grandparent when only the first segment matches", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["db", ["db"]],
                ["db migrate up", ["db", "migrate", "up"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["db", "migrate"]);

            expect(result.commandPath).toStrictEqual(["db"]);
            expect(result.argv).toStrictEqual(["migrate"]);
        });

        it("should return options as remaining argv when only options follow the parent", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["ai", ["ai"]],
                ["ai providers", ["ai", "providers"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["ai", "--format=json"]);

            expect(result.commandPath).toStrictEqual(["ai"]);
            expect(result.argv).toStrictEqual(["--format=json"]);
        });

        it("should not extend the path past a short option flag", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["ai", ["ai"]],
                ["ai providers", ["ai", "providers"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["ai", "-h"]);

            expect(result.commandPath).toStrictEqual(["ai"]);
            expect(result.argv).toStrictEqual(["-h"]);
        });

        it("should ignore non-prefix paths when picking the longest match", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["build", ["build"]],
                ["build prod", ["build", "prod"]],
                ["test", ["test"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["build", "dev"]);

            expect(result.commandPath).toStrictEqual(["build"]);
            expect(result.argv).toStrictEqual(["dev"]);
        });

        it("should return undefined when only an option flag is supplied", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([["build", ["build"]]]);
            const result = parseNestedCommand(availableCommands, ["--help"]);

            expect(result.commandPath).toBeUndefined();
            expect(result.argv).toStrictEqual(["--help"]);
        });

        it("should resolve to the parent when child segments arrive after an option", () => {
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["ai", ["ai"]],
                ["ai providers", ["ai", "providers"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["ai", "--verbose", "providers"]);

            expect(result.commandPath).toStrictEqual(["ai"]);
            expect(result.argv).toStrictEqual(["--verbose", "providers"]);
        });

        it("should not match a child segment when an option separates it from the parent", () => {
            // Without option-stop, `deploy --flag staging` could greedily match
            // `deploy staging`, dropping the user's flag value into the wrong slot.
            // Stopping at the first `-`-prefixed token preserves the parent-only
            // route and lets the option parser see the flag.
            expect.assertions(2);

            const availableCommands = new Map<string, string[]>([
                ["deploy", ["deploy"]],
                ["deploy staging", ["deploy", "staging"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["deploy", "--flag", "staging"]);

            expect(result.commandPath).toStrictEqual(["deploy"]);
            expect(result.argv).toStrictEqual(["--flag", "staging"]);
        });
    });

    describe(getCommandPathKey, () => {
        it("should join single-element array", () => {
            expect.assertions(1);

            const result = getCommandPathKey(["build"]);

            expect(result).toBe("build");
        });

        it("should join multi-element array with spaces", () => {
            expect.assertions(1);

            const result = getCommandPathKey(["deploy", "staging"]);

            expect(result).toBe("deploy staging");
        });

        it("should join three-element array", () => {
            expect.assertions(1);

            const result = getCommandPathKey(["db", "migrate", "up"]);

            expect(result).toBe("db migrate up");
        });

        it("should handle empty array", () => {
            expect.assertions(1);

            const result = getCommandPathKey([]);

            expect(result).toBe("");
        });
    });

    describe(getFullCommandPath, () => {
        it("should return single-element array when commandPath is not provided", () => {
            expect.assertions(1);

            const result = getFullCommandPath("build");

            expect(result).toStrictEqual(["build"]);
        });

        it("should prepend commandPath to command name", () => {
            expect.assertions(1);

            const result = getFullCommandPath("staging", ["deploy"]);

            expect(result).toStrictEqual(["deploy", "staging"]);
        });

        it("should handle multi-level commandPath", () => {
            expect.assertions(1);

            const result = getFullCommandPath("up", ["db", "migrate"]);

            expect(result).toStrictEqual(["db", "migrate", "up"]);
        });

        it("should return single-element array when commandPath is empty", () => {
            expect.assertions(1);

            const result = getFullCommandPath("build", []);

            expect(result).toStrictEqual(["build"]);
        });

        it("should handle empty commandPath array", () => {
            expect.assertions(1);

            const result = getFullCommandPath("test", []);

            expect(result).toStrictEqual(["test"]);
        });
    });
});
