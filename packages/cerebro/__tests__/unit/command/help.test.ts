import { beforeEach, Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";

import type { Command as ICommand, Toolbox as IToolbox } from "../../../src/@types";
import HelpCommand from "../../../src/command/help";
import commandLineUsage from "../../../src/util/command-line-usage";
import globalOptions from "../../../src/default-options";

vi.mock("../../../src/util/command-line-usage");
vi.mock("../default-options", () => {
    return {
        default: [
            // Your default options structure here
        ],
    };
});

const loggerMock = {
    debug: vi.fn(),
    log: vi.fn(),
    warning: vi.fn(),
};

const runtimeMock = {
    getCliName: vi.fn().mockReturnValue("testcli"),
    getCommandSection: vi.fn().mockReturnValue({ footer: "Test footer", header: "Test header" }),
};

const headerSection = {
    content: "{cyan testcli} {green <command>} [positional arguments] {yellow [options]}",
    header: "{inverse.cyan  Usage }",
};

const footerSection = {
    content: 'Run "{cyan testcli} {green help <command>}" or "{cyan testcli} {green <command>} {yellow --help}" for help with a specific command.',
    raw: true,
};

const globalOptionsOptionsList = {
    header: "{inverse.yellow  Global Options }",
    optionList: globalOptions,
};

describe("command/help", () => {
    const commandsMap = new Map<string, ICommand>([]);

    beforeEach(() => {
        vi.clearAllMocks();

        commandsMap.clear();

        commandsMap.set("test", {
            description: "A test command",
            group: "test",
            execute: () => {},
            name: "test",
            options: [{ description: "Enable verbose output", name: "verbose" }],
        });
    });

    it("should print general help", () => {
        const helpCommand = new HelpCommand(commandsMap);
        const toolboxMock = {
            commandName: "help",
            logger: loggerMock,
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.log).toHaveBeenCalledWith("Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.log).toHaveBeenCalledWith("Test footer");
    });

    it("should print command-specific help", () => {
        const helpCommand = new HelpCommand(commandsMap);
        const toolboxMock = {
            commandName: "test",
            logger: loggerMock,
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.log).toHaveBeenCalledWith("Test header");
        expect(commandLineUsage).toHaveBeenCalledWith([
            {
                content: "{cyan testcli} {green test} [options]",
                header: "{inverse.cyan  Usage }",
            },
            {
                content: "A test command",
                header: "{inverse.green  Description }",
            },
            {
                header: "{inverse.yellow  Command Options }",
                optionList: [
                    {
                        description: "Enable verbose output",
                        name: "verbose",
                    },
                ],
            },
            globalOptionsOptionsList,
        ]);
        expect(loggerMock.log).toHaveBeenCalledWith("Test footer");
    });

    it("should print general help and not include hidden commands", () => {
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

        expect(loggerMock.log).toHaveBeenCalledWith("Test header");
        expect(commandLineUsage).toHaveBeenCalledWith([
            headerSection,
            {
                content: [["{green test} ", "A test command"]],
                header: "{inverse.green  Available Commands }",
            },
            globalOptionsOptionsList,
            footerSection,
        ]);
        expect(loggerMock.log).toHaveBeenCalledWith("Test footer");

        // Ensure hidden commands are not included in the output
        const usageCalls = (commandLineUsage as Mock).mock.calls[0][0];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        expect(usageCalls.some((section) => section.content?.includes("secret"))).toBeFalsy();
    });

    it("should display aliases if present", () => {
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

        expect(loggerMock.log).toHaveBeenCalledWith("Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.log).toHaveBeenCalledWith("Test footer");
    });

    it("should display command examples", () => {
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

        expect(loggerMock.log).toHaveBeenCalledWith("Test header");
        expect(commandLineUsage).toHaveBeenCalledWith([
            {
                content: "{cyan testcli} {green commandWithExamples}",
                header: "{inverse.cyan  Usage }",
            },
            globalOptionsOptionsList,
            {
                content: ["testcli test --verbose", "testcli test --verbose --debug"],
                header: "Examples",
            },
        ]);
        expect(loggerMock.log).toHaveBeenCalledWith("Test footer");
    });

    it("should display a empty help command if no commands exists", () => {
        const helpCommand = new HelpCommand(new Map());

        const toolboxMock = {
            commandName: "help",
            logger: loggerMock,
            runtime: runtimeMock,
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.log).toHaveBeenCalledWith("Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.log).toHaveBeenCalledWith("Test footer");
    });

    it("should display group of commands if the group option is passed", () => {
        commandsMap.set("test2", {
            description: "A test2 command",
            group: "test",
            execute: () => {},
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
            runtime: runtimeMock,
            options: {
                group: "test",
            },
        };

        helpCommand.execute(toolboxMock as unknown as IToolbox);

        expect(loggerMock.log).toHaveBeenCalledWith("Test header");
        expect(commandLineUsage).toMatchSnapshot();
        expect(loggerMock.log).toHaveBeenCalledWith("Test footer");
    });
});
