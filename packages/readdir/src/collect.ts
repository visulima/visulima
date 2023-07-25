import type { Options } from "./walk";
import walk from "./walk";

const collect = async (directory: string, options: Partial<Options & { extensions: string[] }> = {}): Promise<string[]> => {
    const config = {
        extensions: ["js", "mjs", "cjs", "ts"],
        ...options,
    } as Options;

    // eslint-disable-next-line compat/compat,@typescript-eslint/no-misused-promises
    return await new Promise<string[]>(async (resolve, reject) => {
        const entries: string[] = [];

        try {
            // eslint-disable-next-line no-restricted-syntax
            for await (const entry of walk(directory, config)) {
                entries.push(entry.path);
            }

            resolve(entries);
        } catch (error) {
            reject(error);
        }
    });
};

export default collect;
