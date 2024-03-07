import { chmod } from "node:fs/promises";
import path from "node:path";

import MagicString from "magic-string";
import type { OutputChunk, Plugin, RenderedChunk, SourceMapInput } from "rollup";

export const patchBinary = (executablePaths: string[]): Plugin => {return {
    name: "patch-binary",

    renderChunk: (code, chunk, outputOptions) => {
        if (!chunk.isEntry || !chunk.facadeModuleId) {
            return;
        }

        const entryFileNames = outputOptions.entryFileNames as (chunk: RenderedChunk) => string;
        const outputPath = `./${path.posix.join(outputOptions.dir!, entryFileNames(chunk))}`;

        if (executablePaths.includes(outputPath)) {
            const transformed = new MagicString(code);

            transformed.prepend("#!/usr/bin/env node\n");

            return {
                code: transformed.toString(),
                map: outputOptions.sourcemap ? (transformed.generateMap({ hires: true }) as SourceMapInput) : undefined,
            };
        }
    },

    writeBundle: async (outputOptions, bundle) => {
        const entryFileNames = outputOptions.entryFileNames as (chunk: OutputChunk) => string;

        const chmodFiles = Object.values(bundle).map(async (chunk) => {
            const outputChunk = chunk as OutputChunk;

            if (outputChunk.isEntry && outputChunk.facadeModuleId) {
                const outputPath = `./${path.posix.join(outputOptions.dir!, entryFileNames(outputChunk))}`;
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await chmod(outputPath, 0o755);
            }
        });

        await Promise.all(chmodFiles);
    },
}};
