import type { Content, OptionDefinition } from "command-line-usage";

import type { Toolbox as IToolbox } from "./toolbox";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TypeConstructor<T> = (value: any) => T extends (infer R)[] ? R | undefined : T | undefined;

export type Arguments<T> = Omit<OptionDefinition, "type|defaultValue"> & {
    /**
     * An initial value for the option.
     */
    defaultValue?: T;

    /**
     * Specifies whether the variable is required.
     */
    required?: boolean;

    /**
     * A setter function (you receive the output from this) enabling you to be specific about the type and value received. Typical values
     * are `String`, `Number` and `Boolean` but you can use a custom function.
     */
    type?: TypeConstructor<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Command<T = any, TContext extends IToolbox = IToolbox> {
    /** Potential other names for this command */
    alias?: string[] | string;

    /** Positional argument */
    argument?: Omit<Arguments<T>, "multiple|lazyMultiple|defaultOption|alias|group|defaultValue">;

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
    /** Should your command be shown in the listings  */
    hidden?: boolean;

    /** The name of your command */
    name: string;

    options?: Arguments<T>[];

    usage?: Content[];
}
