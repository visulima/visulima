import { existsSync } from "node:fs";

import { cyan } from "@visulima/colorize";
import type { PackageJson } from "@visulima/package";
import type { BuildContext } from "esbuild";
import { resolve } from "pathe";

import logger from "../logger";
import { extractExportFilenames } from "../utils/extract-export-filenames";
import { warn } from "../utils/warn";

const validatePackage = (package_: PackageJson, rootDir: string, context: BuildContext) => {
    if (!package_) {
        return;
    }

    const filenames = new Set(
        [
            ...(typeof package_.bin === "string" ? [package_.bin] : Object.values(package_.bin || {})),
            package_.main,
            package_.module,
            package_.types,
            package_.typings,
            ...extractExportFilenames(package_.exports, package_.type ?? "commonjs").map((index) => index.file),
        ].map(
            (index) =>
                index && resolve(rootDir, index.replace(/\/[^*/]*\*[^\n\r/\u2028\u2029]*(?:[\n\r\u2028\u2029][^*/]*\*[^\n\r/\u2028\u2029]*)*(?:\/.*)?$/, "")),
        ),
    );

    const missingOutputs = [];

    for (const filename of filenames) {
        if (filename && !filename.includes("*") && !existsSync(filename)) {
            missingOutputs.push(filename.replace(`${rootDir}/`, ""));
        }
    }

    if (missingOutputs.length > 0) {
        warn(context, `Potential missing package.json files: ${missingOutputs.map((o) => cyan(o)).join(", ")}`);
    }
}

export default validatePackage;
