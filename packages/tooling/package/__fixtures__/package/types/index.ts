// Compile-only fixture. Imports the published surface of @visulima/package
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { findPackageJson, findPackageJsonSync, findPackageRoot, findPackageRootSync, parseLockFileSync } from "@visulima/package";
import type { NormalizedReadResult, PackageJson } from "@visulima/package";

const root: string | undefined = findPackageRootSync();
const rootAsync: Promise<string | undefined> = findPackageRoot();
const pjSync: NormalizedReadResult | undefined = findPackageJsonSync();
const pjAsync: Promise<NormalizedReadResult | undefined> = findPackageJson();

declare const pj: PackageJson;
const name: string | undefined = pj.name;

declare const lockfilePath: string;
const lockfile = parseLockFileSync(lockfilePath);

export { lockfile, name, pjAsync, pjSync, root, rootAsync };
