import type { PackageJson } from "read-pkg";

export const inferExportType = (condition: string, previousConditions: string[] = [], type: PackageJson["type"] | undefined, filename = ""): "esm" | "cjs" => {
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
    } else if (condition === "require") {
        return "cjs";
    } else if (previousConditions.length === 0) {
        return type === "commonjs" ? "cjs" : "esm";
    }

    const [newCondition, ...rest] = previousConditions;

    return inferExportType(newCondition as string, rest, type, filename);
};
