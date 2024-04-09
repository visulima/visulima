import type { Plugin } from "rollup";

const searchFor = ["exports.", "exports['default']"];

const findPos = (source: string) => {
    for (const value of searchFor) {
        const pos = source.indexOf(value);
        if (pos !== -1) {
            return pos;
        }
    }

    return -1;
};

const cjsInterop = (): Plugin => {
    return {
        name: "packem:cjs-interop",
        renderChunk(code: string, chunk, options): string | null {
            if (options.format !== "cjs" || chunk.type !== "chunk" || !chunk.isEntry) {
                return null;
            }

            const matches = /(exports(?:\['default'\]|\.default)) = (.*);/i.exec(code);

            if (matches === null || matches.length < 3) {
                return null;
            }

            const pos = findPos(code);

            if (pos === -1) {
                return null;
            }


            return code.slice(0, Math.max(0, pos)) + `module.exports = exports = ${matches[2]};\n` + code.slice(Math.max(0, pos));
        },
    };
};

export default cjsInterop;
