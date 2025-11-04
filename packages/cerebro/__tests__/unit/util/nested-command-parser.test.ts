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

        it("should match shorter path first when both exist", () => {
            expect.assertions(2);

            // The parser checks depth-first (depth 1, then 2, etc.), so shorter paths match first
            const availableCommands = new Map<string, string[]>([
                ["deploy", ["deploy"]],
                ["deploy staging", ["deploy", "staging"]],
            ]);
            const result = parseNestedCommand(availableCommands, ["deploy", "staging"]);

            // It matches "deploy" first (depth 1) before checking "deploy staging" (depth 2)
            expect(result.commandPath).toStrictEqual(["deploy"]);
            expect(result.argv).toStrictEqual(["staging"]);
        });

        it("should match shorter path when it comes first in iteration", () => {
            expect.assertions(2);

            // Since we iterate depth-first, shorter paths checked first will match
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
