import { existsSync } from "node:fs";

import type { PackageJson } from "@visulima/package";
import { resolve } from "pathe";

import type { BuildEntry, InferEntriesResult } from "../../types";
import extractExportFilenames from "../../utils/extract-export-filenames";
import { inferExportTypeFromFileName } from "../../utils/infer-export-type";
import getEntrypointPaths from "./get-entrypoint-paths";

/**
 * @param {PackageJson} packageJson The contents of a package.json file to serve as the source for inferred entries.
 * @param {string[]} sourceFiles A list of source files to use for inferring entries.
 * @param {string | undefined} rootDirectory The root directory of the project.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const inferEntries = (packageJson: PackageJson, sourceFiles: string[], rootDirectory = "."): InferEntriesResult => {
    const warnings = [];

    // Sort files so least-nested files are first
    sourceFiles.sort((a, b) => a.split("/").length - b.split("/").length);

    // Come up with a list of all output files & their formats
    const outputs = extractExportFilenames(packageJson.exports, packageJson.type || "commonjs");

    if (packageJson.bin) {
        const binaries = typeof packageJson.bin === "string" ? [packageJson.bin] : Object.values(packageJson.bin);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const file of binaries) {
            outputs.push({ file: file as string, isExecutable: true });
        }
    }

    if (packageJson.main) {
        outputs.push({ file: packageJson.main, type: inferExportTypeFromFileName(packageJson.main) ?? (packageJson.type === "module" ? "esm" : "cjs") });
    }

    // Defacto module entry-point for bundlers (not Node.js)
    // https://github.com/dherman/defense-of-dot-js/blob/master/proposal.md
    if (packageJson.module) {
        outputs.push({ file: packageJson.module, type: "esm" });
    }

    // Entry point for TypeScript
    if (packageJson.types || packageJson.typings) {
        outputs.push({ file: (packageJson.types || packageJson.typings) as string });
    }

    // Try to detect output types
    const isESMPackage = packageJson.type === "module";

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const output of outputs.filter((o) => !o.type)) {
        const isJS = output.file.endsWith(".js");

        if ((isESMPackage && isJS) || output.file.endsWith(".mjs")) {
            output.type = "esm";
        } else if ((!isESMPackage && isJS) || output.file.endsWith(".cjs")) {
            output.type = "cjs";
        }
    }

    let cjs = false;
    let esm = false;
    let dts = false;

    // Infer entries from package files
    const entries: BuildEntry[] = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const output of outputs) {
        // Supported output file extensions are `.d.ts`, `.cjs` and `.mjs`
        // But we support any file extension here in case user has extended rollup options
        const outputSlug = output.file.replace(/(?:\*[^/\\]*|\.d\.(?:m|c)?ts|\.\w+)$/, "");
        const isDirectory = outputSlug.endsWith("/");

        // Skip top level directory
        if (isDirectory && ["./", "/"].includes(outputSlug)) {
            // eslint-disable-next-line no-continue
            continue;
        }

        const possiblePaths = getEntrypointPaths(outputSlug);
        // eslint-disable-next-line unicorn/no-array-reduce
        const input = possiblePaths.reduce<string | undefined>((source, d) => {
            if (source) {
                return source;
            }

            const SOURCE_RE = new RegExp(`(?<=/|$)${d}${isDirectory ? "" : "\\.\\w+"}$`);

            return sourceFiles.find((index) => SOURCE_RE.test(index))?.replace(/(?:\.d\.(?:m|c)?ts|\.\w+)$/, "");
        }, undefined);

        if (!input) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            if (!existsSync(resolve(rootDirectory, output.file))) {
                warnings.push(`Could not find entrypoint for \`${output.file}\``);
            }

            // eslint-disable-next-line no-continue
            continue;
        }

        if (output.type === "cjs") {
            cjs = true;
        }

        if (output.type === "esm") {
            esm = true;
        }

        const entry = entries.find((index) => index.input === input) ?? (entries[entries.push({ input }) - 1] as BuildEntry);

        if (/\.d\.(?:m|c)?ts$/.test(output.file)) {
            dts = true;
        }

        if (isDirectory) {
            entry.outDir = outputSlug;
        }

        entry.format = output.type;

        if (output.isExecutable) {
            entry.isExecutable = true;
        }
    }

    return { cjs, dts, entries, esm, warnings };
};

export default inferEntries;
