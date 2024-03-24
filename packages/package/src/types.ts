import type { Package as normalizePackage } from "normalize-package-data";
import type { Except, PackageJson as typeFestPackageJson, TsConfigJson } from "type-fest";

export type NormalizedPackageJson = normalizePackage & PackageJson;
export type PackageJson = typeFestPackageJson;

export type TsConfigJsonResolved = Except<TsConfigJson, "extends">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cache<T = any> = Map<string, T>;
