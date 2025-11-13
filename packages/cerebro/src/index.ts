import type { CliOptions } from "./cli";
import { Cli } from "./cli";
import type { VERBOSITY_LEVEL } from "./types/cli";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cerebro {
        /**
         * Extend this interface to add custom properties to the Toolbox.
         * This allows plugins and extensions to add type-safe properties to the toolbox.
         * @example
         * ```typescript
         * declare global {
         *   namespace Cerebro {
         *     interface ExtensionOverrides {
         *       // Add custom properties with full type safety
         *       fs: {
         *         readFile: (path: string) => Promise<string>;
         *         writeFile: (path: string, content: string) => Promise<void>;
         *       };
         *       http: {
         *         get: <T>(url: string) => Promise<T>;
         *         post: <T>(url: string, data: unknown) => Promise<T>;
         *       };
         *       myCustomUtil: () => void;
         *     }
         *   }
         * }
         *
         * // Now in your commands, you get full autocomplete:
         * cli.addCommand({
         *   name: "example",
         *   execute: ({ fs, http, myCustomUtil }) => {
         *     // ✅ Full autocomplete and type safety!
         *     const content = await fs.readFile("file.txt");
         *     const data = await http.get<MyType>("https://api.example.com");
         *     myCustomUtil();
         *   }
         * });
         * ```
         */
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        export interface ExtensionOverrides {}
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace,@typescript-eslint/no-unused-vars
declare namespace NodeJS {
    interface ProcessEnvironment {
        CEREBRO_MIN_NODE_VERSION?: string;
        CEREBRO_OUTPUT_LEVEL: VERBOSITY_LEVEL;
        CEREBRO_TERMINAL_WIDTH?: string;
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

export type { CliOptions } from "./cli";
export { Cli as Cerebro } from "./cli";
export { VERBOSITY_DEBUG, VERBOSITY_NORMAL, VERBOSITY_QUIET, VERBOSITY_VERBOSE } from "./constants";
export type { Cli, CliRunOptions, OutputType, RunCommandOptions, VERBOSITY_LEVEL } from "./types/cli";
export type { ArgumentDefinition, Command, EnvDefinition, OptionDefinition } from "./types/command";
export type { CreateEnv, CreateOptions, OptionNameToCamelCase } from "./types/option-types";
export type { Plugin, PluginContext } from "./types/plugin";
export type { Toolbox } from "./types/toolbox";
// eslint-disable-next-line import/no-extraneous-dependencies
export { VisulimaError } from "@visulima/error";

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
export const createCerebro = <T extends Console = Console>(name: string, options?: CliOptions<T>): InstanceType<typeof Cli<T>> => new Cli<T>(name, options);
