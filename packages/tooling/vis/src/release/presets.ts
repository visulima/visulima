/**
 * Multi-language version-bump presets.
 *
 * vis is npm-first — it discovers packages from `package.json`,
 * publishes via npm, tags via git. But many monorepos pair JS packages
 * with Rust crates, Python distributions, or JVM modules, all of which
 * need their version strings updated in lockstep with the JS side.
 *
 * Rather than build separate adapters for each ecosystem (publishing
 * to crates.io / PyPI / Maven Central is genuinely "different
 * product" territory), these helpers wrap the existing `extra-files`
 * substitution engine with sensible defaults for each ecosystem's
 * manifest format.
 *
 * Usage (in `vis.config.ts`):
 *
 *   import { cargo, pyproject, gradleProperties, pomXml } from
 *       "@visulima/vis/release/presets";
 *
 *   export default {
 *       release: {
 *           packages: {
 *               "@scope/native": cargo({ crateDir: "crates/native" }),
 *               "@scope/sdk-py": pyproject({ projectDir: "py/sdk" }),
 *               "@scope/sdk-jvm": gradleProperties({ projectDir: "jvm/sdk" }),
 *           },
 *       },
 *   };
 *
 * Each helper returns a `PerPackageReleaseConfig` carrying one or
 * more `extraFiles` rules. The companion JS package (which still has
 * a real `package.json`) is what vis publishes; the rules keep the
 * non-JS manifest's version literal in sync.
 *
 * For genuinely-no-JS packages, pair these helpers with
 * `release.privatePackages.version: true` on a private `package.json`
 * stub that exists solely so vis discovers the package.
 */

import type { ExtraFileRule, PerPackageReleaseConfig } from "./types";

export interface CargoPresetOptions {
    /** Crate directory (containing Cargo.toml). Default: package root. */
    crateDir?: string;
    /** Additional extra-files rules merged with the Cargo.toml bump. */
    extraFiles?: ExtraFileRule[];
}

/**
 * Bump `version = "..."` in the `[package]` section of Cargo.toml AND
 * default `versionActions: "cargo"` so vis drives `cargo publish`
 * natively (TOML parse + crates.io API + OIDC trusted publishing).
 *
 * The `[dependencies]`, `[workspace.dependencies]` sections, etc.,
 * are deliberately not touched by the extra-files rule — those
 * reference SemVer ranges of other crates and need explicit operator
 * opt-in to mutate.
 *
 * Operators who want to override the publish behaviour (e.g. push to a
 * private registry via a wrapper script) can set
 * `versionActions: "shell"` and supply their own `publishCommand`
 * downstream — the preset is a default, not a hard wire.
 */
export const cargo = (options: CargoPresetOptions = {}): PerPackageReleaseConfig => {
    const path = options.crateDir ? `${options.crateDir}/Cargo.toml` : "Cargo.toml";

    return {
        // Wire the cargo versionActions reader at the same path the
        // extra-files bump targets — that way the natively-parsed
        // version always matches the one the bump just wrote.
        cargoTomlPath: path,
        extraFiles: [
            {
                flags: "m",
                path,
                replace: "$1{version}$3",
                // Match the version under [package] only — Cargo files
                // can carry many `version = "..."` lines (dev-deps,
                // workspace deps, build-deps). The `[package]`
                // anchor + non-greedy boundary on the value stops the
                // regex eating past the section.
                search: String.raw`^(version\s*=\s*")([^"]+)(")`,
            },
            ...(options.extraFiles ?? []),
        ],
        versionActions: "cargo",
    };
};

export interface PyprojectPresetOptions {
    /** Optional dynamic-version source line we should NOT touch (e.g. `__init__.py`). */
    extraFiles?: ExtraFileRule[];
    /** Project root (containing pyproject.toml). Default: package root. */
    projectDir?: string;

