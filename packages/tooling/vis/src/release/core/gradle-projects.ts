/**
 * Gradle modules as release packages, opt-in through `release.gradle.discover`.
 *
 * The build root and every module listed in `settings.gradle(.kts)` become
 * `WorkspacePackage`s with `ecosystem: "gradle"`, named `group:artifact`. The
 * group is read from the build scripts and the artifact is the project directory
 * name (the root uses `rootProject.name`). Gradle's default artifact is the same,
 * so a module that renames its artifact (`archivesName`) is refused, not guessed.
 *
 * A module's version is a plain string literal in its own build script, or in the
 * root script's `allprojects` / `subprojects` block. Anything else (a property, a
 * function call, two declarations) is an error, not a silent skip. A module with
 * no version at all is not released, which covers aggregator projects. The root
 * build is released only with a version of its own, for the same reason.
 */

import { access, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type { GradleAssignment, GradleBuildScan } from "../../util/gradle-build";
import { inheritedAssignments, ownAssignments, scanGradleBuild, scanGradleSettings } from "../../util/gradle-build";
import { VisReleaseError } from "../errors";
import type { PackageManifest, WorkspacePackage } from "../types";

const BUILD_FILES = ["build.gradle.kts", "build.gradle"];
const SETTINGS_FILES = ["settings.gradle.kts", "settings.gradle"];

/** One Gradle project as the release wave sees it. */
export interface GradleProject {
    /** `literal`: the module's own script sets the version. `inherited`: the root script's allprojects / subprojects block does. */
    kind: "inherited" | "literal";
    /** 1-based line of the version declaration in `owner`. The plan finds it again by line after earlier writes. */
    line: number;
    name: string;
    /** The build script that holds the version literal this module's release rewrites. */
    owner: string;
    package: WorkspacePackage;
    /** Gradle project path (`:lib:core`), or `""` for the root project. */
    taskPath: string;
}

const invalid = (file: string, message: string): VisReleaseError => new VisReleaseError({ code: "CONFIG_INVALID", file, message });

/** A `version=` line in the module's or the root's gradle.properties. vis does not read that value, so it must not skip the module silently. */
const propertiesDeclareVersion = async (dir: string, root: string): Promise<string | undefined> => {
    for (const candidate of new Set([join(dir, "gradle.properties"), join(root, "gradle.properties")])) {
        let raw: string;

        try {
            raw = await readFile(candidate, "utf8");
        } catch {
            continue;
        }

        if (/^\s*version\s*[=:]/m.test(raw)) {
            return candidate;
        }
    }

    return undefined;
};

const exists = (path: string): Promise<boolean> =>
    access(path).then(
        () => true,
        () => false,
    );

const firstExisting = async (dir: string, names: string[]): Promise<{ path: string; raw: string } | undefined> => {
    for (const name of names) {
        const path = join(dir, name);

        try {
            return { path, raw: await readFile(path, "utf8") };
        } catch {
            // Try the next name; a missing file is the normal case for one of the two.
        }
    }

    return undefined;
};

/** The single literal a module reaches from `assignments`, or undefined. Non-literal or repeated values are errors. */
const singleLiteral = (
    assignments: GradleAssignment[],
    file: string,
    name: GradleAssignment["name"],
): { assignment: GradleAssignment; value: string } | undefined => {
    if (assignments.length === 0) {
        return undefined;
    }

    if (assignments.length > 1) {
        throw invalid(file, `${file} declares ${name} ${assignments.length} times on the path that reaches a module (lines ${assignments.map((a) => a.line).join(", ")}). vis cannot tell which one applies.`);
    }

    const [assignment] = assignments as [GradleAssignment];

    if (assignment.literal === undefined) {
        throw invalid(file, `${file} sets ${name} to an expression on line ${assignment.line}. vis reads only a plain string literal, such as ${name} = "1.0.0".`);
    }

    return { assignment, value: assignment.literal.value };
};

interface FoundModule {
    kind: GradleProject["kind"];
    line: number;
    module: ModuleSource;
    name: string;
    owner: string;
    scan: GradleBuildScan;
    version: string;
}

interface ModuleSource {
    build: { path: string; raw: string };
    /** The module directory, absolute. */
    dir: string;
    isRoot: boolean;
    path: string;
    taskPath: string;
}

/**
 * Discover the Gradle modules under `cwd` as release packages. Returns nothing
 * without a root build script or settings file. `options.claimedDirs` are module
 * directories a JS package already releases; they are skipped.
 */
export const discoverGradleProjects = async (options: { claimedDirs: ReadonlySet<string>; cwd: string }): Promise<GradleProject[]> => {
    const { claimedDirs, cwd } = options;
    const rootBuild = await firstExisting(cwd, BUILD_FILES);
    const settings = await firstExisting(cwd, SETTINGS_FILES);

    if (!rootBuild && !settings) {
        return [];
    }

    const settingsScan = settings ? scanGradleSettings(settings.raw) : undefined;

    if (settingsScan?.unsupported.length) {
        throw invalid(settings!.path, `${settings!.path} moves a project (${settingsScan.unsupported.join(", ")}). vis cannot follow that to a version; remove it or release the module with a shell publish.`);
    }

    if (settingsScan?.dynamicIncludes) {
        process.stderr.write(`[vis release] ⚠ ${settings!.path} builds part of its include list from code; vis only reads literal include("…") entries.\n`);
    }

    const rootScan = rootBuild ? scanGradleBuild(rootBuild.raw) : undefined;
    const rootAssignments = rootScan?.assignments ?? [];
    const modules: ModuleSource[] = [];

    if (rootBuild) {
        modules.push({ build: rootBuild, dir: cwd, isRoot: true, path: "", taskPath: "" });
    }

    for (const path of settingsScan?.includes ?? []) {
        const dir = join(cwd, path);
        const build = await firstExisting(dir, BUILD_FILES);

        // A listed project with no build script is an aggregate with nothing to release.
        if (build) {
            modules.push({ build, dir, isRoot: false, path, taskPath: `:${path.replaceAll("/", ":")}` });
        }
    }

    const found: FoundModule[] = [];

    for (const module of modules) {
        if (claimedDirs.has(module.dir)) {
            continue;
        }

        const scan = module.isRoot && rootScan ? rootScan : scanGradleBuild(module.build.raw);
        const own = singleLiteral(ownAssignments(scan.assignments, "version"), module.build.path, "version");

        // The root build is released only when it declares its own version. Under allprojects it is
        // an aggregator, which has nothing to publish, so its publish task would fail the release.
        if (module.isRoot && own === undefined) {
            continue;
        }

        const inherited = own ? undefined : singleLiteral(inheritedAssignments(rootAssignments, "version", module.isRoot), rootBuild?.path ?? module.build.path, "version");
        const versioned = own ?? inherited;

        // No version in any script: an aggregate, unless a gradle.properties sets one, which vis does not read.
        if (!versioned) {
            const properties = await propertiesDeclareVersion(module.dir, cwd);

            if (properties !== undefined) {
                throw invalid(properties, `${properties} sets version, and vis reads only a string literal in a build script. Move it to version = "…" in ${module.build.path}, or remove it.`);
            }

            continue;
        }

        const groupDeclaration = singleLiteral(ownAssignments(scan.assignments, "group"), module.build.path, "group")
            ?? singleLiteral(inheritedAssignments(rootAssignments, "group", module.isRoot), rootBuild?.path ?? module.build.path, "group");

        if (groupDeclaration === undefined) {
            throw invalid(module.build.path, `${module.build.path} has a version but no group. Declare group = "…" in its build script or in the root build script's allprojects block.`);
        }

        if (scan.usesArchiveName || rootScan?.usesArchiveName) {
            throw invalid(module.build.path, `${module.build.path} renames its archive (archivesName). vis cannot read the artifact name from that; remove it or release the module with a shell publish.`);
        }

        const artifact = module.isRoot ? (settingsScan?.rootName ?? basename(cwd)) : basename(module.dir);

        found.push({
            kind: own ? "literal" : "inherited",
            line: versioned.assignment.line,
            module,
            name: `${groupDeclaration.value}:${artifact}`,
            owner: own ? module.build.path : rootBuild!.path,
            scan,
            version: versioned.value,
        });
    }

    const names = new Map<string, string>();

    for (const entry of found) {
        const existing = names.get(entry.name);

        if (existing !== undefined) {
            throw invalid(entry.module.build.path, `${entry.name} is declared by both ${existing} and ${entry.module.build.path}. Gradle coordinates must be unique to release them.`);
        }

        names.set(entry.name, entry.module.build.path);
    }

    // Only edges to released modules count. `project(":x")` has no version to move, so it is "*".
    const byPath = new Map(found.map((entry) => [entry.module.path, entry.name]));

    return found.map(({ kind, line, module, name, owner, scan, version }) => {
        const dependencies: Record<string, string> = {};

        for (const ref of scan.projectRefs) {
            const target = byPath.get(ref.replace(/^:+/, "").split(":").filter((part) => part !== "").join("/"));

            if (target !== undefined && target !== name) {
                dependencies[target] = "*";
            }
        }

        const manifest: PackageManifest = { dependencies, name, private: false, version };

        return {
            kind,
            line,
            name,
            owner,
            package: {
                dir: module.dir,
                ecosystem: "gradle",
                manifest,
                manifestPath: module.build.path,
                name,
                private: false,
                version,
            },
            taskPath: module.taskPath,
        };
    });
};

/** The directory of the build root a module belongs to: the nearest ancestor that holds `settings.gradle(.kts)` or `gradlew`. */
export const findGradleRoot = async (moduleDir: string): Promise<string | undefined> => {
    let current = moduleDir;

    for (;;) {
        if ((await exists(join(current, "gradlew"))) || (await firstExisting(current, SETTINGS_FILES)) !== undefined) {
            return current;
        }

        const parent = dirname(current);

        if (parent === current) {
            return undefined;
        }

        current = parent;
    }
};
