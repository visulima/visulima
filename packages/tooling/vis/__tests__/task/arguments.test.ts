import { describe, expect, it } from "vitest";

import type { TaskArgument } from "../../src/task/arguments";
import {
    parseTaskArguments,
    renderTaskArgumentsHelp,
    taskArgumentEnv,
    taskArgumentEnvName,
    validateArgumentSchema,
} from "../../src/task/arguments";

describe(parseTaskArguments, () => {
    it("parses --flag=value and --flag value forms", () => {
        expect.assertions(1);

        const schema: TaskArgument[] = [{ name: "reporter" }, { name: "config" }];
        const result = parseTaskArguments(schema, ["--reporter=verbose", "--config", "vitest.config.ts"]);

        expect(result).toStrictEqual({ errors: [], values: { config: "vitest.config.ts", reporter: "verbose" } });
    });

    it("resolves a short alias", () => {
        expect.assertions(1);

        const schema: TaskArgument[] = [{ alias: "r", name: "reporter" }];

        expect(parseTaskArguments(schema, ["-r", "dot"]).values).toStrictEqual({ reporter: "dot" });
    });

    it("coerces boolean flags including the --no- form", () => {
        expect.assertions(2);

        const schema: TaskArgument[] = [{ name: "watch", type: "boolean" }];

        expect(parseTaskArguments(schema, ["--watch"]).values).toStrictEqual({ watch: true });
        expect(parseTaskArguments(schema, ["--no-watch"]).values).toStrictEqual({ watch: false });
    });

    it("coerces numbers and reports a bad number", () => {
        expect.assertions(2);

        const schema: TaskArgument[] = [{ name: "retries", type: "number" }];

        expect(parseTaskArguments(schema, ["--retries=3"]).values).toStrictEqual({ retries: 3 });
        expect(parseTaskArguments(schema, ["--retries=abc"]).errors).toStrictEqual([`--retries expects a number, got "abc"`]);
    });

    it("rejects empty and non-finite numbers", () => {
        expect.assertions(2);

        const schema: TaskArgument[] = [{ name: "retries", type: "number" }];

        // `Number("")` is 0 and `Number("Infinity")` is finite-looking — both must fail.
        expect(parseTaskArguments(schema, ["--retries="]).errors).toStrictEqual([`--retries expects a number, got ""`]);
        expect(parseTaskArguments(schema, ["--retries=Infinity"]).errors).toStrictEqual([
            `--retries expects a number, got "Infinity"`,
        ]);
    });

    it("consumes a negative number as a value, not a flag", () => {
        expect.assertions(1);

        const schema: TaskArgument[] = [{ name: "offset", type: "number" }];

        expect(parseTaskArguments(schema, ["--offset", "-5"]).values).toStrictEqual({ offset: -5 });
    });

    it("consumes an explicit boolean value without leaving a stray positional", () => {
        expect.assertions(2);

        const schema: TaskArgument[] = [
            { name: "watch", type: "boolean" },
            { name: "file", positional: true },
        ];

        // `false` is consumed by --watch, so it must NOT fill the positional `file`.
        expect(parseTaskArguments(schema, ["--watch", "false"]).values).toStrictEqual({ watch: false });
        // A non-boolean token after a boolean flag stays a positional.
        expect(parseTaskArguments(schema, ["--watch", "a.ts"]).values).toStrictEqual({ file: "a.ts", watch: true });
    });

    it("validates enum choices", () => {
        expect.assertions(2);

        const schema: TaskArgument[] = [{ choices: ["dev", "prod"], name: "mode", type: "enum" }];

        expect(parseTaskArguments(schema, ["--mode=prod"]).values).toStrictEqual({ mode: "prod" });
        expect(parseTaskArguments(schema, ["--mode=staging"]).errors).toStrictEqual([
            `--mode must be one of [dev, prod], got "staging"`,
        ]);
    });

    it("applies defaults and enforces required", () => {
        expect.assertions(2);

        const schema: TaskArgument[] = [
            { default: "info", name: "level" },
            { name: "target", required: true },
        ];

        expect(parseTaskArguments(schema, []).values).toStrictEqual({ level: "info" });
        expect(parseTaskArguments(schema, []).errors).toStrictEqual(["missing required argument --target"]);
    });

    it("fills positional arguments in declaration order", () => {
        expect.assertions(1);

        const schema: TaskArgument[] = [
            { name: "src", positional: true },
            { name: "dest", positional: true },
        ];

        expect(parseTaskArguments(schema, ["a.ts", "b.ts"]).values).toStrictEqual({ dest: "b.ts", src: "a.ts" });
    });

    it("ignores unknown flags so they pass through to the command", () => {
        expect.assertions(1);

        const schema: TaskArgument[] = [{ name: "reporter" }];

        // `--bail` is not declared; it must not error (the command still gets it).
        expect(parseTaskArguments(schema, ["--reporter=dot", "--bail"]).errors).toStrictEqual([]);
    });
});

