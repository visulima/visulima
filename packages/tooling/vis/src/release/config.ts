/**
 * Typed config helper for the release subsystem.
 *
 * Used in `vis.config.ts` to populate the `release: {…}` block with full
 * type-safety. Identity function — exists purely for the type assertion.
 */

import type { CleanPackageJsonConfig, DependencyBumpRules, VisReleaseConfig } from "./types";

/**
 * Default value of `release.changesDir`. Exported as a constant so every
 * "fall back if not configured" site references one source of truth — keeps
 * the change-files location consistent across the orchestrator, the
 * change-file reader, the snapshot pipeline, and the init scaffolder.
 */
export const DEFAULT_CHANGES_DIR = ".vis/release";

/**
 * Default `baseBranch` used for `vis release status --from`, channel
 * detection fallback, and `release.baseBranch` resolution. Pulled into a
 * constant for the same reason as DEFAULT_CHANGES_DIR.
 */
export const DEFAULT_BASE_BRANCH = "main";

/**
 * Identity function for type-narrowing a `VisReleaseConfig` defined in
 * a separate file (e.g. `release.config.ts`). Use vis's top-level
 * `defineConfig` from `@visulima/vis/config` when defining the whole
 * `vis.config.ts` instead.
 */
export const defineReleaseConfig = (config: VisReleaseConfig): VisReleaseConfig => config;

// ── Default values ──────────────────────────────────────────────────

/**
 * Built-in defaults. Used by the loader when a key is not set by the user
 * and must be in the resolved config.
 */
export const DEFAULT_CONFIG: Required<Pick<VisReleaseConfig, | "baseBranch"
    | "changesDir"
    | "access"
    | "changelog"
    | "changedFilePatterns"
    | "updateInternalDependencies"
    | "fixed"
    | "linked"
    | "ignore"
    | "include"
    | "privatePackages"
    | "aggregateRelease"
    | "defaultManaged"
    | "allowCustomCommands"
    | "preVersionCommand"
    | "postVersionCommand"
    | "prePublishCommand"
    | "postPublishCommand">> = {
    access: "public",
    aggregateRelease: false,
    allowCustomCommands: false,
    baseBranch: DEFAULT_BASE_BRANCH,
    changedFilePatterns: ["**"],
    changelog: "default",
    changesDir: DEFAULT_CHANGES_DIR,
    defaultManaged: false,
    fixed: [],
    ignore: [],
    include: [],
    linked: [],
    postPublishCommand: "",
    postVersionCommand: "",
    prePublishCommand: "",
    preVersionCommand: "",
    privatePackages: { tag: false, version: false },
    updateInternalDependencies: "out-of-range",
};

export const DEFAULT_DEPENDENCY_BUMP_RULES: Required<DependencyBumpRules> = {
    dependencies: { bumpAs: "patch", trigger: "patch" },
    devDependencies: false,
    optionalDependencies: { bumpAs: "patch", trigger: "minor" },
    peerDependencies: { bumpAs: "match", trigger: "major" },
};

/**
 * Default fields stripped from `package.json` on publish (RFC §20.4).
 * Match `@anolilab/semantic-release-clean-package-json` behaviour.
 */
export const DEFAULT_CLEAN_STRIP: ReadonlyArray<string> = [
    "scripts",
    "devDependencies",
    "private",
    "workspaces",
    // tool config blocks
    "vis-release",
    "bumpy",
    "release",
    "nx",
    "lint-staged",
    "husky",
    "commitlint",
    "eslint",
    "prettier",
    "vitest",
    "tsup",
    "packem",
    "tsdown",
    "@visulima/packem",
    "pnpm",
] as const;

/**
 * Default fields preserved on publish — informational, used only by `--dry-run` rendering.
 * The actual publish step strips by deny-list (`DEFAULT_CLEAN_STRIP`), not by allow-list.
 */
export const DEFAULT_CLEAN_KEEP: ReadonlyArray<string> = [
    "name",
    "version",
    "description",
    "keywords",
    "homepage",
    "bugs",
    "repository",
    "funding",
    "author",
    "contributors",
    "license",
    "dependencies",
    "peerDependencies",
    "peerDependenciesMeta",
    "optionalDependencies",
    "engines",
    "os",
    "cpu",
    "type",
    "sideEffects",
    "main",
    "module",
    "types",
    "typings",
    "exports",
    "imports",
    "bin",
    "files",
    "publishConfig",
    "napi",
] as const;

/**
 * Resolve user-supplied `cleanPackageJson` to a concrete strip list.
 * `false` → empty (don't strip anything).
 * `true` / undefined → defaults.
 * Object form → defaults + extra strip, minus anything in `keep`.
 */
export const resolveCleanStripList = (cfg: boolean | CleanPackageJsonConfig | undefined): string[] => {
    if (cfg === false) {
        return [];
    }

    if (cfg === undefined || cfg === true) {
        return [...DEFAULT_CLEAN_STRIP];
    }

    const set = new Set<string>([...DEFAULT_CLEAN_STRIP, ...(cfg.strip ?? [])]);

    for (const k of cfg.keep ?? []) {
        set.delete(k);
    }

    return [...set];
};
