import type { Package as normalizePackage } from "normalize-package-data";
import type { PackageJson as typeFestPackageJson } from "type-fest";

export type NormalizedPackageJson = normalizePackage & PackageJson;
export type PackageJson = typeFestPackageJson;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cache<T = any> = Map<string, T>;
