import { existsSync } from "node:fs";

import type { PackageJson } from "@visulima/package";
import { resolve } from "pathe";

import type { BuildEntry, InferEntriesResult } from "../../types";
import { extractExportFilenames } from "../../utils/extract-export-filenames";
import getEntrypointPaths from "./get-entrypoint-paths";

/**
 * @param {PackageJson} pkg The contents of a package.json file to serve as the source for inferred entries.
 * @param {string[]} sourceFiles A list of source files to use for inferring entries.
 * @param {string | undefined} rootDir The root directory of the project.
 */
const inferEntries = (package_: PackageJson, sourceFiles: string[], rootDir?: string): InferEntriesResult => {
    const warnings = [];

    // Sort files so least-nested files are first
    sourceFiles.sort((a, b) => a.split("/").length - b.split("/").length);

    // Come up with a list of all output files & their formats
    const outputs = extractExportFilenames(package_.exports, package_.type || "commonjs");

    if (package_.bin) {
        const binaries = typeof package_.bin === "string" ? [package_.bin] : Object.values(package_.bin);

        for (const file of binaries) {
            outputs.push({ file });
        }
    }
    if (package_.main) {
        outputs.push({ file: package_.main });
    }
    if (package_.module) {
        outputs.push({ file: package_.module, type: "esm" });
    }
    if (package_.types || package_.typings) {
        outputs.push({ file: package_.types || package_.typings! });
    }

    // Try to detect output types
    const isESMPackage = package_.type === "module";

    for (const output of outputs.filter((o) => !o.type)) {
        const isJS = output.file.endsWith(".js");

        if ((isESMPackage && isJS) || output.file.endsWith(".mjs")) {
            output.type = "esm";
        } else if ((!isESMPackage && isJS) || output.file.endsWith(".cjs")) {
            output.type = "cjs";
        }
    }

    let cjs = false;
    let dts = false;

    // Infer entries from package files
    const entries: BuildEntry[] = [];

    for (const output of outputs) {
        // Supported output file extensions are `.d.ts`, `.cjs` and `.mjs`
        // But we support any file extension here in case user has extended rollup options
        const outputSlug = output.file.replace(/(\*[^/\\]*|\.d\.(m|c)?ts|\.\w+)$/, "");
        const isDirectory = outputSlug.endsWith("/");

        // Skip top level directory
        if (isDirectory && ["./", "/"].includes(outputSlug)) {
            continue;
        }

        const possiblePaths = getEntrypointPaths(outputSlug);
        // eslint-disable-next-line unicorn/no-array-reduce
        const input = possiblePaths.reduce<string | undefined>((source, d) => {
            if (source) {
                return source;
            }

            const SOURCE_RE = new RegExp(`(?<=/|$)${d}${isDirectory ? "" : "\\.\\w+"}$`);

            return sourceFiles.find((index) => SOURCE_RE.test(index))?.replace(/(\.d\.(m|c)?ts|\.\w+)$/, "");
        }, undefined as any);

        if (!input) {
            if (!existsSync(resolve(rootDir || ".", output.file))) {
                warnings.push(`Could not find entrypoint for \`${output.file}\``);
            }

            continue;
        }

        if (output.type === "cjs") {
            cjs = true;
        }

        const entry = entries.find((index) => index.input === input) || entries[entries.push({ input }) - 1];

        if (/\.d\.(m|c)?ts$/.test(output.file)) {
            dts = true;
        }

        if (isDirectory) {
            entry.outDir = outputSlug;
            (entry as MkdistBuildEntry).format = output.type;
        }
    }

    return { cjs, dts, entries, warnings };
};

export default inferEntries;
