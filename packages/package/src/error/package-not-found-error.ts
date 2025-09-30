import { findPackageManagerSync } from "../package-manager";

/**
 * Error thrown when a package was not found.
 */
class PackageNotFoundError extends Error {
    /**
     * @param packageName The name of the package that was not found.
     * @param packageManager The package manager used to install the package.
     */
    public constructor(packageName: string[] | string, packageManager?: string) {
        if (typeof packageName === "string") {
            // eslint-disable-next-line no-param-reassign
            packageName = [packageName];
        }

        if (packageName.length === 0) {
            super("Package was not found.");

            return;
        }

        if (packageManager === undefined) {
            try {
                const foundManager = findPackageManagerSync();

                // eslint-disable-next-line no-param-reassign
                packageManager = foundManager.packageManager;
            } catch {
                // Empty
            }
        }

        if (packageManager === undefined) {
            // eslint-disable-next-line no-param-reassign
            packageManager = "npm";
        }

        super(`Package '${packageName.join(" ")}' was not found. Please install it using '${packageManager} install ${packageName.join(" ")}'`);
    }

    // eslint-disable-next-line class-methods-use-this
    public get code(): string {
        return "PACKAGE_NOT_FOUND";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code PACKAGE_NOT_FOUND");
    }

    // eslint-disable-next-line class-methods-use-this
    public override get name(): string {
        return "PackageNotFoundError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of PackageNotFoundError");
    }
}

export default PackageNotFoundError;
