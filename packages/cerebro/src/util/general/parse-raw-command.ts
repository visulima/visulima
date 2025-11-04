import hideBin from "./hide-bin";

const COMMAND_DELIMITER = " ";

// Optimized equals function - check reference equality first, then length, then elements
const equals = (a: string[], b: string[]): boolean => {
    // Fast path: same reference
    if (a === b) {
        return true;
    }

    // Fast path: different lengths
    if (a.length !== b.length) {
        return false;
    }

    // Compare elements only if necessary
    return a.every((v, index) => v === b[index]);
};

/**
 * Parses the raw command into an array of strings.
 * @param commandArray Command string or list of command parts.
 * @returns The command as an array of strings.
 */
const parseRawCommand = (commandArray: string[] | string): string[] => {
    // use the command line options if not passed in
    if (typeof commandArray === "string") {
        return (commandArray as string).split(COMMAND_DELIMITER);
    }

    // remove the first 2 options if it comes from process.argv
    if (equals(commandArray as string[], process.argv)) {
        return hideBin(commandArray as string[]);
    }

    return commandArray as string[];
};

export default parseRawCommand;
