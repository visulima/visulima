import { resolve } from "pathe";
import type { OutputChunk, OutputOptions } from "rollup";
import { rollup } from "rollup";
import dts from "rollup-plugin-dts";

import type { BuildContext } from "../../types";
import createStub from "./create-stub";
import getChunkFilename from "./get-chunk-filename";
import getRollupOptions from "./get-rollup-options";
import { removeShebangPlugin } from "./plugins/shebang";
// import { externalizeNodeBuiltins } from "./plugins/externalize-node-builtins";
// import { patchBinary } from "./plugins/patch-binary";

// eslint-disable-next-line sonarjs/cognitive-complexity
const rollupBuild = async (context: BuildContext): Promise<void> => {
    if (context.options.stub) {
        await createStub(context);

        return;
    }

    const rollupOptions = getRollupOptions(context);

    await context.hooks.callHook("rollup:options", context, rollupOptions);

    if (Object.keys(rollupOptions.input as any).length === 0) {
        return;
    }

    const buildResult = await rollup(rollupOptions);

    await context.hooks.callHook("rollup:build", context, buildResult);

    const allOutputOptions = rollupOptions.output! as OutputOptions[];

    for (const outputOptions of allOutputOptions) {
        const { output } = await buildResult.write(outputOptions);
        const chunkFileNames = new Set<string>();
        const outputChunks = output.filter((e) => e.type === "chunk") as OutputChunk[];

        for (const entry of outputChunks) {
            chunkFileNames.add(entry.fileName);

            for (const id of entry.imports) {
                context.usedImports.add(id);
            }

            if (entry.isEntry) {
                context.buildEntries.push({
                    bytes: Buffer.byteLength(entry.code, "utf8"),
                    chunks: entry.imports.filter((index) => outputChunks.find((c) => c.fileName === index)),
                    exports: entry.exports,
                    modules: Object.entries(entry.modules).map(([id, module_]) => {
                        return {
                            bytes: module_.renderedLength,
                            id,
                        };
                    }),
                    path: entry.fileName,
                });
            }
        }

        for (const chunkFileName of chunkFileNames) {
            context.usedImports.delete(chunkFileName);
        }
    }

    // Types
    if (context.options.declaration) {
        rollupOptions.plugins = [rollupOptions.plugins, dts(context.options.rollup.dts), removeShebangPlugin()];

        await context.hooks.callHook("rollup:dts:options", context, rollupOptions);
        const typesBuild = await rollup(rollupOptions);
        await context.hooks.callHook("rollup:dts:build", context, typesBuild);

        // #region cjs
        if (context.options.rollup.emitCJS) {
            await typesBuild.write({
                chunkFileNames: (chunk) => getChunkFilename(context, chunk, "d.cts"),
                dir: resolve(context.options.rootDir, context.options.outDir),
                entryFileNames: "[name].d.cts",
            });
        }
        // #endregion
        // #region mjs
        await typesBuild.write({
            chunkFileNames: (chunk) => getChunkFilename(context, chunk, "d.mts"),
            dir: resolve(context.options.rootDir, context.options.outDir),
            entryFileNames: "[name].d.mts",
        });
        // #endregion
        // #region .d.ts for node10 compatibility (TypeScript version < 4.7)
        if (context.options.declaration === true || context.options.declaration === "compatible") {
            await typesBuild.write({
                chunkFileNames: (chunk) => getChunkFilename(context, chunk, "d.ts"),
                dir: resolve(context.options.rootDir, context.options.outDir),
                entryFileNames: "[name].d.ts",
            });
        }
        // #endregion
    }

    await context.hooks.callHook("rollup:done", context);
};

export default rollupBuild;
