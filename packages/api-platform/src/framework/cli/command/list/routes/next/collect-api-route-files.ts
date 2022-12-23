// eslint-disable-next-line import/no-extraneous-dependencies
import { collect } from "@visulima/readdir";
import { statSync } from "node:fs";
import { join } from "node:path";

import { ALLOWED_EXTENSIONS } from "../../utils";

const isDirectory = (path: string): boolean => {
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
};

const collectApiRouteFiles = async (path: string = "", verbose: boolean = false): Promise<string[]> => {
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
        minimatchOptions: {
            match: {
                debug: verbose,
                matchBase: true,
            },
            skip: {
                debug: verbose,
                matchBase: true,
            },
        },
    });
};

export default collectApiRouteFiles;
