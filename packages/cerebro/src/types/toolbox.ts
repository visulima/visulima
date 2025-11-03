import type { Cli as ICli } from "./cli";
import type { Command as ICommand } from "./command";
import type { Options } from "./options";

export interface Toolbox<T extends Console = Console> extends Cerebro.ExtensionOverrides {
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

    logger: T;

    /**
     * Any optional parameters. Typically coming from command-line
     * argument like this: `--force -p tsconfig-mjson`.
     */
    options: Options;

    runtime: ICli;
}
