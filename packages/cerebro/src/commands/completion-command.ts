import { env } from "node:process";

import tab from "@bomb.sh/tab";

import type { Command as ICommand, OptionDefinition } from "../@types/command";
import type { Toolbox as IToolbox } from "../@types/toolbox";

const validShells = ["bash", "zsh", "fish", "powershell"];
const validRuntimes = ["node", "bun", "deno"];

/**
 * Detects the current JavaScript runtime.
 * @returns The detected runtime (node, bun, or deno)
 */
const detectRuntime = (): string => {
    // Check for Deno
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((globalThis as any).Deno !== undefined) {
        return "deno";
    }

    // Check for Bun
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((globalThis as any).Bun !== undefined) {
        return "bun";
    }

    // Default to Node.js
    return "node";
};

/**
 * Detects the current shell from environment variables.
 * @returns The detected shell name or undefined if not detected
 */
const detectShell = (): string | undefined => {
    // Check SHELL environment variable (Unix-like systems)
    const shell = env.STARSHIP_SHELL ?? env.SHELL;

    if (shell) {
        const shellPath = shell.toLowerCase();

        if (shellPath.includes("zsh")) {
            return "zsh";
        }

        if (shellPath.includes("bash")) {
            return "bash";
        }

        if (shellPath.includes("fish")) {
            return "fish";
        }
    }

    // Check for PowerShell on Windows
    if (env.PSModulePath || env.PROMPT?.includes("PS")) {
        return "powershell";
    }

    // Check ComSpec for Windows Command Prompt (not supported, but return bash as fallback)
    if (env.ComSpec?.toLowerCase().includes("cmd.exe")) {
        return "bash"; // Fallback to bash
    }

    return undefined;
};

/**
 * Registers options for a command.
 * @param cmd The command instance
 * @param options Command options to register
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerCommandOptions = (cmd: any, options: OptionDefinition<unknown>[]): void => {
    for (const option of options) {
        if (option.hidden) {
            continue;
        }

        // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
        const optionNames = (option as any).__names__ || [option.name];
        const primaryName = optionNames[0];

        if (primaryName) {
            cmd.option(primaryName, option.description || "");
        }
    }
};

/**
 * Registers CLI commands with the tab completion system.
 * @param tabInstance The tab instance to register commands with
 * @param commands Map of CLI commands to register
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerCommands = (tabInstance: any, commands: Map<string, ICommand>): void => {
    for (const [commandName, command] of commands) {
        // Skip aliases and hidden commands
        if (command.name !== commandName || command.hidden) {
            continue;
        }

        const cmd = tabInstance.command(command.name, command.description || "");

        // Add command options
        if (command.options) {
            registerCommandOptions(cmd, command.options);
        }
    }
};

/**
 * Prints usage instructions for the completion command.
 * @param logger Logger instance
 * @param cliName Name of the CLI application
 */
const printUsageInstructions = (logger: Console, cliName: string): void => {
    logger.error("Could not detect current shell");
    logger.info(`Usage: ${cliName} completion --shell=<bash|zsh|fish|powershell> [--runtime=<node|bun|deno>]`);
    logger.info("");
    logger.info("Examples:");
    logger.info(`  # Install completions for zsh:`);
    logger.info(`  ${cliName} completion --shell=zsh > ~/.${cliName}-completion.zsh`);
    logger.info(`  echo 'source ~/.${cliName}-completion.zsh' >> ~/.zshrc`);
    logger.info("");
    logger.info(`  # Install completions for bash with custom runtime:`);
    logger.info(`  ${cliName} completion --shell=bash --runtime=bun > ~/.${cliName}-completion.bash`);
    logger.info(`  echo 'source ~/.${cliName}-completion.bash' >> ~/.bashrc`);
    logger.info("");
    logger.info(`  # Install completions for fish:`);
    logger.info(`  ${cliName} completion --shell=fish > ~/.config/fish/completions/${cliName}.fish`);
};

/**
 * Generates shell completion scripts for the CLI application.
 */
const completionCommand: ICommand = {
    description: "Generate shell completion scripts",
    execute: async ({ logger, options, runtime }: IToolbox) => {
        const cliName = runtime.getCliName();

        const shell = options?.shell as string;

        if (!shell) {
            printUsageInstructions(logger, cliName);

            return;
        }

        try {
            // Register all commands from the CLI
            registerCommands(tab, runtime.getCommands());

            // Use provided runtime or detect it
            const jsRuntime = options?.runtime as string;
            const scriptPath = `${jsRuntime} ${cliName}`;

            tab.setup(cliName, scriptPath, shell);
        } catch (error) {
            logger.error("Failed to generate completion script:");
            logger.error(error instanceof Error ? error.message : String(error));
        }
    },
    name: "completion",
    options: [
        {
            defaultOption: true,
            defaultValue: detectShell(),
            description: "Shell type (bash, zsh, fish, powershell). Defaults to current shell if detected.",
            name: "shell",
            type: (input: string) => {
                if (!validShells.includes(input)) {
                    throw new Error(`Invalid shell type: ${input}. Valid shells are: ${validShells.join(", ")}`);
                }

                return input;
            },
            typeLabel: "{underline shell}",
        } satisfies OptionDefinition<typeof detectShell>,
        {
            defaultOption: true,
            defaultValue: detectRuntime(),
            description: "JavaScript runtime (node, bun, deno). Defaults to current runtime if detected.",
            name: "runtime",
            type: (input: string): string => {
                if (!validRuntimes.includes(input)) {
                    throw new Error(`Invalid runtime: ${input}. Valid runtimes are: ${validRuntimes.join(", ")}`);
                }

                return input;
            },
            typeLabel: "{underline runtime}",
        } satisfies OptionDefinition<typeof detectRuntime>,
    ],
} satisfies ICommand;

export default completionCommand;
