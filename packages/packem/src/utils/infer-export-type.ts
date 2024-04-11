import type { PackageJson } from "read-pkg";

export const inferExportTypeFromFileName = (filename: string): "cjs" | "esm" | undefined => {
    if (filename.endsWith(".d.ts")) {
        return "esm";
    }

    if (filename.endsWith(".mjs")) {
        return "esm";
    }

    if (filename.endsWith(".cjs")) {
        return "cjs";
    }

    return undefined;
};

export const inferExportType = (condition: string, previousConditions: string[], filename?: string, type?: PackageJson["type"]): "cjs" | "esm" => {
    if (filename) {
        const inferredType = inferExportTypeFromFileName(filename);

        if (inferredType) {
            return inferredType;
        }
    }

    // Defacto module entry-point for bundlers (not Node.js)
    if (condition === "module") {
        return "esm";
    }

    if (condition === "import") {
        return "esm";
    }

    if (condition === "require") {
        return "cjs";
    }

    if (previousConditions.length === 0) {
        return type === "commonjs" ? "cjs" : "esm";
    }

    const [newCondition, ...rest] = previousConditions;

    return inferExportType(newCondition as string, rest, filename, type);
};
