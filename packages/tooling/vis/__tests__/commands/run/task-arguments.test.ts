import { describe, expect, it } from "vitest";

import { resolveTaskArguments } from "../../../src/commands/run/task-arguments";
import type { TaskArgument } from "../../../src/task/arguments";

const SCHEMA: TaskArgument[] = [
    { alias: "r", description: "Reporter", name: "reporter" },
    { choices: ["dev", "prod"], name: "mode", required: true, type: "enum" },
    { default: 0, name: "retries", type: "number" },
];

describe(resolveTaskArguments, () => {
    it("returns an empty ok result when the target declares no schema", () => {
        expect.assertions(1);

        expect(resolveTaskArguments("test", undefined, undefined, ["--anything"])).toStrictEqual({ env: {}, kind: "ok" });
    });

    it("renders help when --help is forwarded", () => {
        expect.assertions(2);

        const result = resolveTaskArguments("test", "Run tests", SCHEMA, ["--help"]);

        expect(result.kind).toBe("help");
        expect(result.kind === "help" && result.text).toContain("Usage: vis run test");
    });

    it("reports validation errors with help for invalid input", () => {
        expect.assertions(3);

        // `mode` is required + must be an enum; `retries` must be a number.
        const result = resolveTaskArguments("test", undefined, SCHEMA, ["--mode=staging", "--retries=abc"]);

        expect(result.kind).toBe("invalid");
        expect(result.kind === "invalid" && result.errors).toStrictEqual([
            `--mode must be one of [dev, prod], got "staging"`,
            `--retries expects a number, got "abc"`,
        ]);
        expect(result.kind === "invalid" && result.help).toContain("--mode");
    });

    it("flags a missing required argument", () => {
        expect.assertions(2);

        const result = resolveTaskArguments("test", undefined, SCHEMA, ["--reporter=dot"]);

        expect(result.kind).toBe("invalid");
        expect(result.kind === "invalid" && result.errors).toStrictEqual(["missing required argument --mode"]);
    });

    it("returns the VIS_ARG_* env block for valid input (with defaults + alias)", () => {
        expect.assertions(1);

        const result = resolveTaskArguments("test", undefined, SCHEMA, ["-r", "dot", "--mode", "prod"]);

        // reporter via alias, mode provided, retries defaulted to 0.
        expect(result).toStrictEqual({
            env: { VIS_ARG_MODE: "prod", VIS_ARG_REPORTER: "dot", VIS_ARG_RETRIES: "0" },
            kind: "ok",
        });
    });
});
