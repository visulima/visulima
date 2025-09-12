import type { GroupType } from "../types";

const getType = (filePath: string): GroupType => {
    if (filePath.startsWith("node:")) {
        return "internal";
    }

    if (filePath.includes("node_modules")) {
        return "node_modules";
    }

    if (filePath.includes("native")) {
        return "native";
    }

    if (filePath.includes("webpack")) {
        return "webpack";
    }

    return undefined;
};

export default getType;
