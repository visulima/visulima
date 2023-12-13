const padEnd = (string_: string, targetLength: number): string => {
    if (string_.length >= targetLength) {
        return string_;
    }

    return string_.padEnd(targetLength);
};

export default padEnd;
