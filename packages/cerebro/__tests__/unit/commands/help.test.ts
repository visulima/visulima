import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Command as ICommand } from "../../../src/@types/command";
import type { Toolbox as IToolbox } from "../../../src/@types/toolbox";
import HelpCommand from "../../../src/commands/help-command";
import globalOptions from "../../../src/default-options";
import commandLineUsage from "../../../src/util/command-line-usage";

vi.mock(import("../../../src/util/command-line-usage"));
vi.mock(import("../default-options"), () => {
    return {
        default: [
            // Your default options structure here
        ],
    };
});

const loggerMock = {
    debug: vi.fn(),
    raw: vi.fn(),
    warn: vi.fn(),
};

const runtimeMock = {
    getCliName: vi.fn().mockReturnValue("testcli"),
    getCommandSection: vi.fn().mockReturnValue({ footer: "Test footer", header: "Test header" }),
};

const headerSection = {
    content: "testcli <command> [positional arguments] [options]",
    header: " Usage ",
};

const footerSection = {
    content: "Run \"testcli help <command>\" or \"testcli <command> --help\" for help with a specific command.",
    raw: true,
};

const globalOptionsOptionsList = {
    header: " Global Options ",
    optionList: globalOptions,
};

describe("command/help", () => {
    const commandsMap = new Map<string, ICommand>([]);

    beforeEach(() => {
        vi.clearAllMocks();

        commandsMap.clear();

        commandsMap.set("test", {
            description: "A test command",
            execute: () => {},
            group: "test",
            name: "test",
            options: [{ description: "Enable verbose output", name: "verbose" }],
        });
    });

    it("should print general help", () => {
        expect.assertions(3);

        const helpCommand = new HelpCommand(commandsMap);
        const toolboxMock = {
            commandName: "help",
            logger: loggerMock,
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.raw).toHaveBeenNthCalledWith(1, "Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.raw).toHaveBeenNthCalledWith(3, "Test footer");
    });

    it("should print command-specific help", () => {
        expect.assertions(3);

        const helpCommand = new HelpCommand(commandsMap);
        const toolboxMock = {
            commandName: "test",
            logger: loggerMock,
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.raw).toHaveBeenNthCalledWith(1, "Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.raw).toHaveBeenNthCalledWith(3, "Test footer");
    });

    it("should print general help and not include hidden commands", () => {
        expect.assertions(4);

        const secretCommandsMap = new Map([
            // Add a hidden command for testing
            [
                "secret",
                {
                    execute: () => {},
                    hidden: true,
                    name: "secret",
                },
            ],
            [
                "test",
                {
                    description: "A test command",
                    execute: () => {},
                    name: "test",
                    options: [{ description: "Enable verbose output", name: "verbose" }],
                },
            ],
        ]);

        const helpCommand = new HelpCommand(secretCommandsMap);
        const toolboxMock = {
            commandName: "help",
            logger: loggerMock,
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.raw).toHaveBeenNthCalledWith(1, "Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.raw).toHaveBeenNthCalledWith(3, "Test footer");

        // Ensure hidden commands are not included in the output
        const usageCalls = vi.mocked(commandLineUsage).mock.calls[0][0];

        expect(usageCalls.some((section) => section.content?.includes("secret"))).toBe(false);
    });

    it("should display aliases if present", () => {
        expect.assertions(3);

        const commandWithAlias = {
            alias: ["cwa", "aliasForCommand"],
            execute: () => {},
            name: "commandWithAlias",
        };

        commandsMap.set(commandWithAlias.name, commandWithAlias);

        const helpCommand = new HelpCommand(commandsMap);
        const toolboxMock = {
            commandName: "commandWithAlias",
            logger: loggerMock,
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.raw).toHaveBeenNthCalledWith(1, "Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.raw).toHaveBeenNthCalledWith(3, "Test footer");
    });

    it("should display command examples", () => {
        expect.assertions(3);

        const commandWithExamples = {
            examples: ["testcli test --verbose", "testcli test --verbose --debug"],
            execute: () => {},
            name: "commandWithExamples",
        };

        commandsMap.set(commandWithExamples.name, commandWithExamples);

        const helpCommand = new HelpCommand(commandsMap);
        const toolboxMock = {
            commandName: "commandWithExamples",
            logger: loggerMock,
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.raw).toHaveBeenNthCalledWith(1, "Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.raw).toHaveBeenNthCalledWith(3, "Test footer");
    });

    it("should display a empty help command if no commands exists", () => {
        expect.assertions(3);

        const helpCommand = new HelpCommand(new Map());

        const toolboxMock = {
            commandName: "help",
            logger: loggerMock,
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.raw).toHaveBeenNthCalledWith(1, "Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.raw).toHaveBeenNthCalledWith(3, "Test footer");
    });

    it("should display group of commands if the group option is passed", () => {
        expect.assertions(3);

        commandsMap.set("test2", {
            description: "A test2 command",
            execute: () => {},
            group: "test",
            name: "test2",
            options: [{ description: "Enable verbose output", name: "verbose" }],
        });

        commandsMap.set("no-group-test", {
            description: "A test command",
            execute: () => {},
            name: "no-group-test",
            options: [{ description: "Enable verbose output", name: "verbose" }],
        });

        const helpCommand = new HelpCommand(commandsMap);

        const toolboxMock = {
            commandName: "help",
            logger: loggerMock,
            options: {
                group: "test",
            },
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.raw).toHaveBeenNthCalledWith(1, "Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.raw).toHaveBeenNthCalledWith(3, "Test footer");
    });
});
