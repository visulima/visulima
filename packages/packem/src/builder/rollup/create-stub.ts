import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { resolveModuleExportNames, resolvePath } from "mlly";
import { dirname, extname, normalize, resolve } from "pathe";

import { DEFAULT_EXTENSIONS } from "../../constants";
import type { BuildContext } from "../../types";
import warn from "../../utils/warn";
import tryResolve from "../jit/try-resolve";
import { getShebang, makeExecutable } from "./plugins/shebang";
import resolveAliases from "./resolve-aliases";

const createStub = async (context: BuildContext) => {
    const jitiPath = await resolvePath("jiti", { url: import.meta.url });
    const serializedJitiOptions = JSON.stringify(
        {
            ...context.options.stubOptions.jiti,
            alias: {
                ...resolveAliases(context),
                ...context.options.stubOptions.jiti.alias,
            },
        },
        null,
        2,
    );

    for (const entry of context.options.entries.filter((entry) => entry.builder === "rollup")) {
        const output = resolve(context.options.rootDir, context.options.outDir, entry.name!);

        const isESM = ctx.pkg.type === "module";
        const resolvedEntry = normalize(tryResolve(entry.input, context.options.rootDir) || entry.input);
        const resolvedEntryWithoutExtension = resolvedEntry.slice(0, Math.max(0, resolvedEntry.length - extname(resolvedEntry).length));
        const resolvedEntryForTypeImport = isESM ? `${resolvedEntry.replace(/(\.m?)(ts)$/, "$1js")}` : resolvedEntryWithoutExtension;
        // eslint-disable-next-line no-await-in-loop
        const code = await readFile(resolvedEntry, "utf8");
        const shebang = getShebang(code);

        await mkdir(dirname(output), { recursive: true });

        // CJS Stub
        if (context.options.rollup.emitCJS) {
            await writeFile(
                `${output}.cjs`,
                shebang +
                    [
                        `const jiti = require(${JSON.stringify(jitiPath)})`,
                        "",
                        `const _jiti = jiti(null, ${serializedJitiOptions})`,
                        "",
                        `/** @type {import(${JSON.stringify(resolvedEntryForTypeImport)})} */`,
                        `module.exports = _jiti(${JSON.stringify(resolvedEntry)})`,
                    ].join("\n"),
            );
        }

        // MJS Stub
        // Try to analyze exports
        let namedExports: string[] = [];

        try {
            namedExports = await resolveModuleExportNames(resolvedEntry, {
                extensions: DEFAULT_EXTENSIONS,
            });
        } catch (error: any) {
            warn(context, `Cannot analyze ${resolvedEntry} for exports:${error}`);

            return [];
        }

        const hasDefaultExport = namedExports.includes("default") || namedExports.length === 0;

        await writeFile(
            `${output}.mjs`,
            shebang +
                [
                    `import jiti from ${JSON.stringify(pathToFileURL(jitiPath).href)};`,
                    "",
                    `const _jiti = jiti(null, ${serializedJitiOptions})`,
                    "",
                    `/** @type {import(${JSON.stringify(resolvedEntryForTypeImport)})} */`,
                    `const _module = await _jiti.import(${JSON.stringify(resolvedEntry)});`,
                    hasDefaultExport ? "\nexport default _module;" : "",
                    ...namedExports.filter((name) => name !== "default").map((name) => `export const ${name} = _module.${name};`),
                ].join("\n"),
        );

        // DTS Stub
        await writeFile(
            `${output}.d.ts`,
            [
                `export * from ${JSON.stringify(resolvedEntryForTypeImport)};`,
                hasDefaultExport ? `export { default } from ${JSON.stringify(resolvedEntryForTypeImport)};` : "",
            ].join("\n"),
        );

        if (shebang) {
            await makeExecutable(`${output}.cjs`);
            await makeExecutable(`${output}.mjs`);
        }
    }

    await context.hooks.callHook("rollup:done", context);
};

export default createStub;
