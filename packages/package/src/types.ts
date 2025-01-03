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
    confirm?: {
        default?: boolean;
        message: string | ((packages: string[]) => string);
        theme?: PartialDeep<Theme>;
        transformer?: (value: boolean) => string;
    };
    cwd?: URL | string;
    deps?: boolean;
    devDeps?: boolean;
    installPackage?: Omit<InstallPackageOptions, "cwd" | "dev">;
    peerDeps?: boolean;
};
