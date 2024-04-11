import MagicString from "magic-string";
import type { NormalizedOutputOptions, Plugin, RenderedChunk, SourceMapInput } from "rollup";

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
        renderChunk(code: string, chunk: RenderedChunk, options: NormalizedOutputOptions): { code: string; map: SourceMapInput } | null {
            if (chunk.type !== "chunk" || !chunk.isEntry) {
                return null;
            }

            if (options.format === "cjs" && options.exports === "auto") {
                const matches = /(exports(?:\['default'\]|\.default)) = (.*);/i.exec(code);

                if (matches === null || matches.length < 3) {
                    return null;
                }

                const transformed = new MagicString(code);

                // remove `__esModule` marker property
                transformed.replace("Object.defineProperty(exports, '__esModule', { value: true });", "");
                // replace `exports.* = ...;` with `module.exports.* = ...;`
                transformed.replaceAll(/exports\.(.*) = (.*);/g, "module.exports.$1 = $2;");

                if (addDefaultProperty) {
                    // add `module.exports.default = module.exports;`
                    transformed.append("\nmodule.exports.default = " + matches[2] + ";");
                }

                let newCode = transformed.toString();
                // @see https://github.com/Rich-Harris/magic-string/issues/208 why this is needed
                // replace `exports.default = ...; or exports['default'] = ...;` with `module.exports = ...;`
                newCode = newCode.replace(/(?:module\.)?exports(?:\['default'\]|\.default)/i, "module.exports");

                logger.debug({
                    message: "Applied CommonJS interop to entry chunk " + chunk.fileName + ".",
                    prefix: "cjs-interop",
                });

                return {
                    code: newCode,
                    map: transformed.generateMap({ hires: true }),
                };
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

                let defaultKey: string | undefined;

                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                for (const match of splitMatches) {
                    if (match.includes("type")) {
                        // eslint-disable-next-line no-continue
                        continue;
                    }

                    if (match.includes("as")) {
                        const [original, alias] = match.split(" as ");

                        if (alias === "default") {
                            defaultKey = original;

                            if (!addDefaultProperty) {
                                // eslint-disable-next-line no-continue
                                continue;
                            }
                        }

                        buildObjectEntries.push(alias + ": typeof " + original + ";");
                    } else {
                        buildObjectEntries.push(match + ": typeof " + match + ";");
                    }
                }

                const dtsTransformed = new MagicString(code);

                dtsTransformed.replace(" " + defaultKey + " as default,", "");
                dtsTransformed.append(
                    "\n\n" +
                        "declare const defaultExport: {\n" +
                        (buildObjectEntries.length > 0 ? "  " : "") +
                        buildObjectEntries.join("\n  ") +
                        "\n} & typeof " +
                        defaultKey +
                        ";\n\nexport default defaultExport;",
                );

                logger.debug({
                    message: "Applied CommonJS interop to entry chunk " + chunk.fileName + ".",
                    prefix: "cjs-interop",
                });

                return {
                    code: dtsTransformed.toString(),
                    map: dtsTransformed.generateMap({ hires: true }),
                };
            }

            return null;
        },
    };
};
