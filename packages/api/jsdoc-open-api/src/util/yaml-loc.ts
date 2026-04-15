const LINE_SPLIT_REGEX = /\r\n|\r|\n/u;
// eslint-disable-next-line regexp/no-unused-capturing-group
const COMMENT_OR_EMPTY_REGEX = /^\s*(#\s*(?:\S.*)?)?$/u;

const yamlLoc = (string: string): number => {
    // Break string into lines.
    const split = string.split(LINE_SPLIT_REGEX);

    const filtered = split.filter((line) => {
        // Remove comments.
        if (COMMENT_OR_EMPTY_REGEX.test(line)) {
            return false;
        }

        // Remove empty lines.
        return line.trim().length > 0;
    });

    return filtered.length;
};

export default yamlLoc;