describe(validateArgumentSchema, () => {
    it("accepts a well-formed schema", () => {
        expect.assertions(1);

        const schema: TaskArgument[] = [
            { alias: "r", name: "reporter" },
            { choices: ["dev", "prod"], default: "dev", name: "mode", type: "enum" },
            { default: 0, name: "retries", type: "number" },
        ];

        expect(validateArgumentSchema(schema)).toStrictEqual([]);
    });

    it("flags a multi-character alias", () => {
        expect.assertions(1);

        expect(validateArgumentSchema([{ alias: "rep", name: "reporter" }])).toStrictEqual([
            `argument "reporter" alias "rep" must be a single character`,
        ]);
    });

    it("flags an enum without choices", () => {
        expect.assertions(1);

        expect(validateArgumentSchema([{ name: "mode", type: "enum" }])).toStrictEqual([
            `argument "mode" has type "enum" but declares no choices`,
        ]);
    });

    it("flags a default that does not match the type", () => {
        expect.assertions(1);

        expect(validateArgumentSchema([{ default: "abc", name: "retries", type: "number" }])).toStrictEqual([
            `argument "retries" default "abc" does not match type "number"`,
        ]);
    });

    it("flags an empty / invalid name and duplicates", () => {
        expect.assertions(2);

        expect(validateArgumentSchema([{ name: "" }])[0]).toContain("is empty or invalid");
        expect(validateArgumentSchema([{ name: "dup" }, { name: "dup" }])).toContain(`duplicate argument name "dup"`);
    });
});

describe(taskArgumentEnvName, () => {
    it("upper-snake-cases the name", () => {
        expect.assertions(2);

        expect(taskArgumentEnvName("reporter")).toBe("VIS_ARG_REPORTER");
        expect(taskArgumentEnvName("min-age")).toBe("VIS_ARG_MIN_AGE");
    });
});

describe(taskArgumentEnv, () => {
    it("stringifies values into a VIS_ARG_* block", () => {
        expect.assertions(1);

        expect(taskArgumentEnv({ retries: 3, watch: true })).toStrictEqual({
            VIS_ARG_RETRIES: "3",
            VIS_ARG_WATCH: "true",
        });
    });
});

describe(renderTaskArgumentsHelp, () => {
    it("renders usage, description, and each argument with metadata", () => {
        expect.assertions(4);

        const help = renderTaskArgumentsHelp("test", "Run the test suite", [
            { alias: "r", description: "Reporter name", name: "reporter" },
            { choices: ["dev", "prod"], name: "mode", required: true, type: "enum" },
            { default: 0, name: "retries", type: "number" },
        ]);

        expect(help).toContain("Usage: vis run test");
        expect(help).toContain("Run the test suite");
        expect(help).toContain("--mode");
        expect(help).toContain("enum(dev|prod), required");
    });
});
