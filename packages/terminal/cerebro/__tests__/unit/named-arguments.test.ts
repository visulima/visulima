import { describe, expect, it, vi } from "vitest";

import { Cerebro as Cli } from "../../src";
import defineCommand from "../../src/define-command";
import type { ArgumentDefinition } from "../../src/types/command";

const MISSING_REQUIRED_PATTERN = /is missing required arguments: source/;
const BOTH_ARGUMENT_FORMS_PATTERN = /cannot define both "argument" and "arguments"/;
const MISPLACED_VARIADIC_PATTERN = /variadic positional "sources" that is not the last one/;
const RECORD_ARGUMENTS_PATTERN = /must declare "arguments" as an array/;
const DUPLICATE_ARGUMENT_PATTERN = /duplicate positional argument "x"/;
const REQUIRED_AFTER_OPTIONAL_PATTERN = /required positional "target" after an optional one/;
const INVALID_CHOICE_PATTERN = /Invalid value "nope" for option "source"/;
const FOLDED_DUPLICATE_PATTERN = /duplicate positional argument "aB"/;
const NON_OBJECT_PATTERN = /at index 0 that is not an object/;
const SURPLUS_PATTERN = /accepts 2 positional arguments, but got 1 extra: c/;

// Typed as the real public shape, not `never` — the point of these specs is that
// `addCommand` accepts this input, which a cast would hide.
const runCopy = async (argv: string[], commandArguments: ArgumentDefinition[]): Promise<Record<string, unknown>> => {
    const execute = vi.fn();
    const cli = new Cli("MyCLI", { argv });

    cli.addCommand({ arguments: commandArguments, execute, name: "copy" });

    await cli.run({ shouldExitProcess: false });

    return (execute.mock.calls[0] as [{ args: Record<string, unknown> }])[0].args;
};

describe("named positional arguments", () => {
    it("maps positionals onto their declared names in order", async () => {
        expect.assertions(1);

        const args = await runCopy(
            ["copy", "a.txt", "b.txt"],
            [
                { name: "source", type: String },
                { name: "target", type: String },
            ],
        );

        expect(args).toStrictEqual({ source: "a.txt", target: "b.txt" });
    });

    it("collects the remaining positionals into a trailing multiple argument", async () => {
        expect.assertions(1);

        const args = await runCopy(
            ["copy", "a.txt", "b/", "c/"],
            [
                { name: "source", type: String },
                { multiple: true, name: "targets", type: String },
            ],
        );

        expect(args).toStrictEqual({ source: "a.txt", targets: ["b/", "c/"] });
    });

    it("applies each argument's own type transform", async () => {
        expect.assertions(1);

        const args = await runCopy(
            ["copy", "file", "42"],
            [
                { name: "source", type: String },
                { name: "count", type: Number },
            ],
        );

        expect(args).toStrictEqual({ count: 42, source: "file" });
    });

    it("falls back to defaultValue for a missing argument", async () => {
        expect.assertions(1);

        const args = await runCopy(
            ["copy", "a.txt"],
            [
                { name: "source", type: String },
                { defaultValue: "./", name: "target", type: String },
            ],
        );

        expect(args).toStrictEqual({ source: "a.txt", target: "./" });
    });

    it("leaves an unsupplied optional argument undefined", async () => {
        expect.assertions(1);

        const args = await runCopy(
            ["copy", "a.txt"],
            [
                { name: "source", type: String },
                { name: "target", type: String },
            ],
        );

        expect(args).toStrictEqual({ source: "a.txt", target: undefined });
    });

    it("folds hyphenated argument names and leaves snake case alone", async () => {
        expect.assertions(1);

        // Same rule the option parser uses, so `args` and `options` key alike.
        const args = await runCopy(
            ["copy", "a.txt", "b.txt"],
            [
                { name: "source-file", type: String },
                { name: "target_dir", type: String },
            ],
        );

        expect(args).toStrictEqual({ sourceFile: "a.txt", target_dir: "b.txt" });
    });

    it("excludes the -- passthrough segment from the declared slots", async () => {
        expect.assertions(2);

        const execute = vi.fn();
        const cli = new Cli("MyCLI", { argv: ["run", "vite", "--", "--template", "react"] });

        cli.addCommand({
            arguments: [
                { name: "tool", type: String },
                { name: "target", type: String },
            ],
            execute,
            name: "run",
        });

        await cli.run({ shouldExitProcess: false });

        const toolbox = (execute.mock.calls[0] as [{ args: Record<string, unknown>; rawUnknown: ReadonlyArray<string> }])[0];

        // Without the trim, `--template` would be bound to `target`.
        expect(toolbox.args).toStrictEqual({ target: undefined, tool: "vite" });
        expect(toolbox.rawUnknown).toStrictEqual(["--", "--template", "react"]);
    });

    it("rejects a missing required argument as an argument, not an option", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["copy"] });

        cli.addCommand({ arguments: [{ name: "source", required: true, type: String }], execute: vi.fn(), name: "copy" });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(MISSING_REQUIRED_PATTERN);
    });

    it("rejects more positionals than the command declares", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["copy", "a", "b", "c"] });

        cli.addCommand({
            arguments: [
                { name: "source", type: String },
                { name: "target", type: String },
            ],
            execute: vi.fn(),
            name: "copy",
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(SURPLUS_PATTERN);
    });

    it("still exposes the raw positional list on toolbox.argument", async () => {
        expect.assertions(1);

        const execute = vi.fn();
        const cli = new Cli("MyCLI", { argv: ["copy", "a.txt", "b.txt"] });

        cli.addCommand({
            arguments: [
                { name: "source", type: String },
                { name: "target", type: String },
            ],
            execute,
            name: "copy",
        });

        await cli.run({ shouldExitProcess: false });

        expect((execute.mock.calls[0] as [{ argument: string[] }])[0].argument).toStrictEqual(["a.txt", "b.txt"]);
    });

    it("gives commands without named arguments an empty args object", async () => {
        expect.assertions(1);

        const execute = vi.fn();
        const cli = new Cli("MyCLI", { argv: ["build"] });

        cli.addCommand({ execute, name: "build" });

        await cli.run({ shouldExitProcess: false });

        expect((execute.mock.calls[0] as [{ args: Record<string, unknown> }])[0].args).toStrictEqual({});
    });

    it("types args inside a defineCommand execute handler", async () => {
        expect.assertions(1);

        const seen: unknown[] = [];
        const copy = defineCommand({
            arguments: [
                { name: "source", required: true, type: String },
                { multiple: true, name: "targets", type: String },
            ],
            execute: ({ args }) => {
                seen.push(args.source, args.targets);
            },
            name: "copy",
        });

        const cli = new Cli("MyCLI", { argv: ["copy", "a.txt", "b/", "c/"] });

        cli.addCommand(copy);

        await cli.run({ shouldExitProcess: false });

        expect(seen).toStrictEqual(["a.txt", ["b/", "c/"]]);
    });
});

