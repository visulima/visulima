import { cyan, gray } from "@visulima/colorize";
import type { Pail } from "@visulima/pail";
import { relative, resolve } from "@visulima/path";
import type { OutputAsset, OutputChunk, OutputOptions, RollupWatcher, RollupWatcherEvent } from "rollup";
import { rollup, watch as rollupWatch } from "rollup";

import type { BuildContext, BuildContextBuildEntry } from "../types";
import { getRollupDtsOptions, getRollupOptions } from "./get-rollup-options";
import getChunkFilename from "./utils/get-chunk-filename";

const watchHandler = (watcher: RollupWatcher, mode: "bundle" | "types", logger: Pail<never, string>) => {
    const prefix = "watcher:" + mode;

    watcher.on("change", (id, { event }) => {
        logger.info({
            message: `${cyan(relative(".", id))} was ${event}d`,
            prefix,
        });
    });

    watcher.on("restart", () => {
        logger.info({
            message: "Rebuilding " + mode + "...",
            prefix,
        });
    });

    watcher.on("event", (event: RollupWatcherEvent) => {
        if (event.code === "END") {
            logger.success({
                message: "Rebuild " + mode + " finished",
                prefix,
            });
        }

        if (event.code === "ERROR") {
            logger.error({
                context: [event.error],
                message: "Rebuild " + mode + " failed: " + event.error.message,
                prefix,
            });
        }
    });
};

export const watch = async (context: BuildContext): Promise<void> => {
    const rollupOptions = getRollupOptions(context);

    await context.hooks.callHook("rollup:options", context, rollupOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Object.keys(rollupOptions.input as any).length === 0) {
        return;
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

    context.logger.info(infoMessage);

    watchHandler(watcher, "bundle", context.logger);

    if (context.options.declaration) {
        const rollupDtsOptions = getRollupDtsOptions(context);

        await context.hooks.callHook("rollup:dts:options", context, rollupDtsOptions);

        const dtsWatcher = rollupWatch(rollupDtsOptions);

        await context.hooks.callHook("rollup:watch", context, dtsWatcher);

        watchHandler(dtsWatcher, "types", context.logger);
    }
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const build = async (context: BuildContext): Promise<void> => {
    const rollupOptions = getRollupOptions(context);

    await context.hooks.callHook("rollup:options", context, rollupOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Object.keys(rollupOptions.input as any).length === 0) {
        return;
    }

    const buildResult = await rollup(rollupOptions);

    await context.hooks.callHook("rollup:build", context, buildResult);

    const allOutputOptions = rollupOptions.output as OutputOptions[];

    const assets = new Map<string, BuildContextBuildEntry>();

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const outputOptions of allOutputOptions) {
        // eslint-disable-next-line no-await-in-loop
        const { output } = await buildResult.write(outputOptions);
        const chunkFileNames = new Set<string>();
        const outputChunks = output.filter((fOutput) => fOutput.type === "chunk") as OutputChunk[];

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
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    chunks: entry.imports.filter((index) => outputChunks.find((c) => c.fileName === index)),
                    exports: entry.exports,
                    modules: Object.entries(entry.modules).map(([id, module_]) => {
                        return {
                            bytes: module_.renderedLength,
                            id,
                        };
                    }),
                    path: entry.fileName,
                    type: "entry",
                });
            }
        }

        const outputAssets = output.filter((fOutput) => fOutput.type === "asset") as OutputAsset[];

        for (const entry of outputAssets) {
            if (assets.has(entry.fileName)) {
                continue;
            }

            assets.set(entry.fileName, {
                bytes: Buffer.byteLength(entry.source, "utf8"),
                path: entry.fileName,
                type: "asset",
            });
        }

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const chunkFileName of chunkFileNames) {
            context.usedImports.delete(chunkFileName);
        }
    }

    context.buildEntries.push(...assets.values());

    // Types
    if (context.options.declaration) {
        const rollupTypeOptions = getRollupDtsOptions(context);

        await context.hooks.callHook("rollup:dts:options", context, rollupTypeOptions);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (Object.keys(rollupTypeOptions.input as any).length === 0) {
            return;
        }

        const typesBuild = await rollup(rollupTypeOptions);

        await context.hooks.callHook("rollup:dts:build", context, typesBuild);

        context.logger.info({
            message: "Building declaration files...",
            prefix: "dts",
        });

        if (context.options.rollup.emitCJS) {
            await typesBuild.write({
                chunkFileNames: (chunk) => getChunkFilename(context, chunk, "d.cts"),
                dir: resolve(context.options.rootDir, context.options.outDir),
                entryFileNames: "[name].d.cts",
            });
        }

        if (context.options.rollup.emitESM) {
            await typesBuild.write({
                chunkFileNames: (chunk) => getChunkFilename(context, chunk, "d.mts"),
                dir: resolve(context.options.rootDir, context.options.outDir),
                entryFileNames: "[name].d.mts",
            });
        }

        // .d.ts for node10 compatibility (TypeScript version < 4.7)
        if (context.options.declaration === true || context.options.declaration === "compatible") {
            await typesBuild.write({
                chunkFileNames: (chunk) => getChunkFilename(context, chunk, "d.ts"),
                dir: resolve(context.options.rootDir, context.options.outDir),
                entryFileNames: "[name].d.ts",
            });
        }
    }

    await context.hooks.callHook("rollup:dts:done", context);
};
