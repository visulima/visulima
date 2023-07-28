import type { Options } from "./walk";
import walk from "./walk";

const collect = async (directory: string, options: Partial<Options & { extensions: string[] }> = {}): Promise<string[]> => {
    const config = {
        extensions: ["js", "mjs", "cjs", "ts"],
        ...options,
    } as Options;

    const entries: string[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for await (const entry of walk(directory, config)) {
        entries.push(entry.path);
    }

    return entries;
};

export default collect;
