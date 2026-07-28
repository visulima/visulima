import { describe, expect, it, vi } from "vitest";

import { Cerebro as Cli } from "../../src";

const INVALID_XML_PATTERN = /Invalid value "xml" for option "format"/;
const INVALID_ES2099_PATTERN = /Invalid value "es2099"/;
const UNKNOWN_OPTION_PATTERN = /Found unknown option/;
const INVALID_KEBAB_CHOICE_PATTERN = /Invalid value "silent" for option "log-level"/;
const KEBAB_CONFLICT_PATTERN = /Options "cache-dir" and "dry-run" cannot be used together/;
const KEBAB_MISSING_PATTERN = /is missing required options: log-level/;

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

describe("kebab-case option names", () => {
    // The parser emits camelCased keys (camelCase: true), so validators must
    // resolve hyphenated names via their camelCase form. These cases guard
    // against choices/conflicts/required silently mismatching the parsed keys.
    it("enforces choices for a hyphenated option name", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["run", "--log-level", "silent"] });

        cli.addCommand({
            execute: vi.fn(),
            name: "run",
            options: [{ choices: ["info", "verbose", "debug"], name: "log-level", type: String }],
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(INVALID_KEBAB_CHOICE_PATTERN);
    });

    it("accepts a valid choice for a hyphenated option name", async () => {
        expect.assertions(2);

        let received: unknown;
        const execute = vi.fn(({ options }: { options: Record<string, unknown> }) => {
            received = options.logLevel;
        });
        const cli = new Cli("MyCLI", { argv: ["run", "--log-level", "verbose"] });

        cli.addCommand({
            execute,
            name: "run",
            options: [{ choices: ["info", "verbose", "debug"], name: "log-level", type: String }],
        });

        await cli.run({ shouldExitProcess: false });

        expect(execute).toHaveBeenCalledTimes(1);
        expect(received).toBe("verbose");
    });

    it("enforces conflicts between hyphenated option names", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["build", "--cache-dir", "/tmp", "--dry-run"] });

        cli.addCommand({
            execute: vi.fn(),
            name: "build",
            options: [
                { conflicts: "dry-run", name: "cache-dir", type: String },
                { name: "dry-run", type: Boolean },
            ],
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(KEBAB_CONFLICT_PATTERN);
    });

    it("does not treat a supplied hyphenated required option as missing", async () => {
        expect.assertions(1);

        const execute = vi.fn().mockResolvedValue(undefined);
        const cli = new Cli("MyCLI", { argv: ["run", "--log-level", "info"] });

        cli.addCommand({
            execute,
            name: "run",
            options: [{ name: "log-level", required: true, type: String }],
        });

        await cli.run({ shouldExitProcess: false });

        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("reports a hyphenated required option as missing when omitted", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["run"] });

        cli.addCommand({
            execute: vi.fn(),
            name: "run",
            options: [{ name: "log-level", required: true, type: String }],
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(KEBAB_MISSING_PATTERN);
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
