import type { Command } from "@visulima/cerebro";
import { createCerebro } from "@visulima/cerebro";
import { describe, expect, it, vi } from "vitest";

import registerCommands from "../../src/register-commands";

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

const createCli = (argv: string[], logger: ReturnType<typeof createLoggerMock>) => {
    const cli = createCerebro("vis", { argv, logger: logger as unknown as Console, packageName: "vis", packageVersion: "0.0.0-test" });

    registerCommands(cli);

    return cli;
};

const fullPath = (command: Command): string[] => [...(command.commandPath ?? []), command.name];

// Every command the binary registers, deduped (the lookup map holds aliases too).
const ALL_COMMANDS: Command[] = (() => {
    const cli = createCli([], createLoggerMock());

    return [...new Set(cli.getCommands().values())] as Command[];
})();

describe("vis --help for every registered command", () => {
    it("should register commands", () => {
        expect.assertions(1);

        expect(ALL_COMMANDS.length).toBeGreaterThan(50);
    });

    // A literal `{` anywhere in a description, example, option or argument is read
    // as colorize template markup. Before visulima/visulima#741 that threw
    // ("Found extraneous } in template literal") and `--help` printed nothing.
    it.each(ALL_COMMANDS.map((command) => [fullPath(command).join(" "), command]))("renders help for `vis %s`", async (name, command) => {
        expect.assertions(2);

        const logger = createLoggerMock();
        const cli = createCli([...fullPath(command), "--help"], logger);

        await cli.run({ shouldExitProcess: false });

        const output = logger.raw.mock.calls.flat().join("\n");

        expect(logger.error).not.toHaveBeenCalled();
        expect(output).toContain(name);
    });
});
