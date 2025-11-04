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
     */
    env: Record<string, unknown>;

    /** The logger instance. */
    logger: T;

    /**
     * Any optional parameters. Typically coming from command-line
     * argument like this: `--force -p tsconfig-mjson`.
     */
    options: Options;

    /**
     * This is the instance of the CLI that is running the command.
     */
    runtime: ICli;
}
