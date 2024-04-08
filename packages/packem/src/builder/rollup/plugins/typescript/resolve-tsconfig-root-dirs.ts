// eslint-disable-next-line unicorn/prevent-abbreviations
import type { TsConfigResult } from "@visulima/package/tsconfig";
import { join , resolve } from "pathe";
import type { Plugin } from "rollup";

import logger from "../../../../logger";

const getRootDirectories = (cwd: string, tsconfig?: TsConfigResult): string[] | null => {
    if (!tsconfig) {
        return null;
    }

    const { config, path: tsConfigPath } = tsconfig;

    if (!config.compilerOptions) {
        return null;
    }

    const { rootDirs } = config.compilerOptions;

    if (!rootDirs) {
        return null;
    }

    const mappedRootDirectories: string[] = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const rootDirectory of rootDirs) {
        if (rootDirectory.startsWith(".")) {
            throw new Error(`Invalid rootDir value '.' in ${tsConfigPath}.`);
        }

        if (rootDirectory.startsWith("..")) {
            throw new Error(`Invalid rootDir value '..' in ${tsConfigPath}.`);
        }

        mappedRootDirectories.push(resolve(cwd, rootDirectory));
    }

    return mappedRootDirectories;
};

/**
 * This plugin resolves module paths using the rootDirs configuration from the tsconfig.json file.
 *
 * Consider the following example configuration:
 *
 * @example
 * ```json
 * {
 *    "compilerOptions": {
 *        "rootDirs": ["lib"]
 *    }
 * }
 * ```
 *
 * This configuration will allow you to import modules from the `src` and `lib` directories.
 *
 * ```typescript
 * import { foo } from "./foo"; -> ./src/foo
 * import { bar } from "./bar"; // -> ./lib/bar
 * ```
 */
const resolveTsconfigRootDirectories = (cwd: string, tsconfig?: TsConfigResult): Plugin => {
    const rootDirectories = getRootDirectories(cwd, tsconfig);

    return {
        name: "packem:resolve-tsconfig-root-dirs",
        async resolveId(id, importer, options) {
            if (rootDirectories === null || rootDirectories.length === 0) {
                return null;
            }

            if (id.startsWith(".")) {
                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                for (const rootDirectory of rootDirectories) {
                    const updatedId = join(rootDirectory, id);

                    // eslint-disable-next-line no-await-in-loop
                    const resolved = await this.resolve(updatedId, importer, { skipSelf: true, ...options });

                    if (resolved) {
                        logger.debug({
                            message: `Resolved ${id} to ${resolved.id} using rootDirs from tsconfig.json.`,
                            prefix: "resolve-tsconfig-root-dirs",
                        });

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                        return resolved.id;
                    }
                }
            }


            return null;
        },
    };
};

export default resolveTsconfigRootDirectories;
