/**
 * Release-side ecosystem table.
 *
 * One entry per non-JS ecosystem the release orchestrator understands. `buildContext` walks
 * `RELEASE_ECOSYSTEMS` in discovery order; `applyContext` walks `RELEASE_PLAN_ORDER` for the
 * planners. The two orders differ on purpose: `go` plans before `gradle`, but `gradle` is
 * discovered first, so the list of entries must not be reused for planning.
 *
 * Discovery is sequential. Each entry's claim set reads the packages and per-package config
 * that earlier entries have already added, so the entries must not run concurrently.
 */

import { dirname, resolve, sep } from "node:path";

import type { PerPackageReleaseConfig, VisReleaseConfig, WorkspacePackage } from "../types";
import { cargoManifestPaths } from "./cargo-lock";
import type { ComposerProject } from "./composer-projects";
import type { DartProject } from "./dart-projects";
import type { DependencyGraph } from "./dep-graph";
import type { GemProject } from "./gem-projects";
import type { GoProject } from "./go-projects";
import type { GradleProject } from "./gradle-projects";
import type { HexProject } from "./hex-projects";
import type { MavenProject } from "./maven-projects";
import type { NuGetProject } from "./nuget-projects";
import type { SwiftProject } from "./swift-projects";
import type { ZigProject } from "./zig-projects";

/**
 * True when `path` is a `version.rb` under a `lib/` tree: `lib/` starts the path or
 * follows a `/`, and at least one character sits between it and `/version.rb`.
 * Linear in the path length. The regex it replaces, `(?:^|\/)lib\/.+\/version\.rb$`,
 * backtracks polynomially on long runs of `/lib/`.
 */
export const isGemVersionRbPath = (path: string): boolean => {
    const suffix = "/version.rb";

    if (!path.endsWith(suffix)) {
        return false;
    }

    const end = path.length - suffix.length;
    let libStart: number;

    if (path.startsWith("lib/")) {
        libStart = 0;
    } else {
        const found = path.indexOf("/lib/");

        if (found === -1) {
            return false;
        }

        libStart = found + 1;
    }

    // The earliest `lib/` leaves the longest middle part, so checking it is enough.
    // `.` in the original regex does not match line terminators, so exclude those too.
    const middle = path.slice(libStart + "lib/".length, end);

    return middle.length > 0 && !/[\n\r\u2028\u2029]/.test(middle);
};

/** The `release` block keys that carry a `discover` flag. */
export type DiscoverConfigKey = "cargo" | "composer" | "dart" | "gem" | "go" | "gradle" | "hex" | "maven" | "nuget" | "python" | "swift" | "zig";

/** The release-plan subset a planner reads. Structurally satisfied by `OrchestratorContext`. */
export interface PlanContext {
    cwd: string;
    depGraph: DependencyGraph;
    packages: ReadonlyArray<WorkspacePackage>;
    perPackageConfig: ReadonlyMap<string, PerPackageReleaseConfig>;
}

export interface ReleaseRef {
    name: string;
    newVersion: string;
}

export interface PlanInput<P> {
    context: PlanContext;
    pending: Map<string, string>;
    projects: ReadonlyArray<P>;
    releases: ReadonlyArray<ReleaseRef>;
}

export interface PlanOutcome {
    touched: Iterable<string>;
    warnings: ReadonlyArray<string>;
}

export interface EcosystemSpec<P> {
    /** Directories a JS package already owns. Discovery skips them. */
    claimedDirs: (pkg: WorkspacePackage, perPkg: PerPackageReleaseConfig, cwd: string) => string[];
    /** The `release` block whose `discover` flag switches this ecosystem on. */
    configKey: DiscoverConfigKey;
    discover: (options: { claimedDirs: ReadonlySet<string>; cwd: string }) => Promise<P[]>;
    /** The package `ecosystem` value, and the `versionActions` id when `perPackage` is not given. */
    id: string;
    /** Config set for the package, before the user's `config.packages[name]` is spread over it. Default: `{ managed, versionActions: id }`. */
    perPackage?: (project: P, cwd: string) => PerPackageReleaseConfig;
    plan?: (input: PlanInput<P>) => Promise<PlanOutcome>;
    toPackage: (project: P) => WorkspacePackage;
}

