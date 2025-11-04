import hideBin from "./hide-bin";

const COMMAND_DELIMITER = " ";

const equals = (a: string[], b: string[]): boolean => {
    if (a === b) {
        return true;
    }

    if (a.length !== b.length) {
        return false;
    }

    return a.every((v, index) => v === b[index]);
};

/**
 * Parses the raw command into an array of strings.
 * @param commandArray Command string or list of command parts.
 * @returns The command as an array of strings.
 */
const parseRawCommand = (commandArray: string[] | string): string[] => {
    if (typeof commandArray === "string") {
        return (commandArray as string).split(COMMAND_DELIMITER);
    }

    if (equals(commandArray as string[], process.argv)) {
        return hideBin(commandArray as string[]);
    }

    return commandArray as string[];
};

export default parseRawCommand;
