import type { OptionDefinition as BaseOptionDefinition } from "command-line-args";

import type { Content } from "./command-line-usage";
import type { Toolbox as IToolbox } from "./toolbox";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TypeConstructor<T> = (value: any) => T extends (infer R)[] ? R | undefined : T | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OptionDefinition<T = any> = Omit<BaseOptionDefinition, "type|defaultValue"> & {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArgumentDefinition<T = any> = Omit<OptionDefinition<T>, "multiple|lazyMultiple|defaultOption|alias|group|defaultValue">;

export interface Command<TContext extends IToolbox = IToolbox> {
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

    options?: OptionDefinition[];

    usage?: Content[];
}
