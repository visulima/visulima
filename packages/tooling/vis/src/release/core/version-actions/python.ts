/**
 * First-class `python` versionActions — PyPI / TestPyPI publishing
 * for Python distributions wired into a vis-managed monorepo.
 *
 * Why a typed plugin instead of the `shell` path?
 *
 * The `shell` adapter (versionActions: "shell") works, but every
 * Python repo has to re-implement the same boilerplate: parse
 * `pyproject.toml`, detect the build backend (hatch / poetry / pdm /
 * setuptools / uv), choose between `python -m build` and `uv build`,
 * pick `twine upload` vs `uv publish`, verify auth, swallow PyPI's
 * 404-on-fresh-package semantics on the version-check. This plugin
 * does all of that natively and reduces the per-package config to
 *
 *     ...pyproject({ projectDir: "py/sdk" }),  // already implied
 *
 * Capabilities:
 *
 * 1. Reads current version from `pyproject.toml` natively (PEP 621
 *    `[project] version`). When `dynamic = ["version"]` is declared we
 *    refuse with a CONFIG_INVALID hint pointing to the shell path —
 *    dynamic versioning (poetry-dynamic-versioning / setuptools-scm /
 *    hatch-vcs) gets its value from a separate plugin chain we can't
 *    inspect statically, and we don't want to run arbitrary build
 *    backend code just to read a version.
 *
 * 2. Detects already-published version via PyPI's JSON API
 *    (`GET https://pypi.org/pypi/&lt;name>/json` → `.info.version`).
 *    Network failure → undefined (treat as "publish anyway" — the
 *    upload step will reject duplicates itself). 404 → undefined
 *    (package doesn't exist on PyPI yet, first publish).
 *
 * 3. Build backend detection from `[build-system] build-backend`:
 *      - `hatchling.build`                → `python -m build` (PEP 517)
 *      - `poetry.core.masonry.api`        → `python -m build`
 *      - `pdm.backend` / `pdm-backend`    → `python -m build`
 *      - `setuptools.build_meta`          → `python -m build`
 *      - `uv_build`                       → `uv build`
 *      - missing / unknown + `uv` on PATH → `uv build`
 *      - default fallback                 → `python -m build`
 *
 *    For publish: `uv publish` when uv is detected, else
 *    `twine upload dist/*`.
 *
 * 4. Auth modes (M-3 — aligned with cargo.ts):
 *      - OIDC trusted publishing — preferred whenever GitHub's
 *        `ACTIONS_ID_TOKEN_REQUEST_URL` env is present (since 2023,
 *        PyPI's recommended path). We do NOT do the OIDC↔PyPI token
 *        exchange ourselves — the official
 *        `pypa/gh-action-pypi-publish` action handles that. We only
 *        verify the env is present so we can let `twine` / `uv
 *        publish` find the credentials. OIDC wins over a leftover
 *        `TWINE_PASSWORD` because an operator who configured trusted
 *        publishing wants OIDC; falling back to a stale token would
 *        silently swap auth modes.
 *      - Static token — `TWINE_PASSWORD` (with `TWINE_USERNAME=__token__`
 *        injected if absent). Used when OIDC env is absent, or when
 *        the operator opts back in via
 *        `release.publish.preferStaticToken: true` in vis.config.ts.
 *      - Neither → AUTH_MISSING.
 *
 * Out of scope (use `versionActions: "shell"` instead):
 *   - Dynamic versioning (setuptools-scm, hatch-vcs, poetry-dynamic-
 *     versioning) — vis can't compute the version without running the
 *     build backend, and we don't want to.
 *   - Custom repositories (non-PyPI). The `repository` field of
 *     pyproject.toml is read, but only PyPI's JSON API shape is
 *     supported for published-version detection.
 *   - Multi-target wheels (manylinux / abi3). The plugin invokes the
 *     configured build backend, so cibuildwheel / maturin users
 *     should let their existing CI step do the build and configure
 *     `buildCommand` to short-circuit ours.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, VisReleaseConfig, WorkspacePackage } from "../../types";
import type { CommandRunner, PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

/** PyPI JSON-API endpoint pattern. The token is the project's *distribution* name (lowercased). */
const PYPI_PROJECT_URL = (name: string): string => `https://pypi.org/pypi/${encodeURIComponent(name.toLowerCase())}/json`;

