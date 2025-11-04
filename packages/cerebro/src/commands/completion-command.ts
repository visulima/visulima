import tab from "@bomb.sh/tab";

import CompletionError from "../errors/completion-error";
import type { Command as ICommand, EnvDefinition, OptionDefinition } from "../types/command";
import type { Toolbox as IToolbox } from "../types/toolbox";

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
 * @param toolboxEnv Optional env object from toolbox (camelCase keys)
 * @returns The detected shell name or undefined if not detected
 */
const detectShell = (toolboxEnv?: Record<string, unknown>): string | undefined => {
    // Prefer shell from toolbox.env if available (camelCase: STARSHIP_SHELL -> starshipShell, SHELL -> shell)
    const starshipShell = toolboxEnv?.starshipShell as string | undefined;
    const shell = starshipShell ?? (toolboxEnv?.shell as string | undefined);

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

    // Check for PowerShell on Windows (from toolbox.env or process.env)
    const psModulePath = toolboxEnv?.psModulePath as string | undefined;
    const prompt = toolboxEnv?.prompt as string | undefined;

    if (psModulePath || prompt?.includes("PS")) {
        return "powershell";
    }

    // Check ComSpec for Windows Command Prompt (not supported, but return bash as fallback)
    const comSpec = toolboxEnv?.comSpec as string | undefined;

    if (comSpec?.toLowerCase().includes("cmd.exe")) {
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

    const usageInfo = [
        `Usage: ${cliName} completion --shell=<bash|zsh|fish|powershell> [--runtime=<node|bun|deno>]`,
        "",
        "Examples:",
        `  # Install completions for zsh:`,
        `  ${cliName} completion --shell=zsh > ~/.${cliName}-completion.zsh`,
        `  echo 'source ~/.${cliName}-completion.zsh' >> ~/.zshrc`,
        "",
        `  # Install completions for bash with custom runtime:`,
        `  ${cliName} completion --shell=bash --runtime=bun > ~/.${cliName}-completion.bash`,
        `  echo 'source ~/.${cliName}-completion.bash' >> ~/.bashrc`,
        "",
        `  # Install completions for fish:`,
        `  ${cliName} completion --shell=fish > ~/.config/fish/completions/${cliName}.fish`,
    ].join("\n");

    logger.info(usageInfo);
};

/**
 * Generates shell completion scripts for the CLI application.
 */
const completionCommand: ICommand = {
    description: "Generate shell completion scripts",
    env: [
        {
            description: "Shell path (Unix-like systems). Used for shell detection.",
            name: "SHELL",
            type: String,
        } satisfies EnvDefinition<string>,
        {
            description: "Starship shell configuration. Takes precedence over SHELL for detection.",
            name: "STARSHIP_SHELL",
            type: String,
        } satisfies EnvDefinition<string>,
        {
            description: "PowerShell module path (Windows). Used for PowerShell detection.",
            name: "PSModulePath",
            type: String,
        } satisfies EnvDefinition<string>,
        {
            description: "Command prompt variable (Windows). Used for PowerShell detection.",
            name: "PROMPT",
            type: String,
        } satisfies EnvDefinition<string>,
        {
            description: "Command processor (Windows). Used for Windows Command Prompt detection.",
            name: "ComSpec",
            type: String,
        } satisfies EnvDefinition<string>,
    ],
    execute: async ({ env: toolboxEnv, logger, options, runtime }: IToolbox) => {
        const cliName = runtime.getCliName();

        // Use shell from options, or detect from toolbox.env or process.env
        const shell = (options?.shell as string) || detectShell(toolboxEnv);

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
                const errorMessages = [`Failed to generate completion script: ${error.message}`, `Error code: ${error.code}`];

                if (error.troubleshooting.length > 0) {
                    errorMessages.push("", "Troubleshooting:", ...error.troubleshooting.map((tip) => `  • ${tip}`));
                }

                logger.error(errorMessages.join("\n"));

                // Re-throw to allow callers to handle the error
                throw error;
            } else {
                const errorMessage = error instanceof Error ? error.message : String(error);

                const errorMessages = [
                    "Failed to generate completion script",
                    `Error: ${errorMessage}`,
                    "",
                    "Troubleshooting:",
                    "  • Ensure @bomb.sh/tab is installed: pnpm add @bomb.sh/tab",
                    `  • Verify shell is supported: ${validShells.join(", ")}`,
                    `  • Verify runtime is supported: ${validRuntimes.join(", ")}`,
                    "  • Check that your CLI name is correct",
                ];

                logger.error(errorMessages.join("\n"));
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
