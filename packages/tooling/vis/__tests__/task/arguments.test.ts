import { describe, expect, it } from "vitest";

import type { TaskArgument } from "../../src/task/arguments";
import { parseTaskArguments, renderTaskArgumentsHelp, taskArgumentEnv, taskArgumentEnvName } from "../../src/task/arguments";

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
