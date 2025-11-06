import { statSync } from "node:fs";

import { collect } from "@visulima/fs";
import { join } from "@visulima/path";

import { ALLOWED_EXTENSIONS } from "../../utils";

const isDirectory = (path: string): boolean => {
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
};

const collectApiRouteFiles = async (path = ""): Promise<string[]> => {
    let apiFolderPath = join(path, "pages/api");

    // src/pages will be ignored if pages is present in the root directory
    if (!isDirectory(apiFolderPath)) {
        apiFolderPath = join(path, "src/pages/api");

        if (!isDirectory(apiFolderPath)) {
            return [];
        }
    }

    return collect(apiFolderPath, {
        extensions: ALLOWED_EXTENSIONS,
        includeDirs: false,
    });
};

export default collectApiRouteFiles;
