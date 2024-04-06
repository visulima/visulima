import type { StarPattern } from "../types";

const parsePattern = (pattern: string) => {
    if (pattern.includes("*")) {
        const [prefix, suffix] = pattern.split("*");

        return {
            prefix,
            suffix,
        } as StarPattern;
    }

    return pattern;
};

export default parsePattern;
