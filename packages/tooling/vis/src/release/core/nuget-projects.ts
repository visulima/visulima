/**
 * NuGet projects as release packages, opt-in through `release.nuget.discover`.
 *
 * Every `*.csproj` and `*.fsproj` under the root (skipping `bin`, `obj`,
 * `node_modules`, dot-directories and anything under a JS package directory) is a
 * `WorkspacePackage` with `ecosystem: "nuget"`. One project per file.
 *
 * - **Name.** The `PackageId` literal, else the `AssemblyName` literal, else the file
 *   name. NuGet ids compare case-insensitively, so the release name is the lowercased
 *   id. An MSBuild expression in the name is an error.
 * - **Version.** A `&lt;Version>` literal in the project file, or in the nearest
 *   `Directory.Build.props` (MSBuild stops at the first one it finds). A project's own
 *   literal overrides the props value, as MSBuild does; the props value then belongs
 *   to the projects that inherit it, and they release together.
 * - **Refused.** Anything that could set the package version from elsewhere: a
 *   `PackageVersion`, `VersionPrefix` or `VersionSuffix` element, an `Import`, a
 *   `Version` in `Directory.Build.targets`, or a `Version` that is conditional or
 *   an expression. Each is `CONFIG_INVALID`, never a silent skip.
 * - **Not released.** A project with no version, or with `IsPackable` set to false
 *   (test projects default to that), is not a release package.
 */

import { access, readdir, readFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";

import { hasElement, maskXmlComments, NuGetReadError, readNuGetProperty } from "../../util/nuget-project";
import { VisReleaseError } from "../errors";
import type { WorkspacePackage } from "../types";
import { isValidPackageName } from "./security";

const PROJECT_EXTENSIONS = new Set([".csproj", ".fsproj"]);
const SKIPPED_DIRECTORIES = new Set(["bin", "node_modules", "obj"]);
/** A plain version: `1.2.3`, `1.2`, `1.2.3-beta.1`, optional `+metadata`. Anything with `$(` fails here. */
const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}(?:-[0-9A-Z.-]+)?(?:\+[0-9A-Z.-]+)?$/i;
/** Elements that can set the package version or pull in another file vis does not read. */
const REFUSED_ELEMENTS: ReadonlyArray<{ message: string; name: string }> = [
    { message: "sets the package version through PackageVersion, which vis does not read", name: "PackageVersion" },
    { message: "sets VersionPrefix or VersionSuffix, which vis does not read (use a plain Version literal)", name: "VersionPrefix" },
    { message: "sets VersionSuffix, which vis does not read (use a plain Version literal)", name: "VersionSuffix" },
    { message: "imports another file, which vis does not read", name: "Import" },
];

/** One NuGet project as the release wave sees it. */
export interface NuGetProject {
    /** `literal`: the project file sets the version. `inherited`: the nearest Directory.Build.props does. */
    kind: "inherited" | "literal";
    /** 1-based line of the version literal in `owner`. The plan finds it again by line after earlier writes. */
    line: number;
    /** Lowercased package id. */
    name: string;
    /** The file holding the version literal this project's release rewrites: its project file, or the shared props file. */
    owner: string;
    package: WorkspacePackage;
    /** Absolute path of the `.csproj` / `.fsproj`. */
    projectPath: string;
}

const invalid = (file: string, message: string, packageName?: string): VisReleaseError =>
    new VisReleaseError({ code: "CONFIG_INVALID", file, message, packageName });

/** Run an MSBuild read and turn its `NuGetReadError` into a `CONFIG_INVALID` for the release. */
const reading = <T>(work: () => T): T => {
    try {
        return work();
    } catch (error) {
        if (error instanceof NuGetReadError) {
            throw invalid(error.file, error.message);
        }

        throw error;
    }
};

const exists = (path: string): Promise<boolean> =>
    access(path).then(
        () => true,
        () => false,
    );

/** The nearest file called `name` from `start` up to `stop` (inclusive), the way MSBuild searches for Directory.Build.props. */
const nearestFile = async (start: string, stop: string, name: string): Promise<string | undefined> => {
    let current = start;

    for (;;) {
        const candidate = join(current, name);

        if (await exists(candidate)) {
            return candidate;
        }

        const parent = dirname(current);

        if (current === stop || parent === current) {
            return undefined;
        }

        current = parent;
    }
};

const isWithin = (dir: string, parent: string): boolean => dir === parent || dir.startsWith(`${parent}${sep}`);

/** Every project file under `dir`, sorted, skipping build output, dependencies, dot-directories and claimed directories. */
const collectProjectFiles = async (dir: string, claimedDirs: ReadonlySet<string>): Promise<string[]> => {
    if ([...claimedDirs].some((claimed) => isWithin(dir, claimed))) {
        return [];
    }

    const found: string[] = [];

    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);

        if (entry.isDirectory()) {
            if (!SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".")) {
                found.push(...(await collectProjectFiles(path, claimedDirs)));
            }
        } else if (entry.isFile() && PROJECT_EXTENSIONS.has(extname(entry.name))) {
            found.push(path);
        }
    }

    return [...found].sort();
};

/**
 * The single literal `name` reaches in `raw`, or undefined. A repeated declaration in
 * one file is an error, since vis cannot tell which one MSBuild keeps.
 */
const singleValue = (raw: string, file: string, name: string): { line: number; value: string } | undefined => {
    const values = reading(() => readNuGetProperty(raw, file, name));

    if (values.length > 1) {
        throw invalid(file, `${file} sets ${name} ${values.length} times (lines ${values.map((v) => v.line).join(", ")}). vis cannot tell which one applies.`);
    }

    return values[0];
};

