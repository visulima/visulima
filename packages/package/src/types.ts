import type { InstallPackageOptions } from "@antfu/install-pkg";
import type { Theme } from "@inquirer/core";
import type { PartialDeep } from "@inquirer/type";
import type { Package as normalizePackage } from "normalize-package-data";
import type { PackageJson as typeFestPackageJson } from "type-fest";

export type NormalizedPackageJson = normalizePackage & PackageJson;
export type PackageJson = typeFestPackageJson;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cache<T = any> = Map<string, T>;

export type EnsurePackagesOptions = {
    /** Configuration for user confirmation prompts when installing packages */
    confirm?: {
        /** Default value for the confirmation prompt */
        default?: boolean;
        /** Message to display in the confirmation prompt, or a function that receives packages array */
        message: string | ((packages: string[]) => string);
        /** Theme configuration for the prompt interface */
        theme?: PartialDeep<Theme>;
        /** Function to transform the boolean value for display */
        transformer?: (value: boolean) => string;
    };
    /** Current working directory for package operations */
    cwd?: URL | string;
    /** Whether to include regular dependencies in the operation */
    deps?: boolean;
    /** Whether to include development dependencies in the operation */
    devDeps?: boolean;
    /** Additional options for package installation (excluding cwd and dev which are handled separately) */
    installPackage?: Omit<InstallPackageOptions, "cwd" | "dev">;
    /** Whether to include peer dependencies in the operation */
    peerDeps?: boolean;
    /** Custom logger interface for warning messages */
    logger?: { warn: (message: string) => void };
    /** Whether to throw an error when warnings are logged instead of just logging them */
    throwOnWarn?: boolean;
};