/** Shape of pyproject.toml fields we care about. */
interface PyProjectTomlShape {
    "build-system"?: {
        "build-backend"?: string;
        requires?: string[];
    };
    project?: {
        dynamic?: string[];
        name?: string;
        version?: string;
    };
    tool?: {
        [other: string]: unknown;
        uv?: {
            workspace?: {
                /**
                 * `members` is a list of workspace-member globs. uv
                 * resolves these relative to the file containing the
                 * `[tool.uv.workspace]` block, so vis treats the entries
                 * as glob patterns when comparing against the
                 * project-directory relative path.
                 */
                members?: string[];
            };
        };
    };
}

/**
 * Resolve the absolute path to `uv.lock` for a given workspace package.
 * Honours the operator's `uvLockPath` override (e.g. when the lock
 * lives at the workspace root rather than the package directory) and
 * falls back to `&lt;pkg.dir>/uv.lock`.
 *
 * Exposed for the doctor + tests; the publish path doesn't touch the
 * lockfile (uv manages it) so this helper isn't called from
 * `PythonVersionActions.publish`.
 */
export const resolveUvLockPath = (
    pkg: WorkspacePackage,
    perPkg?: PerPackageReleaseConfig,
): string => {
    if (perPkg?.uvLockPath) {
        return join(pkg.dir, perPkg.uvLockPath);
    }

    return join(pkg.dir, "uv.lock");
};

/**
 * Return whether the package's project directory is listed in the uv
 * workspace root's `[tool.uv.workspace] members` block.
 *
 * `rootDir` is the absolute path to the directory containing the
 * workspace-root pyproject.toml. `memberRelativePath` is the project
 * directory relative to that root.
 *
 * uv's `members` glob entries are matched against this relative path.
 * We support literal entries (`"py/sdk"`) and the two glob forms uv
 * itself documents (`"py/*"` non-recursive, `"py/**"` recursive). We
 * don't pull in a full glob library — that's overkill for what is, in
 * practice, a 1-3 line table in `pyproject.toml`. Returns:
 *
 *   - `"member"`   — the project IS a workspace member.
 *   - `"missing"`  — the root has `[tool.uv.workspace] members` but the
 *                    project's path doesn't match any entry.
 *   - `"no-workspace"` — the root pyproject has no
 *                        `[tool.uv.workspace]` block at all.
 *   - `"no-root-pyproject"` — `&lt;rootDir>/pyproject.toml` doesn't exist.
 */
