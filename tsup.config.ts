import type { NormalizedPackageJson, NormalizeOptions } from "read-pkg";
import { readPackageSync } from "read-pkg";
import { defineConfig } from "tsup";

function getPackageSources(packageContent: NormalizedPackageJson) {
    if (typeof packageContent.source === "string") {
        return [packageContent.source];
    }

    if (Array.isArray(packageContent.sources)) {
        return packageContent.sources;
    }

    throw new TypeError("Please define a source or sources key in the package.json.");
}

// @ts-ignore
export default defineConfig((options) => {
    const packageJsonContent = readPackageSync(options as NormalizeOptions);

    const sources = getPackageSources(packageJsonContent);
    const peerDependenciesKeys = Object.keys(packageJsonContent?.peerDependencies || {})

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
            "next/dynamic",
            "next/head",
            "zod",
            ...peerDependenciesKeys,
            ...Object.keys(packageJsonContent?.optionalDependencies || {}),
        ],
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
        esbuildOptions(options) {
            if (process.env.NODE_ENV !== "production" && peerDependenciesKeys.includes("react")) {
                options.tsconfig = options.tsconfig?.replace("tsconfig.json", "tsconfig.dev.json");
            }
        },
    };
});