    /**
     * Relative path (from the package directory) to `uv.lock`. Recorded
     * on the per-package config so doctor can warn when the lockfile
     * is missing despite the operator configuring uv-aware tooling.
     *
     * vis does NOT mutate `uv.lock` itself — uv regenerates it on
     * `uv sync` / `uv build`. Operators who want the lockfile in the
     * release commit should run `uv lock` between `vis release version`
     * and the commit step (typically via `postVersionCommand`).
     *
     * release-please parity: #2561.
     */
    uvLockPath?: string;

    /**
     * Mark this package as a uv workspace member. `root` is the
     * relative path (from the package directory) to the workspace root
     * containing the `[tool.uv.workspace]` pyproject.toml — typically
     * `".."` or higher. When set, doctor verifies the root's
     * `[tool.uv.workspace] members` lists this package.
     *
     * release-please parity: #2560.
     */
    uvWorkspace?: { root: string };
}

/**
 * Bump `version = "..."` under `[project]` (PEP 621) AND default
 * `versionActions: "python"` so vis drives the publish step natively
 * (PyPI version detection via JSON API + `python -m build` / `uv build`
 * + `twine upload` / `uv publish` + OIDC trusted-publishing support).
 *
 * Modern packaging (poetry / hatch / pdm / setuptools-with-pyproject)
 * all read this field. Legacy `setup.py` projects can pair this with
 * an explicit `extra-files` rule against `setup.py`.
 *
 * Operators on a dynamic-version path (setuptools-scm / hatch-vcs /
 * poetry-dynamic-versioning) should override `versionActions: "shell"`
 * — `PythonVersionActions` refuses dynamic versioning to avoid running
 * arbitrary build-backend code just to read a literal version.
 */
export const pyproject = (options: PyprojectPresetOptions = {}): PerPackageReleaseConfig => {
    const path = options.projectDir ? `${options.projectDir}/pyproject.toml` : "pyproject.toml";

    return {
        extraFiles: [
            {
                flags: "m",
                path,
                replace: "$1{version}$3",
                search: String.raw`^(version\s*=\s*")([^"]+)(")`,
            },
            ...(options.extraFiles ?? []),
        ],
        // Mirror the cargo() preset: route the python versionActions
        // at the same project directory the extra-files bump targets.
        // Omitting `pythonProjectDir` defaults to the package root,
        // matching the `path` resolution above.
        ...(options.projectDir ? { pythonProjectDir: options.projectDir } : {}),
        // uv-managed lockfile + workspace flow (release-please #2560 /
        // #2561). The fields are passed through verbatim — the doctor
        // handler is the only place that consumes them. `uv.lock` is
        // NOT mutated by vis; the operator is responsible for
        // regenerating it with `uv lock` if they want it in the
        // release commit (see `postVersionCommand`).
        ...(options.uvLockPath ? { uvLockPath: options.uvLockPath } : {}),
        ...(options.uvWorkspace ? { uvWorkspace: options.uvWorkspace } : {}),
        versionActions: "python",
    };
};

export interface GradlePropertiesPresetOptions {
    extraFiles?: ExtraFileRule[];
    /** Path to gradle.properties. Default: package root. */
    projectDir?: string;
    /** Property name to bump. Default `"version"`. */
    property?: string;
}

/**
 * Bump a `version=...` line in `gradle.properties`. The default
 * property name matches the Gradle convention for the root project
 * version. Submodule versions typically live in `build.gradle` /
 * `build.gradle.kts` — use a custom extra-files rule for those.
 */
export const gradleProperties = (options: GradlePropertiesPresetOptions = {}): PerPackageReleaseConfig => {
    const path = options.projectDir ? `${options.projectDir}/gradle.properties` : "gradle.properties";
    const prop = options.property ?? "version";

    return {
        extraFiles: [
            {
                flags: "m",
                path,
                replace: `${prop}={version}`,
                search: String.raw`^${prop}\s*=.*$`,
            },
            ...(options.extraFiles ?? []),
        ],
    };
};

export interface PomXmlPresetOptions {
    extraFiles?: ExtraFileRule[];
    /** Path to the pom.xml. Default: package root. */
    pomDir?: string;
}

