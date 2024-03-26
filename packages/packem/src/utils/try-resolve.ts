import jiti from "jiti";

import logger from "../logger";

export function tryResolve(id: string, rootDir: string = process.cwd()) {
    const _require = jiti(rootDir, { esmResolve: true, interopDefault: true });

    try {
        return _require.resolve(id);
    } catch (error: any) {
        if (error.code !== "MODULE_NOT_FOUND") {
            logger.error(`Error trying import ${id} from ${rootDir}`, error);
        }

        return id;
    }
}
