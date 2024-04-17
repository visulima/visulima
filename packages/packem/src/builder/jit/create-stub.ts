import { pathToFileURL } from "node:url";

import { readFile, writeFile } from "@visulima/fs";
import { resolveModuleExportNames, resolvePath } from "mlly";
import { extname, normalize, resolve } from "pathe";

import { DEFAULT_EXTENSIONS } from "../../constants";
import type { BuildContext } from "../../types";
import tryResolve from "../../utils/try-resolve";
import warn from "../../utils/warn";
import { getShebang, makeExecutable } from "../rollup/plugins/shebang";
import resolveAliases from "../rollup/utils/resolve-aliases";

const createStub = async (context: BuildContext): Promise<void> => {
    const jitiPath = await resolvePath("jiti", { url: import.meta.url });
    const serializedJitiOptions = JSON.stringify(
        {
            ...context.options.stubOptions.jiti,
            alias: {
                ...resolveAliases(context, "jit"),
                ...context.options.stubOptions.jiti.alias,
            },
        },
        null,
        2,
    );

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const entry of context.options.entries.filter((entry) => entry.builder === "rollup")) {
        const output = resolve(context.options.rootDir, context.options.outDir, entry.name!);

        const resolvedEntry = normalize(tryResolve(entry.input, context.options.rootDir) || entry.input);
        const resolvedEntryWithoutExtension = resolvedEntry.slice(0, Math.max(0, resolvedEntry.length - extname(resolvedEntry).length));
        // eslint-disable-next-line no-await-in-loop
        const code = await readFile(resolvedEntry);
        const shebang = getShebang(code);

        // CJS Stub
        if (context.options.rollup.emitCJS) {
            // eslint-disable-next-line no-await-in-loop
            await writeFile(
                `${output}.cjs`,
                shebang +
                    [
                        `const jiti = require(${JSON.stringify(jitiPath)})`,
                        "",
                        `const _jiti = jiti(null, ${serializedJitiOptions})`,
                        "",
                        `/** @type {import(${JSON.stringify(resolvedEntryWithoutExtension)})} */`,
                        `module.exports = _jiti(${JSON.stringify(resolvedEntry)})`,
                    ].join("\n"),
            );
        }

        // MJS Stub
        // Try to analyze exports
        let namedExports: string[] = [];

        try {
            // eslint-disable-next-line no-await-in-loop
            namedExports = await resolveModuleExportNames(resolvedEntry, {
                extensions: DEFAULT_EXTENSIONS,
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            warn(context, `Cannot analyze ${resolvedEntry} for exports:${error}`);

            return;
        }

        const hasDefaultExport = namedExports.includes("default") || namedExports.length === 0;

        // eslint-disable-next-line no-await-in-loop
        await writeFile(
            `${output}.mjs`,
            shebang +
                [
                    `import jiti from ${JSON.stringify(pathToFileURL(jitiPath).href)};`,
                    "",
                    `const _jiti = jiti(null, ${serializedJitiOptions})`,
                    "",
                    `/** @type {import(${JSON.stringify(resolvedEntry)})} */`,
                    `const _module = await _jiti.import(${JSON.stringify(resolvedEntry)});`,
                    hasDefaultExport ? "\nexport default _module;" : "",
                    ...namedExports.filter((name) => name !== "default").map((name) => `export const ${name} = _module.${name};`),
                ].join("\n"),
        );

        // DTS Stub
        // eslint-disable-next-line no-await-in-loop
        await writeFile(
            `${output}.d.cts`,
            [
                `export * from ${JSON.stringify(resolvedEntryWithoutExtension)};`,
                hasDefaultExport ? `export { default } from ${JSON.stringify(resolvedEntryWithoutExtension)};` : "",
            ].join("\n"),
        );
        // eslint-disable-next-line no-await-in-loop
        await writeFile(
            `${output}.d.mts`,
            [
                `export * from ${JSON.stringify(resolvedEntry)};`,
                hasDefaultExport ? `export { default } from ${JSON.stringify(resolvedEntry)};` : "",
            ].join("\n"),
        );

        if (shebang) {
            // eslint-disable-next-line no-await-in-loop
            await makeExecutable(`${output}.cjs`);
            // eslint-disable-next-line no-await-in-loop
            await makeExecutable(`${output}.mjs`);
        }
    }

    await context.hooks.callHook("rollup:done", context);
};

export default createStub;
