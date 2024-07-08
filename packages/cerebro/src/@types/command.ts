import type { OptionDefinition as BaseOptionDefinition } from "command-line-args";

import type { Content } from "./command-line-usage";
import type { Toolbox as IToolbox } from "./toolbox";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TypeConstructor<T> = (value: any) => T extends (infer R)[] ? R | undefined : T | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MultiplePropertyOptions<T> = any[] extends T ? { lazyMultiple: true } | { multiple: true } : unknown;

export type OptionDefinition<T> = MultiplePropertyOptions<T> & Omit<BaseOptionDefinition, "type|defaultValue"> & {
        // @internal
        __camelCaseName__?: string;

        // @internal
        __negated__?: true;

        /**
         * A string or array of strings indicating the conflicting option(s).
         * Note: The default value for an option does not cause a conflict.
         *
         * @TODO Upgrade this type to read given options keys
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

        /** A string to replace the default type string (e.g. <string>). It's often more useful to set a more descriptive type label, like <ms>, <files>, <command>, etc.. */
        typeLabel?: string | undefined;
    };

export type PossibleOptionDefinition<OD> =
    | OD
    | OptionDefinition<boolean[]>
    | OptionDefinition<boolean>
    | OptionDefinition<number[]>
    | OptionDefinition<number>
    | OptionDefinition<string[]>
    | OptionDefinition<string>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArgumentDefinition<T = any> = Omit<OptionDefinition<T>, "multiple|lazyMultiple|defaultOption|alias|group|defaultValue">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Command<O extends OptionDefinition<any> = any, TContext extends IToolbox = IToolbox> {
    /** Potential other names for this command */
    alias?: string[] | string;

    /** Positional argument */
    argument?: ArgumentDefinition;

    /** The command path, an array that describes how to get to this command */
    commandPath?: string[];

    /** A tweet-sized summary of your command */
    description?: string;

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
