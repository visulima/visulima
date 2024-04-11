import type { PackageJson } from "read-pkg";

const inferExportType = (condition: string, previousConditions: string[], filename?: string, type?: PackageJson["type"]): "cjs" | "esm" => {
    if (filename) {
        if (filename.endsWith(".d.ts")) {
            return "esm";
        }

        if (filename.endsWith(".mjs")) {
            return "esm";
        }

        if (filename.endsWith(".cjs")) {
            return "cjs";
        }
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

export default inferExportType;
