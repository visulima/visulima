import type { NormalizedOutputOptions, Plugin, RenderedChunk } from "rollup";

import logger from "../../../logger";

export interface CJSInteropOptions {
    addDefaultProperty?: boolean;
}

export const cjsInterop = ({
    addDefaultProperty = false,
    type,
}: CJSInteropOptions & {
    type: "commonjs" | "module";
}): Plugin => {
    return {
        name: "packem:cjs-interop",
        // eslint-disable-next-line sonarjs/cognitive-complexity
        renderChunk(code: string, chunk: RenderedChunk, options: NormalizedOutputOptions): string | null {
            if (chunk.type !== "chunk" || !chunk.isEntry) {
                return null;
            }

            if (options.format === "cjs" && options.exports === "auto") {
                const matches = /(exports(?:\['default'\]|\.default)) = (.*);/i.exec(code);

                if (matches === null || matches.length < 3) {
                    return null;
                }

                // remove `__esModule` marker property
                let interopCode = code.replace("Object.defineProperty(exports, '__esModule', { value: true });", "");
                // replace `exports.default = ...; or exports['default'] = ...;` with `module.exports = ...;`
                interopCode = interopCode.replaceAll(/(?:module\.)?exports\.default/g, "module.exports");
                // replace `exports.* = ...;` with `module.exports.* = ...;`
                interopCode = interopCode.replace(/exports\.(.*) = (.*);/i, "module.exports.$1 = $2;");

                if (addDefaultProperty) {
                    // add `module.exports.default = module.exports;`
                    interopCode += "\nmodule.exports.default = module.exports;";
                }

                logger.debug({
                    message: "Applied CommonJS interop to entry chunk " + chunk.fileName + ".",
                    prefix: "cjs-interop",
                });

                return interopCode;
            }

            if (options.format === "es" && /\.d\.(?:ts|cts)$/.test(chunk.fileName)) {
                if (type !== "commonjs" && chunk.fileName.endsWith(".d.ts")) {
                    return null;
                }

                // will match `export { ... }` statement
                const matches = /export\s\{\s(.*)\s\}/i.exec(code);

                if (matches === null || matches.length < 2) {
                    return null;
                }

                const splitMatches = (matches[1] as string).split(", ");
                const buildObjectEntries: string[] = [];

                let defaultContent: string | undefined;

                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                for (const match of splitMatches) {
                    if (match.includes("type")) {
                        // eslint-disable-next-line no-continue
                        continue;
                    }

                    if (match.includes("as")) {
                        const [original, alias] = match.split(" as ");

                        if (alias === "default") {
                            defaultContent = original;

                            // eslint-disable-next-line no-continue
                            continue;
                        }

                        buildObjectEntries.push(alias + ": typeof " + original + ";");
                    } else {
                        buildObjectEntries.push(match + ": typeof " + match + ";");
                    }
                }

                const mixedExport = `declare const defaultExport: {\n  ${buildObjectEntries.join("\n  ")}\n} & typeof ${defaultContent};\n\nexport default defaultExport;`;

                logger.debug({
                    message: "Applied CommonJS interop to entry chunk " + chunk.fileName + ".",
                    prefix: "cjs-interop",
                });

                return code.replace(" " + defaultContent + " as default,", "") + "\n\n" + mixedExport;
            }

            return null;
        },
    };
};
