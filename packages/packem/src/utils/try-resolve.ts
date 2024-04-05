import jiti from "jiti";

import logger from "../logger";

const tryResolve = (id: string, rootDirectory: string): string => {
    const _require = jiti(rootDirectory, { esmResolve: true, interopDefault: true });

    try {
        return _require.resolve(id);
    } catch (error: any) {
        if (error.code !== "MODULE_NOT_FOUND") {
            logger.error(new Error(`Error trying import ${id} from ${rootDirectory}`, {
                cause: error,
            }));
        }

        return id;
    }
};

export default tryResolve;
