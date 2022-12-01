import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedPackageJson, NormalizeOptions } from "read-pkg";
import { readPackageSync } from "read-pkg";
import { defineConfig } from "tsup";

function getPackageSources(
    packageContent: NormalizedPackageJson,
    options?: NormalizeOptions
) {
    if (typeof packageContent.source === "string") {
        return [packageContent.source];
    }

    if (Array.isArray(packageContent.sources)) {
        return packageContent.sources;
    }

    throw new TypeError(
        "Please define a source or sources key in the package.json."
    );
}

function detectAndInjectReactImport(source: string): string | null {
    // ignore non-react packages
    if (!source.endsWith(".tsx") || !source.includes("index")) {
        return null;
    }

    const file = `// NOTE: This file should not be edited
// see @configs/tsup for implementation.
// - https://esbuild.github.io/content-types/#auto-import-for-jsx
// - https://github.com/egoist/tsup/issues/390#issuecomment-933488738

import * as React from "react";

export { React };
`;

    const relativefilePath = "./inject-react-import.js";
    const absoluteFilePath = join(process.cwd(), relativefilePath);

    if (!existsSync(absoluteFilePath)) {
        writeFileSync(absoluteFilePath, file);
    }

    return relativefilePath;
}

// @ts-ignore
export default defineConfig((options) => {
    const packageJsonContent = readPackageSync(options as NormalizeOptions);

    const sources = getPackageSources(
        packageJsonContent,
        options as NormalizeOptions
    );

    const inject: string[] = [];

    let count = 0;
    sources.map((source: string) => {
        const sourcePath = join(process.cwd(), source);

        const injectReactImport = detectAndInjectReactImport(sourcePath);

        if (count === 0 && injectReactImport) {
            count += 1;
            inject.push(injectReactImport);
        }

        return sourcePath;
    });

    return {
        ...options,
        entry: sources,
        // react external https://github.com/vercel/turborepo/issues/360#issuecomment-1013885148
        external: [
            "index-browser.cjs",
            "index-browser.mjs",
            "index.cjs",
            "react",
            "next",
            "zod",
            ...Object.keys(packageJsonContent?.peerDependencies || {}),
            ...Object.keys(packageJsonContent?.optionalDependencies || {}),
        ],
        inject,
        format: ["esm", "cjs"],
        silent: !options.watch,
        minify: process.env.NODE_ENV === "production",
        incremental: !options.watch,
        dts: true,
        sourcemap: true,
        clean: true,
        splitting: true,
        env: {
            NODE_ENV: process.env.NODE_ENV,
        },
        rollup: {
            emitCJS: true,
        },
    };
});