/** An entry with its project type erased, so the table can hold every ecosystem at once. */
export type ReleaseEcosystem = EcosystemSpec<unknown>;

// The table holds every ecosystem at once, so each entry's project type is erased here. Each entry's functions only ever receive
// the projects their own `discover` returned, so the erased type never reaches code that assumes a different one.
const defineEcosystem = <P>(spec: EcosystemSpec<P>): ReleaseEcosystem => spec as unknown as ReleaseEcosystem;

/**
 * A JS package that releases this ecosystem (`versionActions: id`) claims its directory. When
 * `extraFile` is given, a file the package writes that matches it claims that file's directory too.
 */
const claimVersionAction
    = (id: string, extraFile?: RegExp) =>
        (pkg: WorkspacePackage, perPkg: PerPackageReleaseConfig): string[] => [
            ...(perPkg.versionActions === id ? [resolve(pkg.dir)] : []),
            ...(extraFile === undefined
                ? []
                : (perPkg.extraFiles ?? []).filter((rule) => extraFile.test(rule.path)).map((rule) => dirname(resolve(pkg.dir, rule.path)))),
        ];

/** `managed` plus `versionActions`, the default shape for most ecosystems. */
const defaultPerPackage = (id: string): PerPackageReleaseConfig => {
    return { managed: true, versionActions: id };
};

/** Discovered projects are named after their package. The cargo and python rules are the same except for the id. */
const versionActionUnlessPrivate = (id: string) => (project: WorkspacePackage): PerPackageReleaseConfig => {
    return {
        managed: true,
        ...(project.private ? {} : { versionActions: id }),
    };
};

/** Planners that take `releases` and `projects` and return the touched paths. Runs only when a release is planned. */
const planReleased
    = <P>(run: (input: PlanInput<P>) => Promise<Iterable<string>>) =>
        async (input: PlanInput<P>): Promise<PlanOutcome> => { return { touched: await run(input), warnings: [] }; };

const cargo = defineEcosystem<WorkspacePackage>({
    claimedDirs: (pkg, perPkg) => cargoManifestPaths(pkg.dir, perPkg).map((manifestPath) => dirname(manifestPath)),
    configKey: "cargo",
    discover: async (options) => {
        const { discoverCargoCrates } = await import("./cargo-crates");

        return discoverCargoCrates(options);
    },
    // `publish = false` keeps the private actions. Forcing `cargo` there would run `cargo publish` for a crate that must never be published.
    id: "cargo",
    perPackage: versionActionUnlessPrivate("cargo"),
    toPackage: (crate) => crate,
});

const python = defineEcosystem<WorkspacePackage>({
    // A JS package that releases a Python project (versionActions "python", or pythonProjectDir) claims that project's directory.
    claimedDirs: (pkg, perPkg) => (perPkg.versionActions === "python" || perPkg.pythonProjectDir !== undefined ? [resolve(pkg.dir, perPkg.pythonProjectDir ?? ".")] : []),
    configKey: "python",
    discover: async (options) => {
        const { discoverPythonProjects } = await import("./python-projects");

        return discoverPythonProjects(options);
    },
    id: "python",
    perPackage: versionActionUnlessPrivate("python"),
    plan: async ({ context, pending, releases }) => {
        const { planPythonWorkspace } = await import("./python-plan");
        const pythonReleases = releases.flatMap((release) => {
            const pkg = context.depGraph.getPackage(release.name);

            return pkg ? [{ manifestPath: pkg.manifestPath, name: release.name, newVersion: release.newVersion }] : [];
        });
        const result = await planPythonWorkspace({
            cwd: context.cwd,
            dependents: context.packages
                .filter((pkg) => pkg.ecosystem === "python")
                .map((pkg) => {
                    return { dependencies: pkg.manifest.dependencies ?? {}, name: pkg.name };
                }),
            pending,
            releases: pythonReleases,
        });

        return { touched: result.touched, warnings: result.warnings };
    },
    toPackage: (project) => project,
});

