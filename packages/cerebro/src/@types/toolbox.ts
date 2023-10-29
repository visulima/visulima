import type { checkbox, confirm, editor, expand, input, password, rawlist, select } from "@inquirer/prompts";

import type { Cli as ICli } from "./cli";
import type { Command as ICommand } from "./command";
import type { Logger as ILogger } from "./logger";
import type { Options } from "./options";
import type { Print as IPrint } from "./print";
import type { System as ISystem } from "./system";

// Final toolbox
export interface Toolbox extends Cerebro.ExtensionOverrides {
    /**
     * The argument passed to the command.
     * For example, if you run `cerebro foo bar baz`, then this will be `["foo", "bar", "baz"]`.
     */
    argument: string[];
    /* The original argv value. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    argv: Record<string, any>;
    command: ICommand;
    commandName: string;
    logger: ILogger;
    /**
     * Any optional parameters. Typically coming from command-line
     * argument like this: `--force -p tsconfig-mjson`.
     */
    options: Options;
    print: IPrint;
    prompts: {
        checkbox: typeof checkbox;
        confirm: typeof confirm;
        editor: typeof editor;
        expand: typeof expand;
        input: typeof input;
        password: typeof password;
        rawlist: typeof rawlist;
        select: typeof select;
    };
    runtime: ICli;
    system: ISystem;
}
