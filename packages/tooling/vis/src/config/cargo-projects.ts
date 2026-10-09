/**
 * Cargo crates as vis projects.
 *
 * A directory without a `package.json` becomes a project when it holds a
 * `Cargo.toml` with a `[package]` table or a `project.json`. Candidates
 * come from the workspace globs and from the root `Cargo.toml`'s
 * `[workspace].members`. A crate nested inside another project (the napi
 * `native/` crate of a JS package) stays part of that project: making it
 * a project of its own would let a change there skip the JS package's
 * tasks.
 */
import { globSync, isAccessibleSync, readFileSync } from "@visulima/fs";
import { dirname, join, relative, resolve } from "@visulima/path";
import type { DependencyType } from "@visulima/task-runner";
import { parse as parseToml } from "smol-toml";

type CargoDependencyTable = Record<string, unknown>;

interface CargoDependencyTables {
    "build-dependencies"?: CargoDependencyTable;
    dependencies?: CargoDependencyTable;
    "dev-dependencies"?: CargoDependencyTable;
}

interface CargoManifest extends CargoDependencyTables {
    package?: { name?: unknown };
    target?: Record<string, CargoDependencyTables>;
    workspace?: { dependencies?: CargoDependencyTable; exclude?: unknown; members?: unknown };
}

/** Root files of a Cargo workspace that change its member crates, not the whole repo. */
const CARGO_WORKSPACE_FILES = ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml", "rust-toolchain"] as const;

/** `cargo package` leaves `Cargo.toml` copies under `target/package/`; vendored crates are not ours. */
const SKIPPED_SEGMENTS = new Set([".git", "node_modules", "target", "vendor"]);

const DEPENDENCY_KINDS: [keyof CargoDependencyTables, DependencyType][] = [
    ["dependencies", "static"],
    ["dev-dependencies", "devDependency"],
    ["build-dependencies", "static"],
];

const stringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

const trimSlashes = (path: string): string => path.replaceAll(/^\.\/|\/+$/g, "");

const readCargoManifest = (directory: string): CargoManifest | undefined => {
    const manifestPath = join(directory, "Cargo.toml");

    if (!isAccessibleSync(manifestPath)) {
        return undefined;
    }

    try {
        return parseToml(readFileSync(manifestPath));
    } catch {
        return undefined;
    }
};

const hasSkippedSegment = (directory: string): boolean => directory.split("/").some((segment) => SKIPPED_SEGMENTS.has(segment));

const isWithin = (path: string, root: string): boolean => root !== "." && root !== "" && (path === root || path.startsWith(`${root}/`));

/** A workspace-glob directory worth inspecting: any manifest vis can build a project from. */
const isProjectCandidate = (directory: string): boolean =>
    isAccessibleSync(join(directory, "package.json")) || isAccessibleSync(join(directory, "project.json")) || isAccessibleSync(join(directory, "Cargo.toml"));

/** Workspace-relative directories of the root Cargo workspace's members (`members` globs expanded, `exclude` honoured). */
const resolveCargoWorkspaceMembers = (workspaceRoot: string, manifest: CargoManifest | undefined): string[] => {
    const members = stringArray(manifest?.workspace?.members).map((path) => trimSlashes(path));

    if (members.length === 0) {
        return [];
    }

    const ignore = [
        ...[...SKIPPED_SEGMENTS].map((segment) => `**/${segment}/**`),
        ...stringArray(manifest?.workspace?.exclude).map((path) => `${trimSlashes(path)}/**`),
    ];
    const manifests = globSync(
        members.map((member) => `${member}/Cargo.toml`),
        { cwd: workspaceRoot, ignore },
    );

    return manifests.map((manifestPath) => dirname(manifestPath)).filter((directory) => directory !== "." && !hasSkippedSegment(directory));
};

/**
 * Picks the Cargo (or `project.json`-only) project directories, given the
 * glob-matched candidates that have no `package.json` and the directories
 * that do. Shortest paths are accepted first so a crate inside an accepted
 * crate is dropped too.
 */
const resolveCargoProjectDirectories = (workspaceRoot: string, candidates: string[], packageDirectories: string[]): string[] => {
    const members = resolveCargoWorkspaceMembers(workspaceRoot, readCargoManifest(workspaceRoot));
    const unique = [...new Set([...candidates, ...members].map((path) => trimSlashes(path)))].toSorted((a, b) => a.length - b.length || a.localeCompare(b));
    const accepted: string[] = [];

    for (const directory of unique) {
        if (hasSkippedSegment(directory) || isAccessibleSync(join(workspaceRoot, directory, "package.json"))) {
            continue;
        }

        if ([...packageDirectories, ...accepted].some((root) => isWithin(directory, root))) {
            continue;
        }

        const absolute = join(workspaceRoot, directory);

        if (isAccessibleSync(join(absolute, "project.json")) || readCargoManifest(absolute)?.package !== undefined) {
            accepted.push(directory);
        }
    }

    return accepted;
};

