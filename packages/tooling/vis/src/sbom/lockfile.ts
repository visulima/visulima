/**
 * Thin CycloneDX-shaped adapter over the shared lockfile parser in
 * `@visulima/package`. The cross-package parser returns a
 * package-manager-agnostic `{ name, version, integrity: { algorithm, hex } }`
 * shape; CycloneDX 1.6 expects hashes as `{ alg: "SHA-256" | …, content }`,
 * so we translate the algorithm casing here.
 */

import { readFileSync } from "node:fs";

import type { LockFileEntry, LockFileIntegrityAlgorithm, LockFileType } from "@visulima/package";
import { parseLockFileContent } from "@visulima/package";
import { join } from "@visulima/path";

import type { Hash, HashAlgorithm } from "./types";

/** Exposed so downstream callers (and tests) can stay decoupled from `@visulima/package`. */
export type { LockFileType };

/** Resolved package in the shape the SBOM builder consumes. */
export interface ResolvedPackage {
    /**
     * Declared runtime deps — `name → specifier[]` from the lockfile.
     * Arrays preserve pnpm v9+ peer-context variants that resolve the
     * same dep name to different versions.
     */
    dependencies?: Record<string, string[]>;
    hash?: Hash;
    name: string;
    optionalDependencies?: Record<string, string[]>;
    peerDependencies?: Record<string, string[]>;
    version: string;
}

const SRI_TO_CYCLONEDX_ALG: Record<LockFileIntegrityAlgorithm, HashAlgorithm> = {
    sha256: "SHA-256",
    sha384: "SHA-384",
    sha512: "SHA-512",
};

const toResolvedPackage = (entry: LockFileEntry): ResolvedPackage => {
    const resolved: ResolvedPackage = { name: entry.name, version: entry.version };

    if (entry.integrity) {
        resolved.hash = {
            alg: SRI_TO_CYCLONEDX_ALG[entry.integrity.algorithm],
            content: entry.integrity.hex,
        };
    }

    if (entry.dependencies) {
        resolved.dependencies = entry.dependencies;
    }

    if (entry.peerDependencies) {
        resolved.peerDependencies = entry.peerDependencies;
    }

    if (entry.optionalDependencies) {
        resolved.optionalDependencies = entry.optionalDependencies;
    }

    return resolved;
};

const LOCKFILE_CANDIDATES: readonly { file: string; type: LockFileType }[] = [
    { file: "pnpm-lock.yaml", type: "pnpm" },
    { file: "package-lock.json", type: "npm" },
    { file: "yarn.lock", type: "yarn" },
    { file: "bun.lock", type: "bun" },
];

/**
 * Reads the lockfile at `workspaceRoot` (not ancestors — workspaces
 * own their lockfile) and returns entries keyed by `name@version`.
 * Returns `undefined` if no supported lockfile is present.
 */
export const readLockfilePackages = (
    workspaceRoot: string,
): { packages: Map<string, ResolvedPackage>; type: LockFileType } | undefined => {
    for (const { file, type } of LOCKFILE_CANDIDATES) {
        let content: string;

        try {
            content = readFileSync(join(workspaceRoot, file), "utf8");
        } catch {
            continue;
        }

        const packages = new Map<string, ResolvedPackage>();

        for (const entry of parseLockFileContent(content, type)) {
            // Key by `name@version` so multiple versions each become their own component.
            packages.set(`${entry.name}@${entry.version}`, toResolvedPackage(entry));
        }

        return { packages, type };
    }

    return undefined;
};
