import type { PackageJson } from "read-pkg";

import { inferExportType, inferExportTypeFromFileName } from "./infer-export-type";

type OutputDescriptor = { fieldName?: string; file: string; isExecutable?: true, type?: "cjs" | "esm" };

const extractExportFilenames = (packageExports: PackageJson["exports"], type: PackageJson["type"], conditions: string[] = []): OutputDescriptor[] => {
    if (!packageExports) {
        return [];
    }

    if (typeof packageExports === "string") {
        const inferredType = inferExportTypeFromFileName(packageExports);
        const fileType = type === "module" ? "esm" : "cjs";

        if (inferredType && inferredType !== fileType) {
            throw new Error(`Exported file "${packageExports}" has an extension that does not match the package.json type "${type}".`);
        }

        return [{ file: packageExports, type: inferredType ?? fileType }];
    }

    return (
        Object.entries(packageExports)
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
