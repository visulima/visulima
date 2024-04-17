import jiti from "jiti";

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
const tryRequire = (id: string, rootDirectory: string, errorReturn: any): any => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const _require = jiti(rootDirectory, { esmResolve: true, interopDefault: true });

    try {
        return _require(id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code !== "MODULE_NOT_FOUND") {
            throw new Error(`Error trying import ${id} from ${rootDirectory}`, {
                cause: error,
            });
        }

        return errorReturn;
    }
};

export default tryRequire;
