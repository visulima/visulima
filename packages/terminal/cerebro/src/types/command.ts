import type { OptionDefinition as BaseOptionDefinition } from "@visulima/command-line-args";

import type { Content } from "./command-line-usage";
import type { Toolbox as IToolbox } from "./toolbox";

type TypeConstructor<T> = (value: unknown) => T extends (infer R)[] ? R | undefined : T | undefined;

/**
 * Type constructor for environment variables.
 * Environment variables are always strings (or undefined), so the transform function receives string | undefined.
 */
type EnvTypeConstructor<T> = (value: string | undefined) => T extends (infer R)[] ? R | undefined : T | undefined;

type MultiplePropertyOptions<T> = T extends ReadonlyArray<unknown> ? { lazyMultiple: true } | { multiple: true } : unknown;

export type OptionDefinition<T> = MultiplePropertyOptions<T>
    & Omit<BaseOptionDefinition, "type|defaultValue"> & {
        // @internal
        __camelCaseName__?: string;

        // @internal
        __negated__?: true;

        /**
         * Restricts the accepted values for this option to a fixed set, validated
         * at parse time (like commander's `.choices()` / yargs `choices`). The
         * provided value(s) are compared by string equality; for `multiple`
         * options every provided value must be a member of the set.
         * @example
         * ```typescript
         * { name: "format", type: String, choices: ["json", "yaml", "table"] }
         * ```
         */
        choices?: ReadonlyArray<string>;

        /**
         * A string or array of strings indicating the conflicting option(s).
         * Note: The default value for an option does not cause a conflict.
         */
        conflicts?: string[] | string;

        /** An initial value for the option. */
        defaultValue?: T;

        /** A string describing the option. */
        description?: string;

        /** Option is hidden from help */
        hidden?: boolean;

        // @TODO Upgrade this type to read given options keys and values
        implies?: Record<string, unknown>;

        /** Specifies whether the variable is required. */
        required?: boolean;

        /**
         * A setter function (you receive the output from this) enabling you to be specific about the type and value received. Typical values
         * are `String`, `Number` and `Boolean` but you can use a custom function.
         */
        type?: TypeConstructor<T>;

        /** A string to replace the default type string (e.g. &lt;string>). It's often more useful to set a more descriptive type label, like &lt;ms>, &lt;files>, &lt;command>, etc.. */
        typeLabel?: string;
    };

export type PossibleOptionDefinition<OD>
    = | OD
        | OptionDefinition<boolean[]>
        | OptionDefinition<boolean>
        | OptionDefinition<number[]>
        | OptionDefinition<number>
        | OptionDefinition<string[]>
        | OptionDefinition<string>;

export type ArgumentDefinition<T = unknown> = Omit<OptionDefinition<T>, "multiple|lazyMultiple|defaultOption|alias|group|defaultValue">;

/**
 * Environment variable definition for commands.
 * Used to document and provide type-safe access to environment variables a command supports.
 * @template T The type of the environment variable value
 */
export interface EnvDefinition<T = string> {
    /** Default value if the environment variable is not set */
    defaultValue?: T;

    /** A description of what the environment variable does */
    description?: string;

    /** Environment variable is hidden from help */
    hidden?: boolean;

    /** The name of the environment variable */
    name: string;

    /**
     * A transform function to convert the string environment variable value to the desired type.
     * Typical values are `String`, `Number`, `Boolean` or custom functions.
     * The function receives `string | undefined` and should return the transformed value.
     */
    type?: EnvTypeConstructor<T>;

    /** A string to replace the default type string (e.g. &lt;string>). Useful for more descriptive type labels. */
    typeLabel?: string;
}

/**
 * Command interface with type-safe options and environment variables.
 * @template O - The option definition type
 * @template TContext - The toolbox context type (allows custom typing for better autocomplete)
 * @example
 * ```typescript
 * // Define your options type for autocomplete
 * type BuildOptions = {
 *   output?: string;
 *   production?: boolean;
 *   watch?: boolean;
 * };
 *
 * type BuildEnv = {
 *   apiKey?: string;
 *   debug?: boolean;
 * };
 *
 * cli.addCommand({
 *   name: "build",
 *   options: [
 *     { name: "output", type: String, alias: "o" },
 *     { name: "production", type: Boolean },
 *     { name: "watch", type: Boolean }
 *   ],
 *   env: [
 *     { name: "API_KEY", type: String },
 *     { name: "DEBUG", type: Boolean }
 *   ],
 *   execute: ({ options, env }: Toolbox<Console, BuildOptions, BuildEnv>) => {
 *     // Full autocomplete on options and env!
 *     console.log(options.output, options.production, env.apiKey);
 *   }
 * });
 * ```
 */

/**
 * Handler signature for commands. Used by both `execute` and the resolved default export of `loader`.
 */
export type CommandExecute<TContext> = ((toolbox: TContext) => Promise<void>) | ((toolbox: TContext) => void);

/**
 * Module shape returned by a command `loader`. The default export is the command handler.
 */
export interface LazyCommandModule<TContext> {
    default: CommandExecute<TContext>;
}

export interface Command<
    O extends OptionDefinition<unknown> = OptionDefinition<unknown>,
    TLogger extends Console = Console,
    TContext extends IToolbox<TLogger> = IToolbox<TLogger>,
> {
    /**
     * @internal
     */
    __conflictingOptions__?: PossibleOptionDefinition<O>[];

    /**
     * @internal
     */
    __requiredOptions__?: PossibleOptionDefinition<O>[];

    /**
     * Cached handler resolved from `loader` on first execution.
     * @internal
     */
    __resolvedExecute__?: CommandExecute<TContext>;

    /** Potential other names for this command */
    alias?: string[] | string;

    /** Positional argument */
    argument?: ArgumentDefinition;

    /** The command path, an array that describes how to get to this command */
    commandPath?: string[];

    /** A tweet-sized summary of your command */
    description?: string;

    /** Environment variables supported by this command */
    env?: (EnvDefinition<boolean> | EnvDefinition<number> | EnvDefinition)[];

    /** The full command examples, can be multiple lines */
    examples?: string[] | string[][];

    /**
     * The function for running your command, can be async.
     * Either `execute` or `loader` must be provided (but not both).
     */
    execute?: CommandExecute<TContext>;
    /** The path to the file name for this command. */
    file?: string;
    /** Group commands together under a heading */
    group?: string;

    /** Should your command be shown in the listings  */
    hidden?: boolean;

    /**
     * Lazily loads the command handler on first execution. The module's default export is used as the handler.
     * Either `execute` or `loader` must be provided (but not both).
     * Help, completion, and validation work from the metadata declared on this object and never trigger the loader.
     * @example
     * ```typescript
     * cli.addCommand({
     *   name: "build",
     *   description: "Build the project",
     *   options: [{ name: "output", type: String }],
     *   loader: () => import("./commands/build"),
     * });
     *
     * // commands/build.ts
     * export default ({ options }) => { ... };
     * ```
     */
    loader?: () => Promise<LazyCommandModule<TContext>>;

    /** The name of your command */
    name: string;

    options?: (
        | O
        | OptionDefinition<boolean[]>
        | OptionDefinition<boolean>
        | OptionDefinition<number[]>
        | OptionDefinition<number>
        | OptionDefinition<string[]>
        | OptionDefinition<string>
    )[];

    usage?: Content[];
}
