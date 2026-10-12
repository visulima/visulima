/**
 * Plan every Cargo edit for a release wave in one pass.
 *
 * A bump touches more than the crate's own manifest:
 *   - a crate that inherits `[workspace.package].version` moves with its whole
 *     inherit group, so the group must release together;
 *   - a dependent's `path` dependency carries a version requirement that
 *     must follow the dependency;
 *   - `Cargo.lock` records the crate's version.
 *
 * All of them read from and write to one `pending` map, so two edits to the
 * same file (or the same lockfile) compose instead of overwriting each other.
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { satisfies, validRange } from "semver";

import { VisReleaseError } from "../errors";
import { inheritsFromWorkspace, parseCargoDoc } from "./cargo-crates";
import { canonicalPath, syncCargoLocks } from "./cargo-lock";
import { rewriteCargoVersion } from "./version-files";

const PACKAGE_TABLE: ReadonlySet<string> = new Set(["package"]);
const WORKSPACE_PACKAGE_TABLE: ReadonlySet<string> = new Set(["workspace.package"]);

const DEP_KINDS = new Set(["build-dependencies", "dependencies", "dev-dependencies"]);

export interface CargoPlanRelease {
    /** `"cargo"` for a discovered crate, otherwise a JS package that carries Cargo files. */
    ecosystem?: "cargo" | "npm";
    /** Every Cargo manifest this release bumps (absolute paths). */
    manifestPaths: ReadonlyArray<string>;
    name: string;
    newVersion: string;
}

export interface CargoPlanOptions {
    /** Every crate manifest discovered as a release package (for the inherit-group check). */
    crateManifests: ReadonlyArray<string>;
    cwd: string;
    /** Content already queued by earlier steps; updated in place. */
    pending: Map<string, string>;
    releases: ReadonlyArray<CargoPlanRelease>;
    /** Every Cargo manifest to rescan for dependency requirements. */
    scanManifests: ReadonlyArray<string>;
}

export interface CargoPlanResult {
    touched: Set<string>;
    warnings: string[];
}

const readPending = async (pending: Map<string, string>, path: string): Promise<string> => {
    const queued = pending.get(path);

    return queued ?? readFile(path, "utf8");
};

/**
 * The manifest that owns `[workspace.package].version` for a crate at `dir`:
 * the nearest ancestor (up to `cwd`) that declares it.
 */
const findWorkspaceVersionOwner = async (dir: string, cwd: string, pending: Map<string, string>): Promise<string | undefined> => {
    const root = canonicalPath(cwd);
    let current = canonicalPath(dir);

    for (;;) {
        const candidate = join(current, "Cargo.toml");
        const raw = await readPending(pending, candidate).catch(() => undefined);

        if (raw !== undefined) {
            const doc = await parseCargoDoc(raw, candidate);

            if (typeof doc.workspace?.package?.version === "string") {
                return candidate;
            }
        }

        if (current === root) {
            return undefined;
        }

        const parent = dirname(current);

        if (parent === current) {
            return undefined;
        }

        current = parent;
    }
};

/**
 * What a requirement becomes once the crate moves to `newVersion`, using
 * Cargo's rules: a bare `"0.1.0"` means `^0.1.0`, and the operator is kept.
 * Returns `undefined` when the requirement still accepts the new version.
 */
export const nextRequirement = (current: string, newVersion: string): string | undefined => {
    const match = /^([\^~=])?\s*(.+)$/.exec(current.trim());

    if (!match) {
        return undefined;
    }

    const op = match[1] ?? "";
    const base = match[2]!;

    // Wildcards accept any version of the crate; there is nothing to move.
    if (base.includes("*")) {
        return undefined;
    }

    // Bare requirements are caret requirements in Cargo, not exact matches.
    const range = op === "" ? `^${base}` : `${op}${base}`;

    if (!validRange(range)) {
        return undefined;
    }

    if (satisfies(newVersion, range)) {
        return undefined;
    }

    return `${op}${newVersion}`;
};

