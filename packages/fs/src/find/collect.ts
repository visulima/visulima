import type { WalkOptions } from "../types";
import walk from "./walk";

const collect = async (directory: string, options: WalkOptions = {}): Promise<string[]> => {
    if (!Array.isArray(options.extensions)) {
        // eslint-disable-next-line no-param-reassign
        options.extensions = ["js", "mjs", "cjs", "ts"];
    }

    const entries: string[] = [];

    // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
    for await (const entry of walk(directory, options)) {
        entries.push(entry.path);
    }

    return entries;
};

export default collect;
