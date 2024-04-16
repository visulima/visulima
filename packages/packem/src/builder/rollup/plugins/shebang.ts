// Forked from https://github.com/developit/rollup-plugin-preserve-shebang (1.0.1 @ MIT)
import { chmod } from "node:fs/promises";

import MagicString from "magic-string";
import { resolve } from "pathe";
import type { Plugin, SourceMapInput } from "rollup";

const SHEBANG_RE = /^#![^\n]*/;

export const makeExecutable = async (filePath: string): Promise<void> => {
    await chmod(filePath, 0o755 /* rwx r-x r-x */).catch(() => {});
};

export const shebangPlugin = (executablePaths: string[], shebang = "#!/usr/bin/env node\n"): Plugin => {
    return {
        name: "packem:shebang",

        renderChunk: {
            order: "post",
            handler(code, chunk, outputOptions) {
                if (!chunk.isEntry || !chunk.facadeModuleId) {
                    return null;
                }

                if (executablePaths.includes(chunk.name)) {
                    const transformed = new MagicString(code);

                    transformed.prepend(shebang);

                    return {
                        code: transformed.toString(),
                        map: outputOptions.sourcemap ? (transformed.generateMap({ hires: true }) as SourceMapInput) : undefined,
                    };
                }

                return null;
            },
        },

        async writeBundle(options, bundle) {
            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const [fileName, output] of Object.entries(bundle)) {
                if (output.type !== "chunk") {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                if (output.code?.match(SHEBANG_RE) && options.dir) {
                    const outFile = resolve(options.dir as string, fileName);

                    // eslint-disable-next-line no-await-in-loop
                    await makeExecutable(outFile);
                }
            }
        },
    };
};

export const removeShebangPlugin = (): Plugin => {
    return {
        name: "packem:remove-shebang",
        renderChunk(code) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return code.replace(SHEBANG_RE, "");
        },
    };
};

export const getShebang = (code: string, append = "\n") => {
    const m = SHEBANG_RE.exec(code);

    return m ? m + append : "";
};