export const checkUvWorkspaceMembership = async (
    rootDir: string,
    memberRelativePath: string,
): Promise<"member" | "missing" | "no-root-pyproject" | "no-workspace"> => {
    let rootShape: PyProjectTomlShape | undefined;

    try {
        rootShape = await readPyProject(rootDir);
    } catch {
        return "no-root-pyproject";
    }

    if (rootShape === undefined) {
        return "no-root-pyproject";
    }

    const members = rootShape.tool?.uv?.workspace?.members;

    if (!Array.isArray(members) || members.length === 0) {
        return "no-workspace";
    }

    const normalized = memberRelativePath.replace(/^\.\//, "").replaceAll("\\", "/");

    for (const entry of members) {
        if (typeof entry !== "string") {
            continue;
        }

        const candidate = entry.replace(/^\.\//, "").replaceAll("\\", "/");

        if (candidate === normalized) {
            return "member";
        }

        // Bare glob support — `py/*` matches `py/sdk` but not `py/sdk/sub`.
        if (candidate.endsWith("/*")) {
            const prefix = candidate.slice(0, -2);

            if (normalized.startsWith(`${prefix}/`) && !normalized.slice(prefix.length + 1).includes("/")) {
                return "member";
            }
        }

        // `py/**` recursive — matches `py/sdk` and `py/sdk/sub`.
        if (candidate.endsWith("/**")) {
            const prefix = candidate.slice(0, -3);

            if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
                return "member";
            }
        }
    }

    return "missing";
};

export type PythonBuildBackend = "hatch" | "poetry" | "pdm" | "setuptools" | "uv" | "unknown";

interface ResolvedBuildEnv {
    backend: PythonBuildBackend;
    buildCommand: { args: string[]; binary: string };
    /** Whether the `uv` binary is detected on PATH. */
    hasUv: boolean;
    publishCommand: { args: string[]; binary: string };
}

/**
 * Read pyproject.toml at `&lt;projectDir>/pyproject.toml` and parse via
 * `smol-toml` (the same parser `@visulima/fs/toml` wraps; using it
 * directly keeps the test surface narrow — no fs/toml stubbing needed).
 *
 * Returns `undefined` when the file doesn't exist (ENOENT); throws
 * `BUMP_FILE_INVALID` when the file exists but is malformed.
 */
const readPyProject = async (projectDir: string): Promise<PyProjectTomlShape | undefined> => {
    const path = join(projectDir, "pyproject.toml");

    let raw: string;

    try {
        raw = await readFile(path, "utf8");
    } catch (error) {
        const { code } = (error as NodeJS.ErrnoException);

        if (code === "ENOENT") {
            return undefined;
        }

        throw new VisReleaseError({
            cause: error,
            code: "BUMP_FILE_INVALID",
            file: path,
            message: `Failed to read ${path}: ${(error as Error).message}`,
        });
    }

    const { parse } = await import("smol-toml");

    try {
        return parse(raw);
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "BUMP_FILE_INVALID",
            file: path,
            message: `Failed to parse ${path}: ${(error as Error).message}`,
        });
    }
};

/**
 * Detect whether `uv` is on PATH by attempting `uv --version`.
 *
 * We intentionally tolerate a missing binary (exit code != 0 or thrown
 * error from the runner) — those collapse to `false`. This lets a
 * repo opt in to uv simply by installing it on the runner; no config
 * needed.
 */
const detectUv = async (runner: CommandRunner, cwd: string): Promise<boolean> => {
    try {
        const result = await runner.run("uv", ["--version"], { cwd, silent: true });

        return result.exitCode === 0;
    } catch {
        return false;
    }
};

/**
 * Map a `[build-system] build-backend` string to one of our supported
 * backends. Falls back to `"unknown"` when nothing matches.
 */
const detectBackend = (toml: PyProjectTomlShape | undefined): PythonBuildBackend => {
    const backendId = toml?.["build-system"]?.["build-backend"];

    if (!backendId) {
        return "unknown";
    }

    // Each comparison is a startsWith so that future minor namespaces
    // (`pdm.backend.something`) still resolve correctly. The list of
    // supported backends is small enough that a chained-if is cleaner
    // than a regex table.
    if (backendId.startsWith("hatchling")) {
        return "hatch";
    }

    if (backendId.startsWith("poetry.core") || backendId.startsWith("poetry_core")) {
        return "poetry";
    }

    if (backendId.startsWith("pdm.backend") || backendId.startsWith("pdm_backend")) {
        return "pdm";
    }

    if (backendId.startsWith("setuptools")) {
        return "setuptools";
    }

    if (backendId.startsWith("uv_build") || backendId.startsWith("uv.build")) {
        return "uv";
    }

    return "unknown";
};

/**
 * Resolve which build + publish CLIs to invoke given a parsed
 * pyproject.toml and whether `uv` is on PATH.
 *
 * Decision matrix:
 *   - Backend is "uv" OR (backend is "unknown" AND uv on PATH) → uv
 *   - Otherwise build via `python -m build` (PEP 517 universal)
 *   - Publish via `uv publish` when uv is preferred, else `twine upload dist/*`
 */
