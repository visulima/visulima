import type { TableOptions } from "@visulima/tabular";

import type { ArgumentDefinition, OptionDefinition } from "./command";

/** A Content section comprises a header and one or more lines of content. */
export interface Content {
    /**
     * Overloaded property, accepting data in one of four formats.
     * 1. A single string (one line of text).
     * 2. An array of strings (multiple lines of text).
     * 3. An array of arrays (recordset-style data). In this case, the data will be rendered in table format.
     * 4. An object with two properties - data and options. In this case, the data and options will be passed directly to the underlying table module for rendering.
     */
    content?: string[] | string[][] | string | { data: string[][]; options: TableOptions };
    /** The section header, always bold and underlined. */
    header?: string;
    /** Set to true to avoid indentation and wrapping. Useful for banners. */
    raw?: boolean;
}

/** A OptionList section adds a table displaying details of the available options. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OptionList<O extends OptionDefinition<any> = any> {
    /** If specified, only options from this particular group will be printed.  */
    group?: string[] | string;
    header?: string | undefined;
    /** The names of one of more option definitions to hide from the option list.  */
    hide?: string[] | string;
    /** If specified, the -- prefix will be omitted from the option name. */
    isArgument?: boolean;
    /** An array of option definition objects. */
    optionList?: (
        | ArgumentDefinition
        | O
        | OptionDefinition<boolean[]>
        | OptionDefinition<boolean>
        | OptionDefinition<number[]>
        | OptionDefinition<number>
        | OptionDefinition<string[]>
        | OptionDefinition<string>
    )[];
    /** If true, the option alias will be displayed after the name, i.e. --verbose, -v instead of -v, --verbose). */
    reverseNameOrder?: boolean;
    /** An options object suitable for passing into table. */
    tableOptions?: TableOptions;
}

export type Section = Content | OptionList;
