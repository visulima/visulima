import type { WalkOptions } from "../types";
import walkSync from "./walk-sync";

const collectSync = (directory: string, options: WalkOptions = {}): string[] => {
    const config = {
        extensions: ["js", "mjs", "cjs", "ts"],
        ...options,
    } as WalkOptions;

    const entries: string[] = [];

    // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
    for (const entry of walkSync(directory, config)) {
        entries.push(entry.path);
    }

    return entries;
};

export default collectSync;
