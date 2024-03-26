// Forked from https://github.com/developit/rollup-plugin-preserve-shebang (1.0.1 @ MIT)

import { chmod } from "node:fs/promises";

import { resolve } from "pathe";
import type { Plugin } from "rollup";

const SHEBANG_RE = /^#![^\n]*/;


export const makeExecutable = async (filePath: string) => {
    await chmod(filePath, 0o755 /* rwx r-x r-x */).catch(() => {});
}

export const shebangPlugin = (): Plugin => {
    return {
        name: "packem-shebang",
        async writeBundle(options, bundle) {
            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const [fileName, output] of Object.entries(bundle)) {
                if (output.type !== "chunk") {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                if (output.code?.match(SHEBANG_RE)) {
                    const outFile = resolve(options.dir!, fileName);

                    // eslint-disable-next-line no-await-in-loop
                    await makeExecutable(outFile);
                }
            }
        },
    };
}

export const removeShebangPlugin = (): Plugin => {
    return {
        name: "packem-remove-shebang",
        renderChunk(code) {
            return code.replace(SHEBANG_RE, "");
        },
    };
}

export const getShebang = (code: string, append = "\n") => {
    const m = SHEBANG_RE.exec(code);

    return m ? m + append : "";
}