type Section = { kind: "none" } | { kind: "table" } | { key: string; kind: "dep"; path?: string; version?: string; versionLine?: number; versionOp?: string };

/** Classify a table header as a dependency table, one dependency's table, or neither. */
const classifyHeader = (header: string): Section => {
    const parts = header.split(".").map((part) => part.trim());
    const last = parts[parts.length - 1] ?? "";
    const rootOk = parts[0] === "target" || parts[0] === "workspace" || parts.length === 1 || DEP_KINDS.has(parts[0] ?? "");

    if (DEP_KINDS.has(last) && rootOk) {
        return { kind: "table" };
    }

    const parent = parts[parts.length - 2] ?? "";

    if (DEP_KINDS.has(parent) && (parts[0] === "target" || parts[0] === "workspace" || parts.length === 2)) {
        return { key: last, kind: "dep" };
    }

    return { kind: "none" };
};

const VERSION_VALUE = /(version\s*=\s*)(["'])([^"']*)\2/;

/**
 * Rewrite the version requirements on path dependencies that point at a
 * crate in `newVersionByDir`. Handles inline tables on one line
 * (`foo = { path = "../foo", version = "0.1" }`) and `[dependencies.foo]`
 * sections. Compound requirements (`>=1, &lt;2`) are left alone with a warning.
 */
export const rewriteCargoRequirements = (
    raw: string,
    manifestDir: string,
    newVersionByDir: ReadonlyMap<string, string>,
): { content?: string; warnings: string[] } => {
    const lines = raw.split("\n");
    const warnings: string[] = [];
    let changed = false;
    let section: Section = { kind: "none" };

    const apply = (index: number, requirementText: string | undefined, newVersion: string, label: string): void => {
        if (requirementText === undefined) {
            return;
        }

        if (requirementText.includes(",")) {
            warnings.push(`cargo-deps: ${label} has a compound requirement "${requirementText}" in ${manifestDir}; left unchanged.`);

            return;
        }

        const next = nextRequirement(requirementText, newVersion);

        if (next === undefined) {
            return;
        }

        lines[index] = lines[index]!.replace(VERSION_VALUE, (_match, prefix: string, quote: string) => `${prefix}${quote}${next}${quote}`);
        changed = true;
    };

    const finishSection = (): void => {
        if (section.kind !== "dep" || section.path === undefined || section.versionLine === undefined || section.version === undefined) {
            return;
        }

        const target = newVersionByDir.get(resolve(manifestDir, section.path));

        if (target !== undefined) {
            apply(section.versionLine, section.version, target, section.key);
        }
    };

    for (const [index, line] of lines.entries()) {
        const header = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/.exec(line);

        if (header) {
            finishSection();
            section = classifyHeader(header[1]!.replaceAll(/\s+/g, ""));

            continue;
        }

        if (section.kind === "table") {
            const inline = /^\s*([^=\s]+)\s*=\s*\{(.*)\}\s*$/.exec(line);

            if (!inline) {
                continue;
            }

            const pathValue = /path\s*=\s*"([^"]*)"/.exec(inline[2]!)?.[1];
            const version = VERSION_VALUE.exec(inline[2]!)?.[3];

            if (pathValue === undefined || version === undefined) {
                continue;
            }

            const target = newVersionByDir.get(resolve(manifestDir, pathValue));

            if (target !== undefined) {
                apply(index, version, target, inline[1]!);
            }

            continue;
        }

        if (section.kind === "dep") {
            const pathValue = /^\s*path\s*=\s*"([^"]*)"/.exec(line)?.[1];

            if (pathValue !== undefined) {
                section.path = pathValue;

                continue;
            }

            const version = VERSION_VALUE.exec(line);

            if (version) {
                section.versionLine = index;
                section.version = version.at(3);
            }
        }
    }

    finishSection();

    return changed ? { content: lines.join("\n"), warnings } : { warnings };
};

