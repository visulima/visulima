const yamlLoc = (string: string): number => {
    // Break string into lines.
    const split = string.split(/\r\n|\r|\n/u);

    const filtered = split.filter((line) => {
        // Remove comments.
        // eslint-disable-next-line security/detect-unsafe-regex,regexp/no-unused-capturing-group
        if (/^\s*(#\s*(?:\S.*)?)?$/u.test(line)) {
            return false;
        }

        // Remove empty lines.
        return line.trim().length > 0;
    });

    return filtered.length;
};

export default yamlLoc;
