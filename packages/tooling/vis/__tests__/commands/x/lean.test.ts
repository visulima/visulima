/**
 * Tests for `vis x` lean-path argument parsing — the rule that `--runtime` is
 * recognised only before the file, and everything after the file (flags
 * included) is forwarded to the script verbatim.
 */
import { describe, expect, it } from "vitest";

import { parseLeanXArgs } from "../../../src/commands/x/lean";

describe(parseLeanXArgs, () => {
    it("treats the first non-flag token as the file", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["script.ts"])).toStrictEqual({
            file: "script.ts",
            runtimeFlag: undefined,
            scriptArguments: [],
        });
    });

    it("forwards positional args after the file to the script", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["script.ts", "a", "b"])).toStrictEqual({
            file: "script.ts",
            runtimeFlag: undefined,
            scriptArguments: ["a", "b"],
        });
    });

    it("forwards flags after the file to the script (not consumed by vis)", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["script.ts", "--watch", "--runtime", "bun"])).toStrictEqual({
            file: "script.ts",
            runtimeFlag: undefined,
            scriptArguments: ["--watch", "--runtime", "bun"],
        });
    });

    it("consumes a single `--` separator between the file and its args", () => {
        expect.hasAssertions();

        // Matches the registered handler (cerebro eats the separator): the script
        // sees its real args, not a literal "--".
        expect(parseLeanXArgs(["script.ts", "--", "--watch"])).toStrictEqual({
            file: "script.ts",
            runtimeFlag: undefined,
            scriptArguments: ["--watch"],
        });

        // Only the FIRST `--` is the separator; a later one is a real script arg.
        expect(parseLeanXArgs(["script.ts", "--", "a", "--", "b"])).toStrictEqual({
            file: "script.ts",
            runtimeFlag: undefined,
            scriptArguments: ["a", "--", "b"],
        });
    });

    it("reads --runtime <id> before the file", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["--runtime", "bun", "script.ts", "x"])).toStrictEqual({
            file: "script.ts",
            runtimeFlag: "bun",
            scriptArguments: ["x"],
        });
    });

    it("reads --runtime=<id> before the file", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["--runtime=node", "script.ts"])).toStrictEqual({
            file: "script.ts",
            runtimeFlag: "node",
            scriptArguments: [],
        });
    });

    it("returns undefined file when only a runtime flag is given", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["--runtime", "bun"])).toStrictEqual({
            file: undefined,
            runtimeFlag: "bun",
            scriptArguments: [],
        });
    });

    it("returns undefined file for empty argv", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs([])).toStrictEqual({
            file: undefined,
            runtimeFlag: undefined,
            scriptArguments: [],
        });
    });
});
