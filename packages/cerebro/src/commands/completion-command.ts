import { env } from "node:process";

import tab from "@bomb.sh/tab";

import type { Command as ICommand, OptionDefinition } from "../types/command";
import type { Toolbox as IToolbox } from "../types/toolbox";

const validShells = ["bash", "zsh", "fish", "powershell"];
const validRuntimes = ["node", "bun", "deno"];

/**
 * Custom error class for completion command errors.
 */
class CompletionError extends Error {
    public readonly code: string;

    public readonly troubleshooting: string[];

    public constructor(message: string, code: string, troubleshooting: string[] = []) {
        super(message);
        this.name = "CompletionError";
        this.code = code;
        this.troubleshooting = troubleshooting;
    }
}

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

        // Register the primary name
        if (option.name) {
            cmd.option(option.name, option.description || "");
        }

        // Register alias if it exists
        if (option.alias) {
            cmd.option(option.alias, option.description || "");
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
 * Validates shell option value.
 * @param shell Shell value to validate
 * @throws {CompletionError} If shell is invalid
 */
const validateShell = (shell: string): void => {
    if (!validShells.includes(shell)) {
        throw new CompletionError(`Invalid shell type: ${shell}`, "INVALID_SHELL", [
            `Valid shells are: ${validShells.join(", ")}`,
            "Shell will be auto-detected if not specified",
        ]);
    }
};

/**
 * Validates runtime option value.
 * @param runtime Runtime value to validate
 * @throws {CompletionError} If runtime is invalid
 */
const validateRuntime = (runtime: string | undefined): void => {
    if (runtime && !validRuntimes.includes(runtime)) {
        throw new CompletionError(`Invalid runtime: ${runtime}`, "INVALID_RUNTIME", [
            `Valid runtimes are: ${validRuntimes.join(", ")}`,
            "Runtime will be auto-detected if not specified",
        ]);
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
            // Validate options
            validateShell(shell);
            validateRuntime(options?.runtime as string | undefined);
            // Register all commands from the CLI
            registerCommands(tab, runtime.getCommands());

            // Use provided runtime or detect it
            const jsRuntime = (options?.runtime as string) || detectRuntime();
            const scriptPath = `${jsRuntime} ${cliName}`;

            tab.setup(cliName, scriptPath, shell);
        } catch (error) {
            if (error instanceof CompletionError) {
                logger.error(`Failed to generate completion script: ${error.message}`);
                logger.error(`Error code: ${error.code}`);

                if (error.troubleshooting.length > 0) {
                    logger.info("");
                    logger.info("Troubleshooting:");

                    for (const tip of error.troubleshooting) {
                        logger.info(`  • ${tip}`);
                    }
                }

                // Re-throw to allow callers to handle the error
                throw error;
            } else {
                const errorMessage = error instanceof Error ? error.message : String(error);

                logger.error("Failed to generate completion script");
                logger.error(`Error: ${errorMessage}`);
                logger.info("");
                logger.info("Troubleshooting:");
                logger.info("  • Ensure @bomb.sh/tab is installed: pnpm add @bomb.sh/tab");
                logger.info(`  • Verify shell is supported: ${validShells.join(", ")}`);
                logger.info(`  • Verify runtime is supported: ${validRuntimes.join(", ")}`);
                logger.info("  • Check that your CLI name is correct");
            }
        }
    },
    name: "completion",
    options: [
        {
            defaultOption: true,
            defaultValue: detectShell(),
            description: "Shell type (bash, zsh, fish, powershell). Defaults to current shell if detected.",
            name: "shell",
            type: String,
            typeLabel: "{underline shell}",
        } satisfies OptionDefinition<string>,
        {
            defaultOption: true,
            defaultValue: detectRuntime(),
            description: "JavaScript runtime (node, bun, deno). Defaults to current runtime if detected.",
            name: "runtime",
            type: String,
            typeLabel: "{underline runtime}",
        } satisfies OptionDefinition<string>,
    ],
} satisfies ICommand;

export default completionCommand;
