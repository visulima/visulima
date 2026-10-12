/**
 * Keep `Cargo.lock` in step with a crate version bump.
 *
 * A workspace member appears in the lockfile as a `[[package]]` block with
 * its own `version` and no `source` line. Registry and git dependencies
 * always carry a `source`, so they are never rewritten here. Only the
 * version line of the matching member changes, which leaves the rest of
 * the lockfile byte-for-byte as cargo wrote it.
 *
 * The lockfile sits at the workspace root, not beside the crate, so the
 * lookup walks up from the manifest and stops at the workspace root (`cwd`).
 */

import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { VisReleaseError } from "../errors";
import type { PerPackageReleaseConfig } from "../types";
import { resolveVersionFileKind } from "./version-files";

export interface CargoLockRewrite {
    content?: string;
    found: boolean;
}

const PACKAGE_HEADER = "[[package]]";

/**
 * Rewrite the `version` of the workspace-member block named `crateName`.
 * `found` is false when no member block matches, e.g. the crate is not in
 * this lockfile yet.
 */
export const rewriteCargoLockVersion = (raw: string, crateName: string, newVersion: string): CargoLockRewrite => {
    const lines = raw.split("\n");
    let found = false;
    let blockStart = -1;

    // Each block runs from its `[[package]]` header to the next header (or EOF).
    const blocks: { end: number; start: number }[] = [];

    for (const [i, line] of lines.entries()) {
        if (line.trim() === PACKAGE_HEADER) {
            if (blockStart !== -1) {
                blocks.push({ end: i, start: blockStart });
            }

            blockStart = i;
        }
    }

    if (blockStart !== -1) {
        blocks.push({ end: lines.length, start: blockStart });
    }

    for (const { end, start } of blocks) {
        let name: string | undefined;
        let versionLine = -1;
        let hasSource = false;

        for (let i = start + 1; i < end; i++) {
            const line = lines[i]!;
            const nameMatch = /^name\s*=\s*"([^"]+)"\s*$/.exec(line);
            const versionMatch = /^version\s*=\s*"[^"]*"\s*$/.exec(line);

            if (nameMatch && name === undefined) {
                [, name] = nameMatch;
            } else if (versionMatch && versionLine === -1) {
                versionLine = i;
            } else if (/^source\s*=/.test(line)) {
                hasSource = true;
            }
        }

        if (name !== crateName || hasSource || versionLine === -1) {
            continue;
        }

        lines[versionLine] = `version = "${newVersion}"${lines[versionLine]!.endsWith("\r") ? "\r" : ""}`;
        found = true;
    }

    return found ? { content: lines.join("\n"), found } : { found };
};

export const canonicalPath = (p: string): string => {
    const resolved = resolve(p);

    try {
        return realpathSync.native(resolved);
    } catch {
        return resolved;
    }
};

/**
 * Walk up from `manifestDir` to `workspaceRoot` (inclusive) and return the
 * first `Cargo.lock`. Undefined when none exists, which is normal for
 * library-only repos that do not commit a lockfile.
 */
export const findCargoLock = async (manifestDir: string, workspaceRoot: string): Promise<string | undefined> => {
    // Canonicalize both sides. Discovered manifests are realpaths (on macOS
    // `/private/var/…`) while the workspace root may still be `/var/…`, and a
    // mismatch makes the lockfile look like it sits outside the workspace.
    const root = canonicalPath(workspaceRoot);
    let current = canonicalPath(manifestDir);

    for (;;) {
        const candidate = join(current, "Cargo.lock");

        try {
            await readFile(candidate, "utf8");

            return candidate;
        } catch {
            // not here, keep walking
        }

        if (current === root) {
            return undefined;
        }

        const parent = dirname(current);

        // Outside the workspace (or at the filesystem root): stop rather than
        // pick up an unrelated lockfile.
        const rel = relative(root, parent);

        if (parent === current || rel.startsWith("..") || isAbsolute(rel)) {
            return undefined;
        }

        current = parent;
    }
};

/** Crate name from a manifest's `[package].name`, or undefined for a virtual manifest. */
export const readCrateName = async (raw: string, manifestPath: string): Promise<string | undefined> => {
    const { parse } = await import("smol-toml");

    try {
        const doc = parse(raw) as { package?: { name?: unknown } };

        return typeof doc.package?.name === "string" ? doc.package.name : undefined;
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            file: manifestPath,
            message: `Failed to parse ${manifestPath}: ${(error as Error).message}`,
        });
    }
};

/**
 * Cargo manifests a package bumps: `versionFiles` entries that are Cargo.toml,
 * plus the crate behind the `cargo` versionActions (`cargoTomlPath`, default
 * `Cargo.toml`). Paths are absolute.
 */
export const cargoManifestPaths = (packageDir: string, perPkg: PerPackageReleaseConfig): string[] => {
    const paths = new Set<string>();

    for (const entry of perPkg.versionFiles ?? []) {
        if (resolveVersionFileKind(entry) === "cargo") {
            paths.add(isAbsolute(entry) ? entry : join(packageDir, entry));
        }
    }

    if (perPkg.versionActions === "cargo") {
        const entry = perPkg.cargoTomlPath ?? "Cargo.toml";

        paths.add(isAbsolute(entry) ? entry : join(packageDir, entry));
    }

    return [...paths];
};

export interface CargoLockSyncResult {
    warnings: string[];
    writes: { content: string; path: string }[];
}

/** One crate manifest a release bumps, paired with the version it moves to. */
export interface CargoLockEntry {
    manifestPath: string;
    newVersion: string;
}

/**
 * Bring `Cargo.lock` in line with every bumped crate in one pass.
 *
 * Runs once per release wave, not once per release: two crates in the same
 * lockfile must both land, so every edit reads from and writes to the same
 * `pending` map. `pending` is seeded with the manifest writes already queued,
 * and the lock content is written back into it for the caller to pick up.
 */
export const syncCargoLocks = async (options: {
    entries: ReadonlyArray<CargoLockEntry>;
    pending: Map<string, string>;
    workspaceRoot: string;
}): Promise<CargoLockSyncResult> => {
    const { entries, pending, workspaceRoot } = options;
    const warnings: string[] = [];
    const writes: { content: string; path: string }[] = [];

    for (const { manifestPath, newVersion } of entries) {
        let manifest = pending.get(manifestPath);

        if (manifest === undefined) {
            try {
                manifest = await readFile(manifestPath, "utf8");
            } catch {
                continue;
            }
        }

        const crateName = await readCrateName(manifest, manifestPath);

        if (crateName === undefined) {
            continue;
        }

        const lockPath = await findCargoLock(dirname(manifestPath), workspaceRoot);

        if (lockPath === undefined) {
            continue;
        }

        let lock = pending.get(lockPath);

        if (lock === undefined) {
            lock = await readFile(lockPath, "utf8");
        }

        const result = rewriteCargoLockVersion(lock, crateName, newVersion);

        if (!result.found) {
            warnings.push(`cargo-lock: ${crateName} has no workspace-member entry in ${lockPath}; run \`cargo generate-lockfile\` or build once to add it.`);

            continue;
        }

        if (result.content !== undefined && result.content !== lock) {
            pending.set(lockPath, result.content);

            const existing = writes.findIndex((write) => write.path === lockPath);
            const write = { content: result.content, path: lockPath };

            if (existing === -1) {
                writes.push(write);
            } else {
                writes[existing] = write;
            }
        }
    }

    return { warnings, writes };
};
