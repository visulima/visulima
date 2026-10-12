/**
 * Cargo crates as release packages, opt-in through `release.cargo.discover`.
 *
 * Crates come from the root `Cargo.toml`'s `[workspace].members` (minus
 * `exclude`), the same layout cargo uses. Each one becomes a `WorkspacePackage`
 * with `ecosystem: "cargo"`. Its synthetic `manifest` carries only what the
 * dependency graph needs: name, version, private, and path dependencies on
 * other discovered crates. It is never serialized into `Cargo.toml`.
 */

import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import zeptomatch from "zeptomatch";

import { VisReleaseError } from "../errors";
import type { PackageManifest, WorkspacePackage } from "../types";
import { canonicalPath } from "./cargo-lock";
import { expandMember, isWithinAny } from "./member-glob";

interface CargoSpec {
    package?: unknown;
    path?: unknown;
    version?: unknown;
    workspace?: unknown;
}

interface CargoDoc {
    dependencies?: Record<string, unknown>;
    package?: { name?: unknown; publish?: unknown; version?: unknown };
    workspace?: {
        dependencies?: Record<string, unknown>;
        exclude?: unknown;
        members?: unknown;
        package?: { publish?: unknown; version?: unknown };
    };
}

/**
 * The `[workspace.package].version` a `version.workspace = true` crate inherits:
 * the nearest ancestor `Cargo.toml` that declares it, the way cargo resolves it.
 */
export const findInheritedWorkspaceVersion = async (manifestPath: string): Promise<string | undefined> => {
    let current = dirname(canonicalPath(manifestPath));

    for (;;) {
        const candidate = join(current, "Cargo.toml");
        const raw = await readOptional(candidate);

        if (raw !== undefined) {
            const doc = await parseCargoDoc(raw, candidate);
            const version = doc.workspace?.package?.version;

            if (typeof version === "string") {
                return version;
            }
        }

        const parent = dirname(current);

        if (parent === current) {
            return undefined;
        }

        current = parent;
    }
};

const readOptional = async (path: string): Promise<string | undefined> => {
    try {
        return await readFile(path, "utf8");
    } catch {
        return undefined;
    }
};

export const parseCargoDoc = async (raw: string, manifestPath: string): Promise<CargoDoc> => {
    const { parse } = await import("smol-toml");

    try {
        return parse(raw);
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            file: manifestPath,
            message: `Failed to parse ${manifestPath}: ${(error as Error).message}`,
        });
    }
};

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

/** `version.workspace = true` (or the inline `{ workspace = true }` form). */
export const inheritsFromWorkspace = (value: unknown): boolean => typeof value === "object" && value !== null && (value as { workspace?: unknown }).workspace === true;

/**
 * `publish = false` and `publish = []` both mean "never publish". An inherited
 * `publish` resolves against `[workspace.package]` of the root.
 */
const isPrivateCrate = (pkg: NonNullable<CargoDoc["package"]>, root: CargoDoc): boolean => {
    const publish = inheritsFromWorkspace(pkg.publish) ? root.workspace?.package?.publish : pkg.publish;

    return publish === false || (Array.isArray(publish) && publish.length === 0);
};

interface PathDep {
    /** Absolute directory the path dependency points at. */
    dir: string;
    /** The real package name, which differs from the key when `package = "…"` renames it. */
    name: string;
    requirement: string;
}

/** Path dependencies in `[dependencies]` (the only table the graph follows). */
const pathDepsOf = (doc: CargoDoc, rootDoc: CargoDoc, dir: string, rootDir: string): PathDep[] => {
    const out: PathDep[] = [];

    for (const [key, raw] of Object.entries(doc.dependencies ?? {})) {
        const declared: unknown = raw;
        const inherited = inheritsFromWorkspace(declared);
        const spec = (inherited ? rootDoc.workspace?.dependencies?.[key] : declared) as CargoSpec | undefined;
        const base = inherited ? rootDir : dir;

        if (spec === undefined || typeof spec !== "object" || typeof spec.path !== "string") {
            continue;
        }

        out.push({
            dir: resolve(base, spec.path),
            name: typeof spec.package === "string" ? spec.package : key,
            requirement: typeof spec.version === "string" ? spec.version : "*",
        });
    }

    return out;
};

