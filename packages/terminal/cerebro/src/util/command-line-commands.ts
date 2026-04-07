/**
 * Copied from
 * The MIT License (MIT)
 * Copyright (c) 2015-21 Lloyd Brookes &lt;75pound@gmail.com>
 */

// eslint-disable-next-line regexp/no-unused-capturing-group
const isShort = new RegExp(/^-([^\d-])$/);
// eslint-disable-next-line regexp/no-unused-capturing-group
const isLong = new RegExp(/^--(\S+)/);
// eslint-disable-next-line regexp/no-unused-capturing-group
const isCombined = new RegExp(/^-([^\d-]{2,})$/);

const isOption = (argument: string) => isShort.test(argument) || isLong.test(argument) || isCombined.test(argument);

const commandLineCommands = (commands: (string | null)[], argv: string[]): { argv: string[]; command: string | null } => {
    /* the command is the first arg, unless it's an option (e.g. --help) */
    // eslint-disable-next-line unicorn/no-null
    const command = (argv[0] && isOption(argv[0])) || argv.length === 0 ? null : argv.shift() ?? null;

    if (!commands.includes(command)) {
        const error: Error & { command?: string | null | undefined } = new Error(`Command not recognised: ${command}`);

        error.command = command;
        error.name = "INVALID_COMMAND";

        throw error;
    }

    return { argv, command };
};

export default commandLineCommands;
