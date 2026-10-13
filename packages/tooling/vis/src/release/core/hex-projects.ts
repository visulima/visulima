/**
 * Hex packages as release packages, opt-in through `release.hex.discover`.
 *
 * The root `mix.exs` is a package. An umbrella (a project with `apps_path:`) also
 * has each `&lt;apps_path>/*` directory that holds a `mix.exs` as a package. Each is a
 * `WorkspacePackage` with `ecosystem: "hex"`, named by its `package: [name: "…"]`
 * string, or else by its `app:` atom.
 *
 * The version is a `version: "…"` literal in `project/0`, or `version: \@version` with
 * a literal `\@version "…"` attribute. Anything else is an error, not a silent skip. A
 * `mix.exs` with no `version:` key is an aggregate and is not released. The root is
 * released only with a version of its own, the same as the Gradle root.
 */

import { listUmbrellaMembers as listMembers, MixProjectError, readMixProject } from "../../util/mix-project";
import { VisReleaseError } from "../errors";
import type { PackageManifest, WorkspacePackage } from "../types";
import { isValidPackageName } from "./security";

/** One Hex package as the release wave sees it. */
export interface HexProject {
    /** `attribute`: `version: \@version`, written in the `\@version` line. `literal`: written in the `version:` line. */
    kind: "attribute" | "literal";
    /** 1-based line of the version literal in `owner`. The plan finds it again by line. */
    line: number;
    name: string;
    /** The `mix.exs` holding the version literal this package's release rewrites. */
    owner: string;
    package: WorkspacePackage;
}

const invalid = (file: string, message: string, packageName?: string): VisReleaseError =>
    new VisReleaseError({ code: "CONFIG_INVALID", file, message, packageName });

/**
 * Discover the Hex packages under `cwd`. `options.claimedDirs` are directories a JS
 * package already releases; they are skipped. Returns nothing without a root mix.exs.
 */
export const discoverHexProjects = async (options: { claimedDirs: ReadonlySet<string>; cwd: string }): Promise<HexProject[]> => {
    const { claimedDirs, cwd } = options;
    let root: ReturnType<typeof readMixProject>;

    try {
        root = readMixProject(cwd);
    } catch (error) {
        if (error instanceof MixProjectError) {
            throw invalid(error.file, error.message);
        }

        throw error;
    }

    if (root === undefined) {
        return [];
    }

    const dirs = [cwd, ...(root.project.appsPath === undefined ? [] : listMembers(cwd, root.project.appsPath))];
    const found: { app: string | undefined; localDeps: string[]; project: HexProject }[] = [];

    for (const dir of dirs) {
        if (claimedDirs.has(dir)) {
            continue;
        }

        let parsed: ReturnType<typeof readMixProject>;

        try {
            parsed = dir === cwd ? root : readMixProject(dir);
        } catch (error) {
            if (error instanceof MixProjectError) {
                throw invalid(error.file, error.message);
            }

            throw error;
        }

        if (parsed === undefined) {
            continue;
        }

        const { file, project } = parsed;

        // No version key at all: an aggregate, with nothing to release.
        if (project.version === undefined) {
            continue;
        }

        // An umbrella root with no app: is an aggregate with nothing to publish.
        if (project.app === undefined && project.packageName === undefined) {
            if (project.isUmbrella) {
                continue;
            }

            throw invalid(file, `${file} sets a version but no app: atom. Declare app: :my_app in project/0.`);
        }

        const name = project.packageName ?? project.app!;

        if (!isValidPackageName(name)) {
            throw invalid(file, `${file} names the package "${name}", which is not a valid Hex package name (lowercase letters, digits, "_", "." and "-").`, name);
        }

        found.push({
            app: project.app,
            localDeps: project.localDeps,
            project: {
                kind: project.version.kind,
                line: project.version.line,
                name,
                owner: file,
                package: {
                    dir,
                    ecosystem: "hex",
                    manifest: { dependencies: {}, name, private: false, version: project.version.value },
                    manifestPath: file,
                    name,
                    private: false,
                    version: project.version.value,
                },
            },
        });
    }

    const names = new Map<string, string>();

    for (const { project } of found) {
        const existing = names.get(project.name);

        if (existing !== undefined) {
            throw invalid(project.package.manifestPath, `${project.name} is declared by both ${existing} and ${project.package.manifestPath}. Hex package names must be unique to release them.`, project.name);
        }

        names.set(project.name, project.package.manifestPath);
    }

    // A dependency on another discovered app (`in_umbrella` or `path`) orders the publish. It has no version to move, so it is "*".
    const nameByApp = new Map<string, string>();

    for (const { app, project } of found) {
        if (app !== undefined) {
            nameByApp.set(app, project.name);
        }
    }

    return found.map(({ localDeps, project }) => {
        const dependencies: Record<string, string> = {};

        for (const dep of localDeps) {
            const target = nameByApp.get(dep);

            if (target !== undefined && target !== project.name) {
                dependencies[target] = "*";
            }
        }

        const manifest: PackageManifest = { ...project.package.manifest, dependencies };

        return { ...project, package: { ...project.package, manifest } };
    });
};
