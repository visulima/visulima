import { cyan, gray, red } from "@visulima/colorize";
import { relative, resolve } from "pathe";
import type { OutputChunk, OutputOptions, RollupWatcherEvent } from "rollup";
import { rollup, watch as rollupWatch } from "rollup";
import dts from "rollup-plugin-dts";

import logger from "../../logger";
import type { BuildContext } from "../../types";
import getChunkFilename from "./get-chunk-filename";
import getRollupOptions from "./get-rollup-options";
import { removeShebangPlugin } from "./plugins/shebang";

export const watch = async (context: BuildContext): Promise<void> => {
    const rollupOptions = getRollupOptions(context);

    await context.hooks.callHook("rollup:options", context, rollupOptions);

    if (Object.keys(rollupOptions.input as any).length === 0) {
        return;
    }

    if (context.options.declaration) {
        rollupOptions.plugins = [rollupOptions.plugins, dts(context.options.rollup.dts), removeShebangPlugin()];

        await context.hooks.callHook("rollup:dts:options", context, rollupOptions);
    }

    const watcher = rollupWatch(rollupOptions);

    await context.hooks.callHook("rollup:watch", context, watcher);

    const inputs: string[] = [
        ...(Array.isArray(rollupOptions.input)
            ? rollupOptions.input
            : typeof rollupOptions.input === "string"
              ? [rollupOptions.input]
              : Object.keys(rollupOptions.input || {})),
    ];

    let infoMessage = `Starting watchers for entries:`;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const input of inputs) {
        infoMessage += gray(`\n  └─ ${relative(process.cwd(), input)}`);
    }

    logger.info(infoMessage);

    watcher.on("change", (id, { event }) => {
        logger.info(`${cyan(relative(".", id))} was ${event}d`);
    });
    watcher.on("restart", () => {
        logger.info("Rebuilding bundle");
    });
    watcher.on("event", (event: RollupWatcherEvent) => {
        if (event.code === "END") {
            logger.success("Rebuild finished");
        }

        if (event.code === "ERROR") {
            logger.raw(red("Rebuild failed:"), event.error.message, "\n\n");
        }
    });
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const build = async (context: BuildContext): Promise<void> => {
    const rollupOptions = getRollupOptions(context);

    await context.hooks.callHook("rollup:options", context, rollupOptions);

    if (Object.keys(rollupOptions.input as any).length === 0) {
        return;
    }

    const buildResult = await rollup(rollupOptions);

    await context.hooks.callHook("rollup:build", context, buildResult);

    const allOutputOptions = rollupOptions.output as OutputOptions[];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const outputOptions of allOutputOptions) {
        // eslint-disable-next-line no-await-in-loop
        const { output } = await buildResult.write(outputOptions);
        const chunkFileNames = new Set<string>();
        const outputChunks = output.filter((e) => e.type === "chunk") as OutputChunk[];

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const entry of outputChunks) {
            chunkFileNames.add(entry.fileName);

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
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

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
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