/**
 * Discover the NuGet projects under `cwd`. `options.claimedDirs` are directories a JS
 * package already releases; projects under them are skipped. Returns nothing when there
 * is no project file.
 */
export const discoverNuGetProjects = async (options: { claimedDirs: ReadonlySet<string>; cwd: string }): Promise<NuGetProject[]> => {
    const root = resolve(options.cwd);
    const projectFiles = await collectProjectFiles(root, options.claimedDirs);
    const released: { entry: NuGetProject; references: string[] }[] = [];

    for (const projectPath of projectFiles) {
        const raw = await readFile(projectPath, "utf8");
        const propsPath = await nearestFile(dirname(projectPath), root, "Directory.Build.props");
        const propsRaw = propsPath === undefined ? undefined : await readFile(propsPath, "utf8");
        const targetsPath = await nearestFile(dirname(projectPath), root, "Directory.Build.targets");
        const targetsRaw = targetsPath === undefined ? undefined : await readFile(targetsPath, "utf8");

        for (const [file, text] of [
            [projectPath, raw],
            [propsPath, propsRaw],
        ] as const) {
            if (file === undefined || text === undefined) {
                continue;
            }

            for (const refused of REFUSED_ELEMENTS) {
                if (hasElement(text, refused.name)) {
                    throw invalid(file, `${file} ${refused.message}. Remove it, or release this project with a shell publish.`);
                }
            }
        }

        if (targetsPath !== undefined && targetsRaw !== undefined && hasElement(targetsRaw, "Version")) {
            throw invalid(targetsPath, `${targetsPath} sets Version, which MSBuild applies after the project file. vis cannot follow that to a version; remove it, or release with a shell publish.`);
        }

        const packable = reading(() => singleValue(raw, projectPath, "IsPackable") ?? (propsRaw === undefined || propsPath === undefined ? undefined : singleValue(propsRaw, propsPath, "IsPackable")));

        if (packable?.value.toLowerCase() === "false") {
            continue;
        }

        // A test project is not a package. Its SDK sets IsTestProject, and its Test SDK reference is the convention for one.
        const isTest = singleValue(raw, projectPath, "IsTestProject")?.value.toLowerCase() === "true" || /<PackageReference\s+Include="Microsoft\.NET\.Test\.Sdk"/i.test(maskXmlComments(raw));

        if (isTest) {
            continue;
        }

        const ownVersion = singleValue(raw, projectPath, "Version");
        const propsVersion = propsRaw === undefined || propsPath === undefined ? undefined : singleValue(propsRaw, propsPath, "Version");

        // No version in the project or its props: an aggregate, with nothing to release.
        if (ownVersion === undefined && propsVersion === undefined) {
            continue;
        }

        const kind = ownVersion === undefined ? "inherited" : "literal";
        const owner = ownVersion === undefined ? (propsPath as string) : projectPath;
        const declared = (ownVersion ?? propsVersion) as { line: number; value: string };

        if (!VERSION_PATTERN.test(declared.value)) {
            throw invalid(owner, `${owner} sets Version to "${declared.value}". vis reads only a plain literal such as 1.2.0 or 1.2.0-beta.1, not an MSBuild expression.`);
        }

        const pick = (name: string): string | undefined => {
            const value = singleValue(raw, projectPath, name) ?? (propsRaw === undefined || propsPath === undefined ? undefined : singleValue(propsRaw, propsPath, name));

            if (value === undefined) {
                return undefined;
            }

            if (value.value === "" || value.value.includes("$(")) {
                throw invalid(projectPath, `${projectPath} sets ${name} to "${value.value}". vis reads only a plain literal for a package id.`);
            }

            return value.value;
        };

        const id = pick("PackageId") ?? pick("AssemblyName") ?? basename(projectPath, extname(projectPath));
        const name = id.toLowerCase();

        if (!isValidPackageName(name)) {
            throw invalid(projectPath, `${projectPath} names the package "${id}", which is not a valid package name (lowercase letters, digits, ".", "_" and "-").`, name);
        }

        const references = [...maskXmlComments(raw).matchAll(/<ProjectReference\s+Include="([^"]+)"/g)].map((match) => resolve(dirname(projectPath), (match[1] ?? "").replaceAll("\\", "/")));

        released.push({
            entry: {
                kind,
                line: declared.line,
                name,
                owner,
                package: {
                    dir: dirname(projectPath),
                    ecosystem: "nuget",
                    manifest: { dependencies: {}, name, private: false, version: declared.value },
                    manifestPath: projectPath,
                    name,
                    private: false,
                    version: declared.value,
                },
                projectPath,
            },
            references,
        });
    }

    const byName = new Map<string, string>();

    for (const { entry } of released) {
        const existing = byName.get(entry.name);

        if (existing !== undefined) {
            throw invalid(entry.projectPath, `${entry.name} is declared by both ${existing} and ${entry.projectPath}. NuGet ids compare case-insensitively, so they must be unique to release them.`, entry.name);
        }

        byName.set(entry.name, entry.projectPath);
    }

    // A ProjectReference to another released project orders the publish. It has no version to move, so it is "*".
    const nameByPath = new Map(released.map(({ entry }) => [entry.projectPath, entry.name]));

    return released.map(({ entry, references }) => {
        const dependencies: Record<string, string> = {};

        for (const reference of references) {
            const target = nameByPath.get(reference);

            if (target !== undefined && target !== entry.name) {
                dependencies[target] = "*";
            }
        }

        return { ...entry, package: { ...entry.package, manifest: { ...entry.package.manifest, dependencies } } };
    });
};