/**
 * Bump `&lt;version>...&lt;/version>` directly under `&lt;project>` in a Maven
 * `pom.xml`. ⚠ XML doesn't lend itself to surgical regex — this
 * preset matches the FIRST `&lt;version>...&lt;/version>` tag in the file,
 * which is the convention for the project version. If your pom has
 * `&lt;parent>&lt;version>` ahead of the project version, write an explicit
 * rule instead.
 *
 * Defaults `versionActions: "maven"` so vis can read the currently-
 * published version from Maven Central. Native publishing is not yet
 * implemented — Stage 3 ships the skeleton (read + already-published
 * detection); see `docs/guides/release-maven.mdx` for the shell-path
 * workaround (`mvn deploy`) until the Sonatype Central Portal client
 * lands.
 */
export const pomXml = (options: PomXmlPresetOptions = {}): PerPackageReleaseConfig => {
    const path = options.pomDir ? `${options.pomDir}/pom.xml` : "pom.xml";

    return {
        extraFiles: [
            {
                // No `g` flag — we want only the first match (project version).
                flags: "",
                path,
                replace: "$1{version}$3",
                search: "(<version>)([^<]+)(</version>)",
            },
            ...(options.extraFiles ?? []),
        ],
        versionActions: "maven",
    };
};

export interface ContainerPresetOptions {
    /**
     * Extra `--build-arg KEY=VALUE` pairs forwarded to buildx. Useful
     * for stamping the version literal into the image at build time.
     */
    buildArgs?: Record<string, string>;

    /**
     * Build context passed to `docker buildx build` (the final positional
     * argument). Defaults to the package directory.
     */
    buildContext?: string;
    extraFiles?: ExtraFileRule[];
    /** Fully-qualified image reference, e.g. `"ghcr.io/scope/foo"`. */
    image: string;

    /**
     * Target platforms for the multi-arch build. Defaults to
     * `["linux/amd64", "linux/arm64"]`.
     */
    platforms?: ReadonlyArray<string>;

    /**
     * Signing scheme to apply after a successful push. `"cosign"` runs
     * `cosign sign --yes &lt;image>:&lt;version>` post-push. Default: no signing.
     */
    signing?: "cosign";

    /**
     * Skip the conventional `:latest` tag. Useful for pre-release /
     * channel-specific images that shouldn't float `latest`.
     */
    skipLatest?: boolean;
}

/**
 * OCI container preset — wires the `container` versionActions plus a
 * package-specific `containerImage` declaration.
 *
 * Example:
 *
 *     release.packages["@scope/app-image"] = container({
 *         image: "ghcr.io/scope/app",
 *         platforms: ["linux/amd64", "linux/arm64"],
 *         signing: "cosign",
 *     });
 *
 * Pair with `releaseTagPattern: "{name}@{version}"` (the default) for
 * a parallel git tag, plus `docker login &lt;registry>` before running
 * `vis release publish`. The published image gets both `:&lt;version>`
 * (immutable pointer) and `:latest` (mutable, disable via
 * `skipLatest: true`).
 */
export const container = (options: ContainerPresetOptions): PerPackageReleaseConfig => {
    return {
        buildContext: options.buildContext,
        containerBuildArgs: options.buildArgs,
        containerImage: options.image,
        containerPlatforms: options.platforms,
        containerSigning: options.signing,
        containerSkipLatest: options.skipLatest,
        extraFiles: options.extraFiles ?? [],
        versionActions: "container",
    };
};

export interface JsrPresetOptions {
    /**
     * Convenience for adding `--allow-slow-types` to `jsr publish`. JSR
     * rejects packages whose exported API has types it can't statically infer
     * unless this flag is set. Default `false`.
     */
    allowSlowTypes?: boolean;

    /**
     * When `true`, also write the version literal into `deno.json` (in
     * addition to `jsr.json`). Useful for Deno-flavoured packages that
     * keep their full Deno config in `deno.json` and use `jsr.json` only
     * for the JSR manifest itself. Default `false`.
     *
     * When the package uses `deno.json` as its sole JSR manifest, pass
     * `manifestPath: "deno.json"` instead — that points the
     * versionActions reader and the extra-files rule at the same file.
     */
    deno?: boolean;
    extraFiles?: ExtraFileRule[];

