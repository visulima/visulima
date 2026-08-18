import { describe, expect, it, vi } from "vitest";

import { Cerebro as Cli } from "../../src";
import defineCommand from "../../src/define-command";
import type { CommandInput } from "../../src/types/command";
import normalizeCommandDefinitions from "../../src/util/command-processing/normalize-command";

const INVALID_CHOICE_PATTERN = /Invalid value "xml" for option "format"/;
const OPTIONS_OBJECT_PATTERN = /Command options must be an object/;

// Typed as the real public input shape rather than `never`: the claim under test
// is that `addCommand` accepts both forms, which a cast would hide.
const runBuild = async (argv: string[], options: CommandInput["options"]): Promise<Record<string, unknown>> => {
    const execute = vi.fn();
    const cli = new Cli("MyCLI", { argv });

    cli.addCommand({ execute, name: "build", options });

    await cli.run({ shouldExitProcess: false });

    return (execute.mock.calls[0] as [{ options: Record<string, unknown> }])[0].options;
};

describe("record-shaped option definitions", () => {
    it("parses the record form exactly like the array form", async () => {
        expect.assertions(2);

        const fromArray = await runBuild(
            ["build", "--output-dir", "dist", "-v"],
            [
                { name: "output-dir", type: String },
                { alias: "v", name: "verbose", type: Boolean },
            ],
        );

        const fromRecord = await runBuild(["build", "--output-dir", "dist", "-v"], {
            "output-dir": { type: String },
            verbose: { alias: "v", type: Boolean },
        });

        expect(fromRecord).toStrictEqual(fromArray);
        expect(fromRecord).toMatchObject({ outputDir: "dist", verbose: true });
    });

    it("applies required, defaultValue and choices from the record form", async () => {
        expect.assertions(1);

        const options = await runBuild(["build", "--format", "json"], {
            format: { choices: ["json", "yaml"], required: true, type: String },
            retries: { defaultValue: 3, type: Number },
        });

        expect(options).toMatchObject({ format: "json", retries: 3 });
    });

    it("rejects a record option that violates its choices", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["fmt", "--format", "xml"] });

        cli.addCommand({ execute: vi.fn(), name: "fmt", options: { format: { choices: ["json", "yaml"], type: String } } });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(INVALID_CHOICE_PATTERN);
    });

    it("generates the negated counterpart for a record-declared no- option", async () => {
        expect.assertions(1);

        const options = await runBuild(["build", "--no-clean"], { "no-clean": { type: Boolean } });

        expect(options).toMatchObject({ clean: false });
    });

    it("reads environment variables declared as a record", async () => {
        expect.assertions(1);

        const execute = vi.fn();
        const cli = new Cli("MyCLI", { argv: ["build"], env: { API_KEY: "secret", PORT: "8080" } });

        cli.addCommand({
            env: { API_KEY: { type: String }, PORT: { type: Number }, TIMEOUT: { defaultValue: 30, type: Number } },
            execute,
            name: "build",
        });

        await cli.run({ shouldExitProcess: false });

        expect((execute.mock.calls[0] as [{ env: Record<string, unknown> }])[0].env).toStrictEqual({ apiKey: "secret", port: 8080, timeout: 30 });
    });

    it("accepts a defineCommand result without any toolbox annotation", async () => {
        expect.assertions(1);

        const seen: unknown[] = [];
        const build = defineCommand({
            env: { API_KEY: { type: String } },
            execute: ({ env, options }) => {
                seen.push(options.outputDir, options.verbose, env.apiKey);
            },
            name: "build",
            options: {
                "output-dir": { required: true, type: String },
                verbose: { defaultValue: false, type: Boolean },
            },
        });

        const cli = new Cli("MyCLI", { argv: ["build", "--output-dir", "dist"], env: { API_KEY: "secret" } });

        cli.addCommand(build);

        await cli.run({ shouldExitProcess: false });

        expect(seen).toStrictEqual(["dist", false, "secret"]);
    });
});

describe(normalizeCommandDefinitions, () => {
    it("returns the command untouched when nothing needs converting", () => {
        expect.assertions(1);

        const command = { env: undefined, options: [{ name: "verbose", type: Boolean }] };

        expect(normalizeCommandDefinitions(command)).toBe(command);
    });

    it("converts a record onto a copy, leaving the caller's object alone", () => {
        expect.assertions(3);

        const command = { options: { verbose: { type: Boolean } } };
        const normalized = normalizeCommandDefinitions(command);

        expect(normalized).not.toBe(command);
        expect(normalized.options).toStrictEqual([{ name: "verbose", type: Boolean }]);
        // The caller still holds the record it wrote, which is what
        // `defineCommand` types it as.
        expect(command.options).toStrictEqual({ verbose: { type: Boolean } });
    });
});

describe("command registration robustness", () => {
    it("registers a frozen command", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");

        expect(() => cli.addCommand(Object.freeze({ execute: vi.fn(), name: "frozen" }))).not.toThrow();
    });

    it("keeps a defineCommand result's record types honest after registration", () => {
        expect.assertions(2);

        const build = defineCommand({
            execute: () => undefined,
            name: "build",
            options: { verbose: { type: Boolean } },
        });

        new Cli("MyCLI").addCommand(build);

        // `DefinedCommand.options` is typed as the record, so it must still be one.
        expect(build.options).toStrictEqual({ verbose: { type: Boolean } });
        expect(Array.isArray(build.options)).toBe(false);
    });

    it("reports a malformed options value as an object error, not a TypeError", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");

        expect(() => cli.addCommand({ execute: vi.fn(), name: "b", options: null } as never)).toThrow(OPTIONS_OBJECT_PATTERN);
    });
});
