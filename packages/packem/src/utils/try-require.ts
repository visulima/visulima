import jiti from "jiti";

import logger from "../logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tryRequire = (id: string, rootDirectory: string = process.cwd()): any => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const _require = jiti(rootDirectory, { esmResolve: true, interopDefault: true });

    try {
        return _require(id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code !== "MODULE_NOT_FOUND") {
            logger.error(`Error trying import ${id} from ${rootDirectory}`, error);
        }

        return {};
    }
};

export default tryRequire;