const resolveBuildEnv = (backend: PythonBuildBackend, hasUv: boolean): ResolvedBuildEnv => {
    const preferUv = backend === "uv" || (backend === "unknown" && hasUv);

    if (preferUv) {
        return {
            backend,
            buildCommand: { args: ["build"], binary: "uv" },
            hasUv,
            publishCommand: { args: ["publish"], binary: "uv" },
        };
    }

    return {
        backend,
        // `python -m build` works for hatch / poetry / pdm / setuptools.
        // We standardise on it instead of `poetry build` / `pdm build`
        // because the PEP 517 path uses the configured backend directly
        // and produces identical artifacts — fewer moving parts.
        buildCommand: { args: ["-m", "build"], binary: "python" },
        hasUv,
        // `twine upload dist/*` — the trailing glob is expanded by twine
        // (it accepts both files and directories). We pass it literally;
        // when there are no artifacts to upload twine exits with a clear
        // "Cannot find file" error which is the right failure mode.
        publishCommand: { args: ["upload", "dist/*"], binary: "twine" },
    };
};

/**
 * Detect auth mode without ever performing the OIDC token exchange
 * ourselves. PyPI's trusted publishing is owned by
 * `pypa/gh-action-pypi-publish` (or the equivalent uv flow); we only
 * verify a credential path *exists* before invoking the publish CLI
 * so failures surface as `AUTH_MISSING` early rather than as a
 * confusing "403 Forbidden" mid-upload.
 *
 * Precedence (M-3):
 *   - `ACTIONS_ID_TOKEN_REQUEST_URL` → "oidc", unless
 *     `release.publish.preferStaticToken: true` AND `TWINE_PASSWORD`
 *     is also set (escape hatch for operators migrating between
 *     auth modes).
 *   - `TWINE_PASSWORD` → "token" (used when OIDC is absent).
 *   - Neither → "missing".
 */
const detectAuthMode = (
    env: NodeJS.ProcessEnv,
    workspaceConfig?: VisReleaseConfig,
): "oidc" | "token" | "missing" => {
    const hasOidc = Boolean(env.ACTIONS_ID_TOKEN_REQUEST_URL);
    const hasStatic = Boolean(env.TWINE_PASSWORD);
    const preferStatic = workspaceConfig?.publish?.preferStaticToken === true;

    // OIDC wins when the env signal is present, except when the
    // operator explicitly opted into static-token precedence AND a
    // static token is actually available.
    if (hasOidc && !(preferStatic && hasStatic)) {
        return "oidc";
    }

    if (hasStatic) {
        return "token";
    }

    return "missing";
};

/**
 * Single helper that fetches `https://pypi.org/pypi/&lt;name>/json` and
 * extracts `info.version`. Errors / 404 / malformed JSON all collapse
 * to `undefined` — callers treat that as "unknown, publish anyway".
 *
 * Routed through {@link safeFetchVersionMetadata} so we get:
 *   - the SSRF guard (B-3 / M-4): `redirect: "manual"`, same-host
 *     redirect cap of 2, cross-host treated as a 404,
 *   - the contact `User-Agent` PyPI policy asks for.
 */
const fetchPyPiVersion = async (name: string, httpProxy?: string): Promise<string | undefined> => {
    try {
        const response = await safeFetchVersionMetadata(PYPI_PROJECT_URL(name), {
            headers: { Accept: "application/json" },
            httpProxy,
        });

        if (response.status === 404) {
            return undefined;
        }

        if (!response.ok) {
            return undefined;
        }

        const body = (await response.json()) as { info?: { version?: string } } | undefined;

        return body?.info?.version;
    } catch {
        return undefined;
    }
};

/**
 * Per-package config carries a `pythonProjectDir` hint (relative to
 * the package directory) when the pyproject.toml lives in a
 * subdirectory. Otherwise we default to the package root. The hint
 * lives in the shared `PerPackageReleaseConfig` shape so the
 * `pyproject()` preset can wire it through without a separate
 * interface declaration.
 */
const resolveProjectDir = (pkg: WorkspacePackage, perPkg?: PerPackageReleaseConfig): string => {
    if (perPkg?.pythonProjectDir) {
        return join(pkg.dir, perPkg.pythonProjectDir);
    }

    return pkg.dir;
};

export class PythonVersionActions extends VersionActions {
    public readonly id = "python" as const;