const readCargoPackageName = (directory: string): string | undefined => {
    const name = readCargoManifest(directory)?.package?.name;

    return typeof name === "string" ? name : undefined;
};

/** Longest-root owner of a workspace-relative path, the same rule affected detection maps files with. */
const findOwningProject = (path: string, projects: Record<string, { root: string }>): string | undefined => {
    let owner: string | undefined;
    let ownerLength = -1;
    let rootProject: string | undefined;

    for (const [name, { root }] of Object.entries(projects)) {
        if (root === "." || root === "") {
            rootProject = name;
        } else if (isWithin(path, root) && root.length > ownerLength) {
            owner = name;
            ownerLength = root.length;
        }
    }

    return owner ?? rootProject;
};

/** Nearest `[workspace]` manifest at or above a crate, inside the vis workspace. */
const findEnclosingCargoWorkspace = (workspaceRoot: string, crateDirectory: string): { directory: string; manifest: CargoManifest } | undefined => {
    for (let directory = crateDirectory; !relative(workspaceRoot, directory).startsWith(".."); directory = dirname(directory)) {
        const manifest = readCargoManifest(directory);

        if (manifest?.workspace) {
            return { directory, manifest };
        }

        if (dirname(directory) === directory) {
            break;
        }
    }

    return undefined;
};

/**
 * Path dependencies of the crate at `projectRoot`, as workspace-relative
 * directories with their edge type. Covers `[dependencies]`,
 * `[dev-dependencies]`, `[build-dependencies]`, their `[target.*]`
 * variants, and `workspace = true` entries resolved through the enclosing
 * `[workspace.dependencies]`.
 */
const collectCargoPathDependencies = (workspaceRoot: string, projectRoot: string): { path: string; type: DependencyType }[] => {
    const crateDirectory = resolve(workspaceRoot, projectRoot);
    const manifest = readCargoManifest(crateDirectory);

    if (!manifest) {
        return [];
    }

    const tableSets: CargoDependencyTables[] = [manifest, ...Object.values(manifest.target ?? {})];
    const result: { path: string; type: DependencyType }[] = [];
    let cargoWorkspace: ReturnType<typeof findEnclosingCargoWorkspace>;

    for (const tables of tableSets) {
        for (const [kind, type] of DEPENDENCY_KINDS) {
            for (const [name, spec] of Object.entries(tables?.[kind] ?? {})) {
                if (!spec || typeof spec !== "object") {
                    continue;
                }

                const { path, workspace } = spec as { path?: unknown; workspace?: unknown };
                let absolute: string | undefined;

                if (typeof path === "string") {
                    absolute = resolve(crateDirectory, path);
                } else if (workspace === true) {
                    cargoWorkspace ??= findEnclosingCargoWorkspace(workspaceRoot, crateDirectory);

                    const inherited = cargoWorkspace?.manifest.workspace?.dependencies?.[name] as { path?: unknown } | undefined;

                    if (cargoWorkspace && typeof inherited?.path === "string") {
                        absolute = resolve(cargoWorkspace.directory, inherited.path);
                    }
                }

                const relativePath = absolute === undefined ? undefined : relative(workspaceRoot, absolute);

                if (relativePath !== undefined && relativePath !== "" && !relativePath.startsWith("..")) {
                    result.push({ path: relativePath, type });
                }
            }
        }
    }

    return result;
};

/**
 * Maps the root Cargo workspace's own files (`Cargo.lock`, ...) to the
 * projects owning its members, so a lockfile bump selects those projects
 * instead of the whole repository. Returns `undefined` (keep the
 * workspace-wide fallback) when the root manifest is also a package, or
 * when any member lies outside every project.
 */
const buildCargoFileOwners = (workspaceRoot: string, projects: Record<string, { root: string }>): Record<string, string[]> | undefined => {
    const manifest = readCargoManifest(workspaceRoot);

    if (!manifest?.workspace || manifest.package !== undefined) {
        return undefined;
    }

    const owners = new Set<string>();

    for (const member of resolveCargoWorkspaceMembers(workspaceRoot, manifest)) {
        const owner = findOwningProject(member, projects);

        if (owner === undefined) {
            return undefined;
        }

        owners.add(owner);
    }

    if (owners.size === 0) {
        return undefined;
    }

    const list = [...owners].toSorted();

    return Object.fromEntries(CARGO_WORKSPACE_FILES.map((file) => [file, list]));
};

export { buildCargoFileOwners, collectCargoPathDependencies, findOwningProject, isProjectCandidate, readCargoPackageName, resolveCargoProjectDirectories };
