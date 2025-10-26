import type { VERBOSITY_LEVEL } from "./@types/cli";
import type { CliOptions } from "./cli";
import { Cli as Cerebro } from "./cli";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cerebro {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        export interface ExtensionOverrides {}
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace,@typescript-eslint/no-unused-vars
declare namespace NodeJS {
    interface ProcessEnvironment {
        CEREBRO_MIN_NODE_VERSION?: string;
        CEREBRO_OUTPUT_LEVEL: VERBOSITY_LEVEL;
    }
}

/**
 * Main entry point for the Cerebro CLI framework.
 *
 * This module provides a lightweight, extensible CLI framework for building command-line applications.
 * It supports plugins, subcommands, argument parsing, help generation, and more.
 * @example
 * ```typescript
 * import { createCerebro } from '@visulima/cerebro';
 *
 * const cli = createCerebro('my-app', {
 *   packageName: 'my-app',
 *   packageVersion: '1.0.0'
 * });
 *
 * cli.addCommand({
 *   name: 'greet',
 *   description: 'Greet someone',
 *   argument: {
 *     name: 'name',
 *     description: 'Name to greet',
 *     type: String
 *   },
 *   execute: ({ argument }) => {
 *     console.log(`Hello, ${argument[0]}!`);
 *   }
 * });
 *
 * cli.run();
 * ```
 */

// Type exports
export type { Cli, CliRunOptions, OutputType, VERBOSITY_LEVEL } from "./@types/cli";
export type { ArgumentDefinition, Command, OptionDefinition } from "./@types/command";
export type { Plugin, PluginContext } from "./@types/plugin";
export type { Toolbox } from "./@types/toolbox";
export type { CliOptions } from "./cli";

// Main class export
export { Cli as Cerebro } from "./cli";

/**
 * Creates a new Cerebro CLI instance.
 *
 * This is the main factory function for creating CLI applications with Cerebro.
 * The returned CLI instance can be configured with commands, plugins, and options.
 * @template T - The console type (defaults to Console)
 * @param name The name of the CLI application
 * @param options Configuration options for the CLI
 * @returns A configured Cerebro CLI instance
 * @example
 * ```typescript
 * const cli = createCerebro('my-app', {
 *   packageName: 'my-app',
 *   packageVersion: '1.0.0'
 * });
 * ```
 */
export const createCerebro = <T extends Console = Console>(name: string, options?: CliOptions<T>): InstanceType<typeof import("./cli").Cli<T>> =>
    new Cerebro(name, options);
