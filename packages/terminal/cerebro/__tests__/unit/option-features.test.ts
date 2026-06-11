import { describe, expect, it, vi } from "vitest";

import { Cerebro as Cli } from "../../src";

const INVALID_XML_PATTERN = /Invalid value "xml" for option "format"/;
const INVALID_ES2099_PATTERN = /Invalid value "es2099"/;
const UNKNOWN_OPTION_PATTERN = /Found unknown option/;

describe("option choices", () => {
    it("accepts a value that is one of the declared choices", async () => {
        expect.assertions(1);

        const execute = vi.fn().mockResolvedValue(undefined);
        const cli = new Cli("MyCLI", { argv: ["fmt", "--format", "json"] });

        cli.addCommand({
            execute,
            name: "fmt",
            options: [{ choices: ["json", "yaml", "table"], name: "format", type: String }],
        });

        await cli.run({ shouldExitProcess: false });

        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("rejects a value that is not one of the declared choices", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["fmt", "--format", "xml"] });

        cli.addCommand({
            execute: vi.fn(),
            name: "fmt",
            options: [{ choices: ["json", "yaml", "table"], name: "format", type: String }],
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(INVALID_XML_PATTERN);
    });

    it("validates every member of a multiple option", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["build", "--target", "es5", "--target", "es2099"] });

        cli.addCommand({
            execute: vi.fn(),
            name: "build",
            options: [{ choices: ["es5", "es2015", "esnext"], multiple: true, name: "target", type: String }],
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(INVALID_ES2099_PATTERN);
    });

    it("skips validation when the option is not provided", async () => {
        expect.assertions(1);

        const execute = vi.fn().mockResolvedValue(undefined);
        const cli = new Cli("MyCLI", { argv: ["fmt"] });

        cli.addCommand({
            execute,
            name: "fmt",
            options: [{ choices: ["json", "yaml"], name: "format", type: String }],
        });

        await cli.run({ shouldExitProcess: false });

        expect(execute).toHaveBeenCalledTimes(1);
    });
});

describe("strict options", () => {
    // Commands that declare a positional `argument` bypass the built-in
    // unknown-option check, so by default a typo'd `--flag` is silently routed
    // to rawUnknown — this is the gap strict mode closes.
    it("does not reject unknown options by default when the command takes a positional argument", async () => {
        expect.assertions(2);

        let captured: ReadonlyArray<string> = [];
        const execute = vi.fn(({ rawUnknown }: { rawUnknown: ReadonlyArray<string> }) => {
            captured = rawUnknown;
        });
        const cli = new Cli("MyCLI", { argv: ["build", "app", "--produciton"] });

        cli.addCommand({
            argument: { name: "target", type: String },
            execute,
            name: "build",
        });

        await cli.run({ shouldExitProcess: false });

        expect(execute).toHaveBeenCalledTimes(1);
        expect(captured).toContain("--produciton");
    });

    it("rejects unknown long options before the -- separator when strictOptions is enabled", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["build", "app", "--produciton"], strictOptions: true });

        cli.addCommand({
            argument: { name: "target", type: String },
            execute: vi.fn(),
            name: "build",
            options: [{ name: "production", type: Boolean }],
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(UNKNOWN_OPTION_PATTERN);
    });

    it("preserves passthrough tokens after -- even in strict mode", async () => {
        expect.assertions(2);

        let captured: ReadonlyArray<string> = [];
        const cli = new Cli("MyCLI", { argv: ["build", "app", "--", "--anything"], strictOptions: true });

        const execute = vi.fn(({ rawUnknown }: { rawUnknown: ReadonlyArray<string> }) => {
            captured = rawUnknown;
        });

        cli.addCommand({ argument: { name: "target", type: String }, execute, name: "build" });

        await cli.run({ shouldExitProcess: false });

        expect(execute).toHaveBeenCalledTimes(1);
        expect(captured).toContain("--anything");
    });
});
