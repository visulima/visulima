import type { OptionDefinition as BaseOptionDefinition } from "@visulima/command-line-args";

import type { Content } from "./command-line-usage";
import type { Toolbox as IToolbox } from "./toolbox";

type TypeConstructor<T> = (value: unknown) => T extends (infer R)[] ? R | undefined : T | undefined;

/**
 * Type constructor for environment variables.
 * Environment variables are always strings (or undefined), so the transform function receives string | undefined.
 */
type EnvTypeConstructor<T> = (value: string | undefined) => T extends (infer R)[] ? R | undefined : T | undefined;

type MultiplePropertyOptions<T> = unknown[] extends T ? { lazyMultiple: true } | { multiple: true } : unknown;

export type OptionDefinition<T> = MultiplePropertyOptions<T>
    & Omit<BaseOptionDefinition, "type|defaultValue"> & {
        // @internal
        __camelCaseName__?: string;

        // @internal
        __negated__?: true;

        /**
         * A string or array of strings indicating the conflicting option(s).
         * Note: The default value for an option does not cause a conflict.
         */
        conflicts?: string[] | string;

        /** An initial value for the option. */
        defaultValue?: T | undefined;

        /** A string describing the option. */
        description?: string | undefined;

        /** Option is hidden from help */
        hidden?: boolean;

        // @TODO Upgrade this type to read given options keys and values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        implies?: Record<string, any>;

        /** Specifies whether the variable is required. */
        required?: boolean;

        /**
         * A setter function (you receive the output from this) enabling you to be specific about the type and value received. Typical values
         * are `String`, `Number` and `Boolean` but you can use a custom function.
         */
        type?: TypeConstructor<T> | undefined;

        /** A string to replace the default type string (e.g. &lt;string>). It's often more useful to set a more descriptive type label, like &lt;ms>, &lt;files>, &lt;command>, etc.. */
        typeLabel?: string | undefined;
    };

export type PossibleOptionDefinition<OD>
    = | OD
        | OptionDefinition<boolean[]>
        | OptionDefinition<boolean>
        | OptionDefinition<number[]>
        | OptionDefinition<number>
        | OptionDefinition<string[]>
        | OptionDefinition<string>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArgumentDefinition<T = any> = Omit<OptionDefinition<T>, "multiple|lazyMultiple|defaultOption|alias|group|defaultValue">;

/**
 * Environment variable definition for commands.
 * Used to document and provide type-safe access to environment variables a command supports.
 * @template T The type of the environment variable value
 */
export interface EnvDefinition<T = string> {
    /** Default value if the environment variable is not set */
    defaultValue?: T | undefined;

    /** A description of what the environment variable does */
    description?: string | undefined;

    /** Environment variable is hidden from help */
    hidden?: boolean;

    /** The name of the environment variable */
    name: string;

    /**
     * A transform function to convert the string environment variable value to the desired type.
     * Typical values are `String`, `Number`, `Boolean` or custom functions.
     * The function receives `string | undefined` and should return the transformed value.
     */
    type?: EnvTypeConstructor<T> | undefined;

    /** A string to replace the default type string (e.g. &lt;string>). Useful for more descriptive type labels. */
    typeLabel?: string | undefined;
}

export type PossibleEnvDefinition = EnvDefinition<boolean> | EnvDefinition<number> | EnvDefinition<string>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Command<O extends OptionDefinition<any> = any, TContext extends IToolbox = IToolbox> {
    /**
     * @internal
     */
    __conflictingOptions__?: PossibleOptionDefinition<O>[];

    /**
     * @internal
     */
    __requiredOptions__?: PossibleOptionDefinition<O>[];

    /** Potential other names for this command */
    alias?: string[] | string;

    /** Positional argument */
    argument?: ArgumentDefinition;

    /** The command path, an array that describes how to get to this command */
    commandPath?: string[];

    /** A tweet-sized summary of your command */
    description?: string;

    /** Environment variables supported by this command */
    env?: (EnvDefinition<boolean> | EnvDefinition<number> | EnvDefinition<string>)[];

    /** The full command examples, can be multiple lines */
    examples?: string[] | string[][];
    /** The function for running your command, can be async */
    execute: ((toolbox: TContext) => Promise<void>) | ((toolbox: TContext) => void);
    /** The path to the file name for this command. */
    file?: string;
    /** Group commands together under a heading */
    group?: string;

    /** Should your command be shown in the listings  */
    hidden?: boolean;

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
