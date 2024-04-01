import { findPackageManagerSync } from "../package-manager";

/**
 * Error thrown when a package was not found.
 */
class PackageNotFoundError extends Error {
    /**
     * @param {string} packageName - The name of the package that was not found.
     * @param {string} packageManager - The package manager used to install the package.
     */
    public constructor(packageName: string, packageManager = "npm") {
        try {
            const foundManager = findPackageManagerSync();

            // eslint-disable-next-line no-param-reassign
            packageManager = foundManager.packageManager;
        } catch {
            // Do nothing
        }

        super(`Package '${packageName}' was not found. Please install it using '${packageManager}'`);
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/class-literal-property-style
    public get code(): string {
        return "PACKAGE_NOT_FOUND";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code PACKAGE_NOT_FOUND");
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/class-literal-property-style
    public override get name(): string {
        return "PackageNotFoundError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of PackageNotFoundError");
    }
}

export default PackageNotFoundError;
