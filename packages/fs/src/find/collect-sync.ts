import type { WalkOptions } from "../types";
import walkSync from "./walk-sync";

const collectSync = (directory: string, options: WalkOptions = {}): string[] => {
    if (!Array.isArray(options.extensions)) {
        // eslint-disable-next-line no-param-reassign
        options.extensions = ["js", "mjs", "cjs", "ts"];
    }

    const entries: string[] = [];

    // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
    for (const entry of walkSync(directory, options)) {
        entries.push(entry.path);
    }

    return entries;
};

export default collectSync;
