import { dirname, resolve } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import { build, type BuildOptions, transform } from "esbuild";

async function buildZeptomatch() {
    let bundle = await build(<BuildOptions>{
        format: "iife",
        globalName: "__lib__",
        bundle: true,
        write: false,
        stdin: {
            resolveDir: process.cwd(),
            contents: /* js */ `export { default as zeptomatch } from "zeptomatch";`,
        },
    }).then((r) => r.outputFiles![0].text);

    bundle = (await transform(bundle, { minify: true })).code!;

    bundle = /* js */ `
let _lazyMatch = () => { ${bundle}; return __lib__.default || __lib__; };
let _match;
export default (path, pattern) => {
  if (!_match) {
    _match = _lazyMatch();
    _lazyMatch = null;
  }
  return _match(path, pattern);
};
  `;

    const outFile = resolve("tmp/node_modules/zeptomatch/zeptomatch.min.mjs");

    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, bundle);

    return outFile;
}

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    alias: {
        zeptomatch: await buildZeptomatch(),
    },
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
    cjsInterop: true,
}) as BuildConfig;
