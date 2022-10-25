import type { Options } from "./walk";
import walk from "./walk";

const collect = async (directory: string, options: Partial<Options & { extensions: string[] }> = {}): Promise<string[]> => {
    const config = {
        extensions: ["js", "mjs", "cjs", "ts"],
        ...options,
    } as Options;

    // eslint-disable-next-line compat/compat,no-async-promise-executor
    return new Promise<string[]>(async (resolve, reject) => {
        const files: string[] = [];

        try {
            // eslint-disable-next-line no-restricted-syntax
            for await (const index of walk(directory, config)) {
                files.push(index.path);
            }

            resolve(files as string[]);
        } catch (error: any) {
            reject(error);
        }
    });
};

export default collect;
