import type { PackageJson } from "read-pkg";

import { inferExportType } from "./infer-export-type";

export type OutputDescriptor = { file: string; type?: "cjs" | "esm" };

export const extractExportFilenames = (exports: PackageJson["exports"], type: PackageJson["type"], conditions: string[] = []): OutputDescriptor[] => {
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
            .flatMap(([condition, exports]) =>
                (typeof exports === "string"
                    ? {
                          file: exports,
                          type: inferExportType(condition, conditions, type, exports),
                      }
                    : extractExportFilenames(exports, type, [...conditions, condition])),
            )
    );
};