interface ParsedCrate {
    dir: string;
    manifestPath: string;
    name: string;
    pathDeps: PathDep[];
    private: boolean;
    version: string;
}

/**
 * Discover the Cargo crates under `cwd` as release packages.
 * Returns nothing when there is no root `Cargo.toml`, when the root is a
 * virtual manifest with no members, or when every crate is claimed elsewhere.
 * `options.cwd` is the workspace root (holds the root `Cargo.toml`).
 * `options.claimedDirs` are crate directories a JS package already releases
 * (its `versionFiles` / `cargo()` / `cargoTomlPath`). They are never
 * discovered a second time, which would double-bump and double-publish.
 */
export const discoverCargoCrates = async (options: { claimedDirs: ReadonlySet<string>; cwd: string }): Promise<WorkspacePackage[]> => {
    const { claimedDirs, cwd } = options;
    const rootManifest = join(cwd, "Cargo.toml");
    const rootRaw = await readOptional(rootManifest);

    if (rootRaw === undefined) {
        return [];
    }

    const root = await parseCargoDoc(rootRaw, rootManifest);
    const dirs = new Set<string>();

    if (root.package) {
        dirs.add(cwd);
    }

    const excludes = stringList(root.workspace?.exclude);

    for (const pattern of stringList(root.workspace?.members)) {
        for (const dir of await expandMember(cwd, pattern)) {
            const rel = relative(cwd, dir).split(sep).join("/");

            if (rel.split("/").includes("target") || excludes.some((ex) => zeptomatch(ex, rel))) {
                continue;
            }

            dirs.add(dir);
        }
    }

    // Canonicalize both sides: a claimed directory can be a realpath
    // (`/private/var/…` on macOS) while discovery joins from the raw cwd.
    const claimed = new Set([...claimedDirs].map((dir) => canonicalPath(dir)));
    const crates: ParsedCrate[] = [];

    for (const dir of [...dirs].sort()) {
        if (isWithinAny(canonicalPath(dir), claimed)) {
            continue;
        }

        const manifestPath = join(dir, "Cargo.toml");
        const raw = await readOptional(manifestPath);

        if (raw === undefined) {
            continue;
        }

        const doc = await parseCargoDoc(raw, manifestPath);

        // A manifest without [package] is virtual: it only groups members.
        if (!doc.package) {
            continue;
        }

        const { name } = doc.package;

        if (typeof name !== "string" || name === "") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: manifestPath,
                message: `${manifestPath} has a [package] table without a name.`,
            });
        }

        // A missing version is an error, not a fallback: only a literal string or
        // an explicit `version.workspace = true` counts.
        const declared = doc.package.version;
        const version = typeof declared === "string" ? declared : inheritsFromWorkspace(declared) ? root.workspace?.package?.version : undefined;

        if (typeof version !== "string") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: manifestPath,
                message: `${manifestPath} has no resolvable [package].version.`,
            });
        }

        crates.push({
            dir,
            manifestPath,
            name,
            pathDeps: pathDepsOf(doc, root, dir, cwd),
            private: isPrivateCrate(doc.package, root),
            version,
        });
    }

    const crateByDir = new Map(crates.map((crate) => [crate.dir, crate]));

    return crates.map((crate) => {
        // Only dependencies on crates we release count as graph edges; a path
        // dependency on something outside the workspace is not ours to bump.
        const dependencies: Record<string, string> = {};

        for (const dep of crate.pathDeps) {
            const target = crateByDir.get(dep.dir);

            if (target) {
                dependencies[target.name] = dep.requirement;
            }
        }

        const manifest: PackageManifest = { dependencies, name: crate.name, private: crate.private, version: crate.version };

        return {
            dir: crate.dir,
            ecosystem: "cargo",
            manifest,
            manifestPath: crate.manifestPath,
            name: crate.name,
            private: crate.private,
            version: crate.version,
        };
    });
};