    /**
     * Read the published version from PyPI. We deliberately do NOT
     * use the local on-disk version here — the contract is "what's
     * live on the registry?". Falls back to `undefined` on any failure
     * (network, 404 fresh package, malformed JSON).
     */
    public async readPublishedVersion(context: {
        perPackageConfig?: PerPackageReleaseConfig;
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
    }): Promise<string | undefined> {
        const projectDir = resolveProjectDir(context.pkg, context.perPackageConfig);
        const toml = await readPyProject(projectDir).catch(() => undefined);

        // Prefer the PyPI dist name from pyproject.toml; fall back to
        // the JS package name (sans scope) for the typical
        // `@scope/foo` → `foo` mapping. Operators with diverging names
        // should put the PyPI name in pyproject.toml — vis honours it.
        const distName = toml?.project?.name ?? context.pkg.name.replace(/^@[^/]+\//, "");

        return fetchPyPiVersion(distName);
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        if (context.dryRun) {
            return {
                output: `[dry-run / python] would publish ${context.pkg.name}@${context.release.newVersion}`,
                published: true,
            };
        }

        const perPkg = context.perPackageConfig ?? {};
        const projectDir = resolveProjectDir(context.pkg, perPkg);
        const toml = await readPyProject(projectDir);

        // Refuse early on dynamic-version repos. A dynamic
        // `[project]` block omits `version` and declares
        // `dynamic = ["version", ...]` — the actual value is computed
        // by setuptools-scm / hatch-vcs / poetry-dynamic-versioning at
        // build time, and we can't know what it'll produce without
        // running those plugins. Operators on that path want the
        // shell adapter so they can hook in their backend's own
        // version-bump command.
        if (toml?.project?.dynamic?.includes("version")) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: join(projectDir, "pyproject.toml"),
                hint: "Dynamic versioning isn't supported by PythonVersionActions yet; use versionActions: 'shell' with your build backend's version-bump tool (e.g. `hatch version` or `poetry version` for non-vcs setups).",
                message: `${context.pkg.name}: pyproject.toml declares dynamic = ["version", ...]; PythonVersionActions requires a static [project] version.`,
                packageName: context.pkg.name,
            });
        }

        // The version on disk should already match release.newVersion
        // (the extra-files preset wrote it during `bumpVersion`). We
        // verify defensively so a misconfigured preset doesn't ship
        // the wrong tarball.
        if (toml?.project?.version && toml.project.version !== context.release.newVersion) {
            throw new VisReleaseError({
                code: "BUMP_FILE_INVALID",
                file: join(projectDir, "pyproject.toml"),
                hint: `Ensure the pyproject() preset is wired up for this package so the version literal in [project] is bumped before publish. Expected ${context.release.newVersion}, found ${toml.project.version}.`,
                message: `${context.pkg.name}: pyproject.toml version ${toml.project.version} differs from planned ${context.release.newVersion}.`,
                packageName: context.pkg.name,
            });
        }

        // Idempotency: short-circuit when this exact version is
        // already live on PyPI. Without this, a re-run after a
        // partial failure would hit PyPI's 400-on-duplicate response.
        const distName = toml?.project?.name ?? context.pkg.name.replace(/^@[^/]+\//, "");
        const publishedVersion = await fetchPyPiVersion(distName, context.workspaceConfig?.httpProxy);

        if (publishedVersion === context.release.newVersion) {
            return {
                alreadyPublished: true,
                output: `[python] ${distName}@${context.release.newVersion} already on PyPI`,
                published: false,
            };
        }

        // Resolve build + publish CLIs based on the configured backend
        // and uv availability. Backend detection drives ergonomics
        // (better error messages) but the build path is the same PEP
        // 517 entry point for every non-uv backend.
        //
        // N-6 fix: run the `uv --version` probe from `pkg.dir` (which
        // always exists — vis discovered the package from there) rather
        // than `projectDir`, which may not exist on greenfield
        // bootstrap. `uv --version` doesn't depend on cwd anyway.
        const hasUv = await detectUv(context.pm.runner, context.pkg.dir);
        const backend = detectBackend(toml);
        const buildEnv = resolveBuildEnv(backend, hasUv);

        // Verify auth BEFORE we spend time building. A failed auth
        // 30 seconds before the upload step is worse DX than a
        // failed auth pre-build.
        const authMode = detectAuthMode(process.env, context.workspaceConfig);

        if (authMode === "missing") {
            throw new VisReleaseError({
                code: "AUTH_MISSING",
                hint: [
                    "Set TWINE_PASSWORD to a PyPI API token (`TWINE_USERNAME=__token__` is injected automatically), OR",
                    "configure trusted publishing on PyPI and grant the workflow `permissions: id-token: write` so ACTIONS_ID_TOKEN_REQUEST_URL is exposed.",
                    "See https://docs.pypi.org/trusted-publishers/",
                ].join(" "),
                message: `${context.pkg.name}: no PyPI credentials detected (neither TWINE_PASSWORD nor OIDC trusted-publishing env).`,
                packageName: context.pkg.name,
            });
        }

        // Build step. We always invoke from the project dir so build
        // artifacts land in `<projectDir>/dist/`.
        const buildResult = await context.pm.runner.run(
            buildEnv.buildCommand.binary,
            buildEnv.buildCommand.args,
            { cwd: projectDir, silent: false },
        );

        if (buildResult.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: `Inspect the ${buildEnv.buildCommand.binary} ${buildEnv.buildCommand.args.join(" ")} output above. Common causes: missing ${buildEnv.backend === "uv" ? "uv" : "build/setuptools/wheel"} dependency, broken pyproject.toml, source files missing from \`include\`.`,
                message: `${context.pkg.name}: build failed (${buildEnv.buildCommand.binary} ${buildEnv.buildCommand.args.join(" ")}): exit ${buildResult.exitCode}. stderr: ${buildResult.stderr.trim().slice(0, 500)}`,
                packageName: context.pkg.name,
            });
        }

        // Inject TWINE_USERNAME=__token__ for the static-token path
        // if the operator didn't set one explicitly. PyPI requires
        // this exact literal when authenticating with an API token.
        const publishEnv: NodeJS.ProcessEnv = { ...process.env };

        if (authMode === "token" && !publishEnv.TWINE_USERNAME) {
            publishEnv.TWINE_USERNAME = "__token__";
        }

        const publishResult = await context.pm.runner.run(
            buildEnv.publishCommand.binary,
            buildEnv.publishCommand.args,
            { cwd: projectDir, env: publishEnv, silent: false },
        );

        if (publishResult.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: `Inspect the ${buildEnv.publishCommand.binary} output above. Common causes: invalid API token, version already published (this should have been caught by readPublishedVersion — file a vis bug), 2FA required without a token.`,
                message: `${context.pkg.name}: publish failed (${buildEnv.publishCommand.binary} ${buildEnv.publishCommand.args.join(" ")}): exit ${publishResult.exitCode}. stderr: ${publishResult.stderr.trim().slice(0, 500)}`,
                packageName: context.pkg.name,
            });
        }

        return {
            output: `[python/${buildEnv.backend}${buildEnv.hasUv ? "+uv" : ""}] published ${distName}@${context.release.newVersion}`,
            published: true,
        };
    }
}

// Re-export the types so they can be used externally (e.g. for
// downstream typing of programmatic invocations).
export type { PyProjectTomlShape, ResolvedBuildEnv };

// Re-export the internals used by the test suite. Keeping these on
// the module's named-exports list (rather than re-using them via the
// class instance) lets us unit-test the decision matrices in
// isolation, which is much cheaper than driving the full publish flow.
export {
    detectAuthMode,
    detectBackend,
    detectUv,
    fetchPyPiVersion,
    PYPI_PROJECT_URL,
    readPyProject,
    resolveBuildEnv,
    resolveProjectDir,
};

// `resolveUvLockPath` and `checkUvWorkspaceMembership` are also
// exported as named exports above (alongside the helper definitions)
// so they're reachable from the doctor handler + tests without
// rebuilding the bundle entry table.
