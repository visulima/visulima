import type { PreRenderedAsset } from "rollup";

const isWindows = process.platform === "win32";

const getEntryFileNames = (chunkInfo: PreRenderedAsset, extension: "cjs" | "mjs"): string => {
    const pathSeperator = isWindows ? "\\" : "/";

    if (chunkInfo.name?.includes("node_modules" + pathSeperator + ".pnpm")) {
        const name = chunkInfo.name.replace("node_modules" + pathSeperator + ".pnpm", "external") + "." + extension;

        return name.replace("node_modules" + pathSeperator, "");
    }

    if (chunkInfo.name?.includes("node_modules")) {
        return chunkInfo.name.replace("node_modules", "external") + "." + extension;
    }

    return "[name]." + extension;
};

export default getEntryFileNames;
