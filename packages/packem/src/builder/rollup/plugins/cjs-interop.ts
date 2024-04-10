import type { Plugin } from "rollup";

import logger from "../../../logger";

const cjsInterop = (): Plugin => {
    return {
        name: "packem:cjs-interop",
        renderChunk(code: string, chunk, options): string | null {
            if (options.format !== "cjs" || chunk.type !== "chunk" || !chunk.isEntry || options.exports !== "auto") {
                return null;
            }

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

            logger.debug({
                message: "Applied CommonJS interop to entry chunk " + chunk.fileName + ".",
                prefix: "cjs-interop",
            })

            return interopCode;
        },
    };
};

export default cjsInterop;