    /**
     * Relative path to the JSR manifest. Default `"jsr.json"`. Pass
     * `"deno.json"` for Deno-flavoured packages that use it as the
     * primary JSR manifest.
     */
    manifestPath?: string;

    /**
     * Extra arguments forwarded verbatim to `jsr publish` (e.g.
     * `["--allow-slow-types"]`). `--allow-dirty` is always passed by vis and
     * need not be listed. Merged after the `allowSlowTypes` shorthand.
     */
    publishArgs?: string[];
}

/**
 * Bump `"version": "..."` in a JSR manifest (`jsr.json` or `deno.json`)
 * AND default `versionActions: "jsr"` so vis drives `npx jsr publish`
 * natively (jsr.io metadata lookup + OIDC trusted publishing + JSR's
 * scoped-name validation).
 *
 * JSR is Deno's package registry (jsr.io). Operators publish via
 * `npx jsr publish` after authoring `jsr.json` (or `deno.json` for
 * Deno-flavoured packages); the manifest uses PEP 621-style fields
 * (`name`, `version`, `exports`).
 *
 * The default rule matches the FIRST `"version": "..."` line in the
 * JSON file, which is the convention for the project version under
 * `name`. If your manifest has nested objects with their own
 * `"version"` keys, write a more specific rule.
 *
 * Operators who need to bump BOTH `jsr.json` AND `deno.json` (because
 * the package keeps a separate Deno config) can pass `deno: true` —
 * the preset emits an extra rule against `deno.json` alongside the
 * primary `jsr.json` bump.
 */
export const jsr = (options: JsrPresetOptions = {}): PerPackageReleaseConfig => {
    const manifestPath = options.manifestPath ?? "jsr.json";

    // Match `"version": "1.2.3"` — anchored on the property key so a
    // nested `"version"` literal in an object value isn't accidentally
    // rewritten. `m` flag so `^` anchors per-line, allowing the JSON
    // formatter's typical 2-space indent.
    const versionRule: ExtraFileRule = {
        flags: "m",
        path: manifestPath,
        replace: "$1{version}$3",
        search: String.raw`^(\s*"version"\s*:\s*")([^"]+)(")`,
    };

    const denoRule: ExtraFileRule | undefined = options.deno && manifestPath !== "deno.json"
        ? {
            flags: "m",
            path: "deno.json",
            replace: "$1{version}$3",
            search: String.raw`^(\s*"version"\s*:\s*")([^"]+)(")`,
        }
        : undefined;

    const jsrPublishArgs = [
        ...(options.allowSlowTypes ? ["--allow-slow-types"] : []),
        ...(options.publishArgs ?? []),
    ];

    return {
        extraFiles: [
            versionRule,
            ...(denoRule ? [denoRule] : []),
            ...(options.extraFiles ?? []),
        ],
        // Route the jsr versionActions reader at the same manifest the
        // extra-files bump targets so the natively-parsed version always
        // matches the literal we just wrote.
        jsrConfigPath: manifestPath,
        ...(jsrPublishArgs.length > 0 ? { jsrPublishArgs } : {}),
        versionActions: "jsr",
    };
};

export interface GoModPresetOptions {
    extraFiles?: ExtraFileRule[];
    /** Path to go.mod. Default: package root. */
    modDir?: string;
}

/**
 * Go doesn't carry a version in `go.mod` — versions are SemVer git
 * tags exclusively (`v1.2.3`). This preset is a no-op for the
 * manifest; pair it with `releaseTagPattern: "v{version}"` for proper
 * Go module compatibility. The helper still exists so the config
 * shape is symmetric with the other ecosystems.
 *
 * If you need to update a `pkg.Version` constant in `version.go`,
 * pass it via `extraFiles`.
 */
export const goMod = (options: GoModPresetOptions = {}): PerPackageReleaseConfig => {
    return {
        extraFiles: options.extraFiles ?? [],
    };
};