const maven = defineEcosystem<MavenProject>({
    // A module a JS package releases through its pom (`versionActions: "maven"`, `pomPath`, or an `extraFiles` rule on a pom.xml)
    // is that package's, not ours. Its own children are still discovered.
    claimedDirs: (pkg, perPkg) => {
        const pomPaths = [
            ...(perPkg.versionActions === "maven" || perPkg.pomPath !== undefined ? [perPkg.pomPath ?? "pom.xml"] : []),
            ...(perPkg.extraFiles ?? []).map((rule) => rule.path).filter((path) => /(?:^|\/)pom\.xml$/.test(path)),
        ];

        return pomPaths.map((pomPath) => dirname(resolve(pkg.dir, pomPath)));
    },
    configKey: "maven",
    discover: async (options) => {
        const { discoverMavenProjects } = await import("./maven-projects");

        return discoverMavenProjects(options);
    },
    id: "maven",
    plan: planReleased(async ({ pending, projects, releases }) => {
        const { planMavenWorkspace } = await import("./maven-plan");

        return planMavenWorkspace({ pending, projects, releases });
    }),
    toPackage: (project) => project.package,
});

const gradle = defineEcosystem<GradleProject>({
    claimedDirs: claimVersionAction("gradle", /(?:^|\/)(?:build\.gradle(?:\.kts)?|gradle\.properties)$/),
    configKey: "gradle",
    discover: async (options) => {
        const { discoverGradleProjects } = await import("./gradle-projects");

        return discoverGradleProjects(options);
    },
    id: "gradle",
    plan: planReleased(async ({ pending, projects, releases }) => {
        const { planGradleWorkspace } = await import("./gradle-plan");

        return planGradleWorkspace({ pending, projects, releases });
    }),
    toPackage: (project) => project.package,
});

const composer = defineEcosystem<ComposerProject>({
    claimedDirs: claimVersionAction("composer", /(?:^|\/)composer\.json$/),
    configKey: "composer",
    discover: async (options) => {
        const { discoverComposerProjects } = await import("./composer-projects");

        return discoverComposerProjects(options);
    },
    id: "composer",
    perPackage: (project) => project.perPackage,
    toPackage: (project) => project.package,
});

const go = defineEcosystem<GoProject>({
    claimedDirs: claimVersionAction("go", /(?:^|\/)go\.mod$/),
    configKey: "go",
    discover: async (options) => {
        const { discoverGoProjects } = await import("./go-projects");

        return discoverGoProjects(options);
    },
    id: "go",
    perPackage: (project) => project.perPackage,
    toPackage: (project) => project.package,
});

const swiftManifestClaim = claimVersionAction("swift", /(?:^|\/)Package\.swift$/);

const swift = defineEcosystem<SwiftProject>({
    // A JS package (and everything under it) belongs to that package, except the workspace root.
    // `Package.swift` claims come on top, so `versionActions: "swift"` and `extraFiles` are honoured.
    claimedDirs: (pkg, perPkg, cwd) => [
        ...(pkg.ecosystem === undefined && resolve(pkg.dir) !== resolve(cwd) ? [resolve(pkg.dir)] : []),
        ...swiftManifestClaim(pkg, perPkg),
    ],
    configKey: "swift",
    discover: async (options) => {
        const { discoverSwiftProjects } = await import("./swift-projects");

        return discoverSwiftProjects(options);
    },
    id: "swift",
    // SwiftPM resolves a package from the manifest at the root of its repository, and reads its version from a bare
    // semantic-version tag. Only the root package can use that tag; a nested one keeps the workspace tag pattern.
    perPackage: (project, cwd) => {
        return {
            currentVersionResolver: "git-tag",
            managed: true,
            versionActions: "swift",
            ...(resolve(project.package.dir) === resolve(cwd) ? { releaseTagPattern: "{version}" } : {}),
        };
    },
    toPackage: (project) => project.package,
});

