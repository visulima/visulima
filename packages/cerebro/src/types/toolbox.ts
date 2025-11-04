import type { Cli as ICli } from "./cli";
import type { Command as ICommand } from "./command";
import type { Options } from "./options";

/**
 * Type-safe Toolbox interface with customizable options and environment variable types.
 * @template TLogger - The logger type (defaults to Console)
 * @template TOptions - The options type (defaults to Options/Record&lt;string, unknown>)
 * @template TEnv - The environment variables type (defaults to Record&lt;string, unknown>)
 */
export interface Toolbox<
    TLogger extends Console = Console,
    TOptions extends Record<string, unknown> = Options,
    TEnv extends Record<string, unknown> = Record<string, unknown>,
> extends Cerebro.ExtensionOverrides {
    /**
     * The argument passed to the command.
     * For example, if you run `cerebro foo bar baz`, then this will be `["foo", "bar", "baz"]`.
     */
    argument: string[];

    /* The original argv value. */
    argv: ReadonlyArray<string>;

    /**
     * The command that is being executed.
     */
    command: ICommand;

    /**
     * The name of the command that is being executed.
     */
    commandName: string;

    /**
     * Environment variables processed from the command definition.
     * Values are transformed according to their type definitions and default values.
     * @example
     * ```typescript
     * // Define env types when creating command
     * type MyEnv = { apiKey: string; debug: boolean };
     *
     * cli.addCommand({
     *   name: "build",
     *   env: [
     *     { name: "API_KEY", type: String },
     *     { name: "DEBUG", type: Boolean }
     *   ],
     *   execute: ({ env }) => {
     *     // env.apiKey and env.debug are now typed!
     *     console.log(env.apiKey, env.debug);
     *   }
     * });
     * ```
     */
    env: TEnv;

    /** The logger instance. */
    logger: TLogger;

    /**
     * Any optional parameters. Typically coming from command-line
     * argument like this: `--force -p tsconfig-mjson`.
     * @example
     * ```typescript
     * // Define options type for better autocomplete
     * type MyOptions = {
     *   output?: string;
     *   verbose?: boolean;
     *   port?: number;
     * };
     *
     * cli.addCommand({
     *   name: "serve",
     *   options: [
     *     { name: "output", type: String },
     *     { name: "verbose", type: Boolean },
     *     { name: "port", type: Number }
     *   ],
     *   execute: ({ options }: { options: MyOptions }) => {
     *     // options.output, options.verbose, options.port are typed!
     *     console.log(options.output, options.verbose, options.port);
     *   }
     * });
     * ```
     */
    options: TOptions;

    /**
     * This is the instance of the CLI that is running the command.
     */
    runtime: ICli;
}