/**
 * Apply every Cargo edit for the wave to `pending`: crate versions (with
 * inherit groups checked), dependency requirements, and `Cargo.lock`.
 * Throws `CONFIG_INVALID` when an inherit group would move only part of itself.
 */
export const planCargoWorkspace = async (options: CargoPlanOptions): Promise<CargoPlanResult> => {
    const { crateManifests, cwd, pending, releases, scanManifests } = options;
    const touched = new Set<string>();
    const warnings: string[] = [];
    const newVersionByDir = new Map<string, string>();
    const releasedVersion = new Map<string, string>();

    for (const release of releases) {
        for (const manifest of release.manifestPaths) {
            newVersionByDir.set(dirname(manifest), release.newVersion);
            releasedVersion.set(manifest, release.newVersion);
        }
    }

    // 1. Crate versions. Inheriting crates share one owner, so the owner is
    //    bumped once, and only when the whole group releases together.
    const groups = new Map<string, { members: string[]; version: string }>();

    for (const release of releases) {
        if (release.ecosystem !== "cargo") {
            continue;
        }

        const manifest = release.manifestPaths[0];

        if (manifest === undefined) {
            continue;
        }

        const raw = await readPending(pending, manifest);
        const doc = await parseCargoDoc(raw, manifest);

        if (!inheritsFromWorkspace(doc.package?.version)) {
            const result = rewriteCargoVersion(raw, release.newVersion, PACKAGE_TABLE);

            if (result.content !== undefined) {
                pending.set(manifest, result.content);
                touched.add(manifest);
            }

            continue;
        }

        const owner = await findWorkspaceVersionOwner(dirname(manifest), cwd, pending);

        if (owner === undefined) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: manifest,
                message: `${manifest} inherits its version, but no ancestor Cargo.toml declares [workspace.package].version.`,
            });
        }

        const group = groups.get(owner) ?? { members: [], version: release.newVersion };

        group.members.push(manifest);
        groups.set(owner, group);
    }

    for (const [owner, group] of groups) {
        // Every crate that inherits from this owner, released or not.
        const inheritors: string[] = [];

        for (const candidate of crateManifests) {
            const raw = await readPending(pending, candidate).catch(() => undefined);

            if (raw === undefined) {
                continue;
            }

            const doc = await parseCargoDoc(raw, candidate);

            if (!inheritsFromWorkspace(doc.package?.version)) {
                continue;
            }

            if ((await findWorkspaceVersionOwner(dirname(candidate), cwd, pending)) === owner) {
                inheritors.push(candidate);
            }
        }

        const missing = inheritors.filter((manifest) => releasedVersion.get(manifest) !== group.version);

        if (missing.length > 0) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: owner,
                message: `Crates inherit [workspace.package].version from ${owner}, so they must release together at ${group.version}. Not released at that version: ${missing.join(", ")}.`,
            });
        }

        const raw = await readPending(pending, owner);
        const result = rewriteCargoVersion(raw, group.version, WORKSPACE_PACKAGE_TABLE);

        if (result.content !== undefined) {
            pending.set(owner, result.content);
            touched.add(owner);
        }
    }

    // 2. Dependency requirements in every Cargo manifest in the workspace.
    for (const manifest of scanManifests) {
        const raw = await readPending(pending, manifest).catch(() => undefined);

        if (raw === undefined) {
            continue;
        }

        const result = rewriteCargoRequirements(raw, dirname(manifest), newVersionByDir);

        warnings.push(...result.warnings);

        if (result.content !== undefined) {
            pending.set(manifest, result.content);
            touched.add(manifest);
        }
    }

    // 3. Cargo.lock, once, against the finished manifests.
    const entries = releases.flatMap((release) =>
        release.manifestPaths.map((manifestPath) => { return { manifestPath, newVersion: release.newVersion }; }),
    );

    if (entries.length > 0) {
        const lock = await syncCargoLocks({ entries, pending, workspaceRoot: cwd });

        warnings.push(...lock.warnings);

        for (const write of lock.writes) {
            touched.add(write.path);
        }
    }

    return { touched, warnings };
};