const gem = defineEcosystem<GemProject>({
    // A JS package that releases a gem (versionActions "gem") or writes its gemspec (an extraFiles rule) claims its directory.
    claimedDirs: (pkg, perPkg) => {
        const dirs = perPkg.versionActions === "gem" ? [resolve(pkg.dir)] : [];

        for (const rule of perPkg.extraFiles ?? []) {
            const target = resolve(pkg.dir, rule.path);

            if (/\.gemspec$/.test(rule.path)) {
                dirs.push(dirname(target));
            } else if (isGemVersionRbPath(rule.path)) {
                // The gem's directory is the one above its lib/ tree.
                const libIndex = target.lastIndexOf(`${sep}lib${sep}`);

                if (libIndex !== -1) {
                    dirs.push(target.slice(0, libIndex));
                }
            }
        }

        return dirs;
    },
    configKey: "gem",
    discover: async (options) => {
        const { discoverGemProjects } = await import("./gem-projects");

        return discoverGemProjects(options);
    },
    id: "gem",
    plan: planReleased(async ({ pending, projects, releases }) => {
        const { planGemWorkspace } = await import("./gem-plan");

        return planGemWorkspace({ pending, projects, releases });
    }),
    toPackage: (project) => project.package,
});

const hex = defineEcosystem<HexProject>({
    claimedDirs: claimVersionAction("hex", /(?:^|\/)mix\.exs$/),
    configKey: "hex",
    discover: async (options) => {
        const { discoverHexProjects } = await import("./hex-projects");

        return discoverHexProjects(options);
    },
    id: "hex",
    plan: planReleased(async ({ pending, projects, releases }) => {
        const { planHexWorkspace } = await import("./hex-plan");

        return planHexWorkspace({ pending, projects, releases });
    }),
    toPackage: (project) => project.package,
});

const nuget = defineEcosystem<NuGetProject>({
    claimedDirs: claimVersionAction("nuget", /\.(?:cs|fs)proj$|(?:^|\/)Directory\.Build\.props$/),
    configKey: "nuget",
    discover: async (options) => {
        const { discoverNuGetProjects } = await import("./nuget-projects");

        return discoverNuGetProjects(options);
    },
    id: "nuget",
    plan: planReleased(async ({ pending, projects, releases }) => {
        const { planNuGetWorkspace } = await import("./nuget-plan");

        return planNuGetWorkspace({ pending, projects, releases });
    }),
    toPackage: (project) => project.package,
});

const zig = defineEcosystem<ZigProject>({
    claimedDirs: claimVersionAction("zig", /(?:^|\/)build\.zig\.zon$/),
    configKey: "zig",
    discover: async (options) => {
        const { discoverZigProjects } = await import("./zig-projects");

        return discoverZigProjects(options);
    },
    id: "zig",
    plan: planReleased(async ({ pending, projects, releases }) => {
        const { planZigWorkspace } = await import("./zig-plan");

        return planZigWorkspace({ pending, projects, releases });
    }),
    toPackage: (project) => project.package,
});

const dart = defineEcosystem<DartProject>({
    claimedDirs: claimVersionAction("dart", /(?:^|\/)pubspec\.yaml$/),
    configKey: "dart",
    discover: async (options) => {
        const { discoverDartProjects } = await import("./dart-projects");

        return discoverDartProjects(options);
    },
    id: "dart",
    plan: planReleased(async ({ pending, projects, releases }) => {
        const { planDartWorkspace } = await import("./dart-plan");

        return planDartWorkspace({ pending, projects, releases });
    }),
    toPackage: (project) => project.package,
});

/** Discovery order. Claims and collision errors depend on it, so do not reorder. */
export const RELEASE_ECOSYSTEMS: ReadonlyArray<ReleaseEcosystem> = [cargo, python, maven, gradle, composer, go, swift, gem, hex, nuget, zig, dart];

/**
 * Plan order for the planners that `applyContext` runs after the cargo pass. It sets the order
 * of `touched` insertions and which planner throws first, so it is not the discovery order.
 */
export const RELEASE_PLAN_ORDER: ReadonlyArray<ReleaseEcosystem> = [python, maven, go, gradle, gem, hex, nuget, zig, dart];

/** Per-package config for a discovered project: the entry's own, or the default shape. */
export const ecosystemPerPackage = (eco: ReleaseEcosystem, project: unknown, cwd: string): PerPackageReleaseConfig =>
    (eco.perPackage ? eco.perPackage(project, cwd) : defaultPerPackage(eco.id));

/** The `release` block flag that enables an entry. */
export const isDiscoveryEnabled = (config: VisReleaseConfig, eco: ReleaseEcosystem): boolean => Boolean(config[eco.configKey]?.discover);