describe("positional argument behaviour", () => {
    it("enforces choices on a positional", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["copy", "nope"] });

        cli.addCommand({ arguments: [{ choices: ["yes", "no"], name: "source", type: String }], execute: vi.fn(), name: "copy" });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(INVALID_CHOICE_PATTERN);
    });

    it("keeps a hidden positional out of the help output", async () => {
        expect.assertions(2);

        const lines: string[] = [];
        const cli = new Cli("MyCLI", {
            argv: ["help", "copy"],
            logger: { ...console, log: (line: string) => lines.push(line) } as unknown as Console,
        });

        cli.addCommand({
            arguments: [
                { hidden: true, name: "secret", type: String },
                { name: "shown", type: String },
            ],
            execute: vi.fn(),
            name: "copy",
        });

        await cli.run({ shouldExitProcess: false });

        const output = lines.join("\n");

        expect(output).not.toContain("secret");
        expect(output).toContain("shown");
    });

    it("wraps a scalar defaultValue for an empty variadic slot", async () => {
        expect.assertions(1);

        const args = await runCopy(["copy"], [{ defaultValue: "x", multiple: true, name: "rest", type: String }]);

        expect(args).toStrictEqual({ rest: ["x"] });
    });

    it("folds positional names the way the option parser folds them", async () => {
        expect.assertions(1);

        // Only a hyphen before an ASCII lowercase letter folds; `a_b` and `UPPER`
        // are left exactly as declared, matching `toolbox.options`.
        const args = await runCopy(
            ["copy", "1", "2", "3"],
            [
                { name: "source-file", type: String },
                { name: "a_b", type: String },
                { name: "UPPER", type: String },
            ],
        );

        expect(Object.keys(args)).toStrictEqual(["sourceFile", "a_b", "UPPER"]);
    });
});

describe("positional argument declaration validation", () => {
    const register = (command: Record<string, unknown>): void => {
        new Cli("MyCLI").addCommand({ execute: vi.fn(), name: "copy", ...command });
    };

    it("rejects a command that declares both argument and arguments", () => {
        expect.assertions(1);

        expect(() => {
            register({ argument: { name: "file", type: String }, arguments: [{ name: "source", type: String }] });
        }).toThrow(BOTH_ARGUMENT_FORMS_PATTERN);
    });

    it("rejects a variadic argument that is not the last one", () => {
        expect.assertions(1);

        expect(() => {
            register({
                arguments: [
                    { multiple: true, name: "sources", type: String },
                    { name: "target", type: String },
                ],
            });
        }).toThrow(MISPLACED_VARIADIC_PATTERN);
    });

    it("rejects arguments given as a record with an explanation, not a TypeError", () => {
        expect.assertions(1);

        expect(() => {
            register({ arguments: { source: { type: String } } });
        }).toThrow(RECORD_ARGUMENTS_PATTERN);
    });

    it("rejects duplicate positional names", () => {
        expect.assertions(1);

        expect(() => {
            register({
                arguments: [
                    { name: "x", type: String },
                    { name: "x", type: Number },
                ],
            });
        }).toThrow(DUPLICATE_ARGUMENT_PATTERN);
    });

    it("rejects positional names that collide once folded", () => {
        expect.assertions(1);

        expect(() => {
            register({
                arguments: [
                    { name: "a-b", type: String },
                    { name: "aB", type: String },
                ],
            });
        }).toThrow(FOLDED_DUPLICATE_PATTERN);
    });

    it("rejects a non-object positional entry", () => {
        expect.assertions(1);

        expect(() => {
            register({ arguments: [null] });
        }).toThrow(NON_OBJECT_PATTERN);
    });

    it("rejects a required positional behind an optional one", () => {
        expect.assertions(1);

        expect(() => {
            register({
                arguments: [
                    { name: "source", type: String },
                    { name: "target", required: true, type: String },
                ],
            });
        }).toThrow(REQUIRED_AFTER_OPTIONAL_PATTERN);
    });
});
