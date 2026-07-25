import { describe, expect, it, vi } from "vitest";

import { Cerebro as Cli } from "../../../src";

const createLoggerMock = () => {
    return {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        log: vi.fn(),
        raw: vi.fn(),
        warn: vi.fn(),
    };
};

// Verbatim strings from https://github.com/visulima/visulima/issues/741 — every
// one of them crashed `--help` with "Found extraneous } in template literal".
const BRACE_DESCRIPTION = "Lint engines.{node,pnpm}, packageManager, volta.*, devEngines.* for drift across packages";
const BRACE_EXAMPLE = "Flag empty dependency blocks (`dependencies: {}`, `devDependencies: {}`, …) across the workspace";
const BRACE_SUBCOMMAND_DESCRIPTION = "Generate CI workflow files. GitHub → `.github/workflows/vis-release{,-check,-snapshot}.yml`.";
const BRACE_OPTION_DESCRIPTION = "Emit a JSON `{ name: { from, to } }` map instead of pretty lines";

describe("help with braces in command metadata", () => {
    it("should render command help when the description and examples contain literal braces", async () => {
        expect.assertions(3);

        const loggerMock = createLoggerMock();

        const cli = new Cli("MyCLI", { argv: ["deps", "--help"], logger: loggerMock as unknown as Console });

        cli.addCommand({
            description: BRACE_DESCRIPTION,
            examples: [BRACE_EXAMPLE],
            execute: vi.fn(),
            name: "deps",
        });

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(loggerMock.error).not.toHaveBeenCalled();
        expect(helpOutput).toContain("engines.{node,pnpm}");
        expect(helpOutput).toContain("`dependencies: {}`");
    });

    it("should render command help when an option description contains literal braces", async () => {
        expect.assertions(2);

        const loggerMock = createLoggerMock();

        const cli = new Cli("MyCLI", { argv: ["next-version", "--help"], logger: loggerMock as unknown as Console });

        cli.addCommand({
            description: "Print the next version of every package",
            execute: vi.fn(),
            name: "next-version",
            options: [{ description: BRACE_OPTION_DESCRIPTION, name: "json", type: Boolean }],
        });

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(loggerMock.error).not.toHaveBeenCalled();
        expect(helpOutput).toContain("{ name: { from, to } }");
    });

    it("should render nested command help when the description contains literal braces", async () => {
        expect.assertions(2);

        const loggerMock = createLoggerMock();

        const cli = new Cli("MyCLI", { argv: ["release", "ci", "plan", "--help"], logger: loggerMock as unknown as Console });

        cli.addCommand({
            commandPath: ["release", "ci"],
            description: BRACE_SUBCOMMAND_DESCRIPTION,
            execute: vi.fn(),
            name: "plan",
        });

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(loggerMock.error).not.toHaveBeenCalled();
        expect(helpOutput).toContain("vis-release{,-check,-snapshot}.yml");
    });

    it("should render general help when a listed command has braces in its description", async () => {
        expect.assertions(2);

        const loggerMock = createLoggerMock();

        const cli = new Cli("MyCLI", { argv: ["help"], logger: loggerMock as unknown as Console });

        cli.addCommand({
            description: BRACE_DESCRIPTION,
            execute: vi.fn(),
            name: "deps",
        });

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(loggerMock.error).not.toHaveBeenCalled();
        expect(helpOutput).toContain("engines.{node,pnpm}");
    });

    it("should render an unbalanced opening brace as plain text", async () => {
        expect.assertions(2);

        const loggerMock = createLoggerMock();

        const cli = new Cli("MyCLI", { argv: ["scaffold", "--help"], logger: loggerMock as unknown as Console });

        cli.addCommand({
            // `{bold ` opens a style that is never closed — the parser throws
            // "template literal is missing 1 closing bracket".
            description: "Write {bold to disk",
            execute: vi.fn(),
            name: "scaffold",
        });

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(loggerMock.error).not.toHaveBeenCalled();
        expect(helpOutput).toContain("{bold to disk");
    });

    it("should still apply template styling to well-formed descriptions", async () => {
        expect.assertions(2);

        const loggerMock = createLoggerMock();

        const cli = new Cli("MyCLI", { argv: ["styled", "--help"], logger: loggerMock as unknown as Console });

        cli.addCommand({
            description: "Run the {red dangerous} step",
            execute: vi.fn(),
            name: "styled",
        });

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(helpOutput).toContain("dangerous");
        expect(helpOutput).not.toContain("{red dangerous}");
    });
});
