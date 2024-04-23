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
            handler(code, chunk, outputOptions) {
                if (!chunk.isEntry || !chunk.facadeModuleId) {
                    return null;
                }

                // eslint-disable-next-line no-secrets/no-secrets
                /**
                 * Validate if the first line of the code is a shebang, so can ignore it.
                 *
                 * Here we are making 3 assumptions:
                 * - shebang can only be at the first line of the file, otherwise it will not be recognized
                 * - shebang can only contains one line
                 * - shebang must starts with # and !
                 *
                 * Those assumptions are also made by acorn, babel and swc:
                 *
                 * - acorn: https://github.com/acornjs/acorn/blob/8da1fdd1918c9a9a5748501017262ce18bb2f2cc/acorn/src/state.js#L78
                 * - babel: https://github.com/babel/babel/blob/86fee43f499c76388cab495c8dcc4e821174d4e0/packages/babel-parser/src/tokenizer/index.ts#L574
                 * - swc: https://github.com/swc-project/swc/blob/7bf4ab39b0e49759d9f5c8d7f989b3ed010d81a7/crates/swc_ecma_parser/src/lexer/mod.rs#L204
                 */
                if (code[0] === "#" && code[1] === "!") {
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
            order: "post",
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
