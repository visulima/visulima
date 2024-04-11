import type { PackageJson } from "read-pkg";

import inferExportType from "./infer-export-type";

type OutputDescriptor = { file: string; isExecutable?: true, type?: "cjs" | "esm" };

const extractExportFilenames = (exports: PackageJson["exports"], type: PackageJson["type"], conditions: string[] = []): OutputDescriptor[] => {
    if (!exports) {
        return [];
    }

    if (typeof exports === "string") {
        return [{ file: exports, type: "esm" }];
    }

    return (
        Object.entries(exports)
            // Filter out .json subpaths such as package.json
            .filter(([subpath]) => !subpath.endsWith(".json"))
            .flatMap(([condition, packageExport]) =>
                (typeof packageExport === "string"
                    ? {
                          file: packageExport,
                          type: inferExportType(condition, conditions, packageExport, type),
                      }
                    : extractExportFilenames(packageExport, type, [...conditions, condition])),
            )
    );
};

export default extractExportFilenames;
