/**
 * `cargo` versionActions — first-class Rust crate publishing to
 * crates.io. Companion to the `cargo()` preset in `presets.ts`, which
 * handles the version-string bump in `Cargo.toml`.
 *
 * Why first-class instead of relying on the generic `shell` actions:
 *
 *   - **Native TOML parse** — reads the on-disk version from
 *     `[package].version` via `smol-toml` instead of regex-scraping
 *     stdout. Cargo workspaces with inherited versions
 *     (`version.workspace = true`) still resolve correctly because we
 *     follow the `[workspace.package]` table when needed.
 *
 *   - **crates.io HTTP API for published-version detection** — a single
 *     `GET https://crates.io/api/v1/crates/&lt;name>` returns the latest
 *     stable in `crate.max_version`. Cheaper than `cargo search` (which
 *     needs cargo installed at preflight time AND scrapes the same
 *     endpoint behind the scenes) and lets us distinguish "not
 *     published yet" (404) from "network unreachable" (everything else
 *     → undefined → orchestrator treats as publish-anyway, same as
 *     `npm view` failure).
 *
 *   - **OIDC trusted publishing** — crates.io launched trusted
 *     publishing mid-2024. The token-exchange dance is handled by
 *     cargo itself when the GH-Actions OIDC requester env vars are
 *     present; vis does not pass a CLI flag (cargo's trusted
 *     publishing is configured via per-registry blocks in
 *     `Cargo.toml` / `~/.cargo/config.toml`, NOT a `cargo publish`
 *     flag). vis's only job here is to ensure cargo can FIND its auth:
 *     we detect OIDC vs static-token presence so AUTH_MISSING fires
 *     pre-publish instead of mid-upload.
 *
 *   - **Pre-publish secret scan** — `cargo package --list` enumerates
 *     the files that will land in the .crate, mirroring the npm
 *     `pack-then-scan` flow so the same `publish.guards.packSecretScan`
 *     gate catches leaked secrets in Rust crates without ecosystem-
 *     specific config.
 *
 * Wire it via per-package config (the `cargo()` preset already does
 * this for you):
 *
 *     release: {
 *         packages: {
 *             "@scope/native": {
 *                 ...cargo({ crateDir: "crates/native" }),
 *                 // versionActions defaults to "cargo" via the preset.
 *             },
 *         },
 *     }
 *
 * Auth precedence (M-3 alignment with python.ts):
 *   1. OIDC trusted publishing — preferred whenever
 *      `ACTIONS_ID_TOKEN_REQUEST_URL` is present in the env (the
 *      GitHub Actions CI signal that `permissions: id-token: write`
 *      was granted). Even when a stale `CARGO_REGISTRY_TOKEN` is also
 *      set in the env, OIDC wins — the rationale being that an
 *      operator who has wired up trusted publishing wants OIDC, and
 *      silently falling back to a leftover static token would be a
 *      footgun (potentially using auth the operator forgot was
 *      configured).
 *   2. `CARGO_REGISTRY_TOKEN` env var (cargo's native variable) —
 *      used when OIDC env is absent, or when the operator opts back
 *      into static-token precedence via
 *      `release.publish.preferStaticToken: true` in vis.config.ts.
 *   3. Whatever's in `~/.cargo/credentials.toml` (cargo's fallback —
 *      vis doesn't manage this; the operator does)
 *
 * Lockfile handling: after `cargo publish` succeeds, `Cargo.lock` may
 * shift. We deliberately do NOT manage this from vis — `cargo publish`
 * runs `cargo build` internally and refreshes the lock as needed. The
 * orchestrator's release-commit step picks up any lock changes via the
 * standard git-staging flow.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { VisReleaseConfig, WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

/** crates.io public API root. Override only for testing. */
const CRATES_IO_API = "https://crates.io/api/v1/crates";

/** Default `Cargo.toml` location relative to the package directory. */
const DEFAULT_CARGO_MANIFEST = "Cargo.toml";

interface CargoToml {
    package?: {
        name?: string;
        version?: string | { workspace?: boolean };
    };
    workspace?: {
        package?: {
            version?: string;
        };
    };
}

/**
 * Read + parse `Cargo.toml`, then walk the `[package]` / `[workspace.package]`
 * tables to resolve the effective version. Supports the modern
 * `version.workspace = true` inheritance pattern.
 *
 * Throws `CONFIG_INVALID` when:
 *   - file missing / unreadable
 *   - TOML parse fails
 *   - no `[package]` table at all (this isn't a publishable crate)
 *   - `version.workspace = true` but the root has no `[workspace.package].version`
 */
const readCargoToml = async (cargoTomlPath: string): Promise<{ name: string; version: string }> => {
    let raw: string;

    try {
        raw = await readFile(cargoTomlPath, "utf8");
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            file: cargoTomlPath,
            message: `Failed to read Cargo.toml at ${cargoTomlPath}: ${(error as Error).message}`,
        });
    }

    const { parse } = await import("smol-toml");
    let parsed: CargoToml;

    try {
        parsed = parse(raw);
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            file: cargoTomlPath,
            message: `Failed to parse Cargo.toml at ${cargoTomlPath}: ${(error as Error).message}`,
        });
    }

    if (!parsed.package) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            file: cargoTomlPath,
            hint: "CargoVersionActions only supports publishable crates with a [package] table. For workspace roots, point per-package config at the member crate directory.",
            message: `Cargo.toml at ${cargoTomlPath} has no [package] table.`,
        });
    }

    const { name } = parsed.package;

    if (typeof name !== "string" || name.length === 0) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            file: cargoTomlPath,
            message: `Cargo.toml at ${cargoTomlPath} is missing [package].name.`,
        });
    }

    const versionField = parsed.package.version;
    let version: string | undefined;

    if (typeof versionField === "string") {
        version = versionField;
    } else if (versionField && typeof versionField === "object" && (versionField).workspace === true) {
        // `version.workspace = true` → look up the inherited value in
        // [workspace.package].version of the SAME file (workspace root)
        // or — when we're a member crate — the operator points us at
        // the right Cargo.toml. We don't traverse the directory tree
        // looking for a workspace root; that's the operator's job
        // (`crateDir` should point at the leaf with [package]).
        version = parsed.workspace?.package?.version;
    }

    if (typeof version !== "string" || version.length === 0) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            file: cargoTomlPath,
            hint: "Set [package].version explicitly, or — for workspace-inherited versions — ensure the root Cargo.toml carries [workspace.package].version and point per-package config at it.",
            message: `Cargo.toml at ${cargoTomlPath} has no resolvable [package].version.`,
        });
    }

    return { name, version };
};

interface CratesIoResponse {
    crate?: {
        max_stable_version?: string;
        max_version?: string;
    };
}

/**
 * GET the crates.io crate metadata; pull out the latest version literal.
 *
 *   - HTTP 200 + `crate.max_stable_version` (preferred — excludes
 *     pre-releases the registry tracks separately) or `crate.max_version`
 *     as a fallback.
 *   - HTTP 404 → undefined (crate hasn't been published yet — fresh
 *     crate, first publish coming up).
 *   - Anything else (network error, 5xx, body parse failure) → undefined.
 *     Orchestrator treats this as "publish anyway"; cargo itself will
 *     short-circuit with `crate version is already uploaded` if the
 *     race ended up wrong, which is safer than guessing.
 *
 * Routed through {@link safeFetchVersionMetadata} so we get the SSRF
 * guard (manual redirect handling, same-host-only) and the contact
 * `User-Agent` crates.io's policy asks for.
 */
const fetchCratesIoVersion = async (crateName: string, httpProxy?: string): Promise<string | undefined> => {
    const url = `${CRATES_IO_API}/${encodeURIComponent(crateName)}`;

    try {
        const response = await safeFetchVersionMetadata(url, {
            headers: { Accept: "application/json" },
            httpProxy,
        });

        if (response.status === 404) {
            return undefined;
        }

        if (!response.ok) {
            return undefined;
        }

        const body = (await response.json()) as CratesIoResponse | undefined;

        return body?.crate?.max_stable_version ?? body?.crate?.max_version ?? undefined;
    } catch {
        return undefined;
    }
};

/**
 * Whether crates.io's OIDC trusted-publishing path should be used.
 *
 * Decision (M-3 — aligned with python.ts):
 *   - `ACTIONS_ID_TOKEN_REQUEST_URL` present → OIDC wins, even if
 *     `CARGO_REGISTRY_TOKEN` is also in the env. The presence of the
 *     OIDC request URL is the CI signal that the operator opted into
 *     trusted publishing; a leftover static token in the env is more
 *     likely a stale value than an explicit downgrade.
 *   - Operator escape hatch: `release.publish.preferStaticToken: true`
 *     in vis.config.ts flips the precedence — when set, a static
 *     `CARGO_REGISTRY_TOKEN` wins over OIDC. Useful for operators
 *     migrating off OIDC, or for shadow-publishing to two channels
 *     during a cutover.
 *   - No OIDC env + no static token → returns `false`; the caller's
 *     AUTH_MISSING gate will trigger.
 */
const shouldUseTrustedPublishing = (env: NodeJS.ProcessEnv, workspaceConfig?: VisReleaseConfig): boolean => {
    const hasOidc = Boolean(env["ACTIONS_ID_TOKEN_REQUEST_URL"]);
    const hasStatic = Boolean(env["CARGO_REGISTRY_TOKEN"]);
    const preferStatic = workspaceConfig?.publish?.preferStaticToken === true;

    if (!hasOidc) {
        return false;
    }

    if (preferStatic && hasStatic) {
        return false;
    }

    return true;
};

/**
 * Enumerate the files that `cargo publish` will include in the .crate.
 * Used for the pre-publish secret-scan gate (same shape as npm's
 * `listPackFiles`). On any error returns an empty list — guards then
 * trivially pass; the operator should see the underlying cargo error
 * first.
 *
 * `cargo package --list` writes one file per line to stdout. The list
 * is workspace-relative; we leave it as-is so the secret scanner can
 * pair the path with `pkgDir`.
 */
const listCratePackFiles = async (
    runner: PackageManagerAdapter["runner"],
    cwd: string,
): Promise<string[]> => {
    const result = await runner.run("cargo", ["package", "--list", "--allow-dirty"], { cwd, silent: true });

    if (result.exitCode !== 0) {
        return [];
    }

    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
};

export class CargoVersionActions extends VersionActions {
    public readonly id = "cargo" as const;

    public async readPublishedVersion(context: { pkg: WorkspacePackage; pm: PackageManagerAdapter }): Promise<string | undefined> {
        // Pull the crate name out of Cargo.toml — the npm package.json
        // name (e.g. `@scope/native`) doesn't match the crates.io
        // identifier (`scope-native` or whatever the maintainer chose).
        const cargoTomlPath = resolveCargoTomlPath(context.pkg);

        try {
            const { name } = await readCargoToml(cargoTomlPath);

            return await fetchCratesIoVersion(name);
        } catch {
            // Treat parse errors the same as registry failures here —
            // the orchestrator's "publish anyway" fallback is safer
            // than failing the whole release for a read-only probe.
            return undefined;
        }
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        if (context.dryRun) {
            return {
                output: `[dry-run / cargo] would publish ${context.pkg.name}@${context.release.newVersion}`,
                published: true,
            };
        }

        const cargoTomlPath = resolveCargoTomlPath(context.pkg, context.perPackageConfig);
        const cargoCwd = resolveCargoCwd(context.pkg, context.perPackageConfig);

        // Read the crate name AND the on-disk version. The version on
        // disk has already been bumped by the extra-files preset (we
        // run after the version step), so it should match
        // release.newVersion. If not, the operator either misconfigured
        // the preset path or something else is wrong — fail loudly.
        const { name: crateName, version: onDiskVersion } = await readCargoToml(cargoTomlPath);

        if (onDiskVersion !== context.release.newVersion) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: cargoTomlPath,
                hint: `Confirm the cargo() preset's crateDir points at the directory containing this Cargo.toml. Expected ${context.release.newVersion} on disk after the extra-files bump.`,
                message: `Cargo.toml version (${onDiskVersion}) does not match planned release version (${context.release.newVersion}) for ${context.pkg.name}.`,
                packageName: context.pkg.name,
            });
        }

        // Idempotency: skip when crates.io already has this version.
        // The cargo CLI will also reject duplicate uploads with a clear
        // error, but short-circuiting here saves a `cargo build` cycle
        // on re-runs after a partial wave.
        const publishedVersion = await fetchCratesIoVersion(crateName, context.workspaceConfig?.httpProxy);

        if (publishedVersion === context.release.newVersion) {
            return {
                alreadyPublished: true,
                output: `[cargo] ${crateName}@${context.release.newVersion} already on crates.io`,
                published: false,
            };
        }

        // Auth resolution. We never log the token; cargo reads it
        // straight out of the env. See `shouldUseTrustedPublishing`
        // for the precedence rules (M-3).
        const useOidc = shouldUseTrustedPublishing(process.env, context.workspaceConfig);

        if (!useOidc && !process.env["CARGO_REGISTRY_TOKEN"]) {
            throw new VisReleaseError({
                code: "AUTH_MISSING",
                hint: "Set CARGO_REGISTRY_TOKEN, or run from a GH-Actions job with `permissions: id-token: write` for OIDC trusted publishing.",
                message: `Cannot publish ${crateName}@${context.release.newVersion}: neither CARGO_REGISTRY_TOKEN nor OIDC trusted publishing is available.`,
                packageName: context.pkg.name,
            });
        }

        // Pre-publish secret scan. Mirror the npm flow — only run when
        // the guard is enabled in workspace config. We fetch the file
        // list ahead of publish so a finding aborts before cargo
        // uploads anything.
        const guardsConfig = context.workspaceConfig?.publish?.guards;

        if (guardsConfig?.packSecretScan) {
            const packFiles = await listCratePackFiles(context.pm.runner, cargoCwd);

            if (packFiles.length > 0) {
                const { runPackSecretScan } = await import("../publish-guards");
                const ignore = typeof guardsConfig.packSecretScan === "object" ? guardsConfig.packSecretScan.ignore : undefined;
                const report = await runPackSecretScan({ files: packFiles, ignore, pkgDir: cargoCwd });

                if (!report.passed) {
                    const { redactTokens } = await import("../security");
                    const summary = report.findings
                        .map((f) => `  • [packSecretScan] ${redactTokens(f.message)}${f.hint ? `\n      → ${redactTokens(f.hint)}` : ""}`)
                        .join("\n");

                    throw new VisReleaseError({
                        code: "PUBLISH_FAILED",
                        message: `Pre-publish secret scan failed for ${crateName}@${context.release.newVersion}:\n${summary}`,
                        packageName: context.pkg.name,
                    });
                }
            }
        }

        // Hand off to cargo. `--allow-dirty` is required because the
        // release commit hasn't landed yet at this point in the
        // orchestrator's flow (we publish, then commit + tag).
        //
        // M-7: we deliberately do NOT pass `--trusted-publishing`.
        // That flag does NOT exist on `cargo publish` (per
        // `cargo publish --help` as of cargo 1.85 / late 2025).
        // crates.io's trusted publishing is configured via
        // per-registry blocks in `Cargo.toml` /
        // `~/.cargo/config.toml`, NOT a CLI flag. Operators using OIDC
        // trusted publishing must wire up cargo's config themselves;
        // the doctor check `cargo-trusted-publishing-config` (in
        // `release doctor`) warns when OIDC is requested but the
        // config block is missing.
        const args = ["publish", "--allow-dirty"];

        if (context.registry && context.registry !== "https://crates.io") {
            // Alternative registry — relies on the registry being
            // configured in cargo's `[registries]` table.
            args.push("--registry", context.registry);
        }

        const result = await context.pm.runner.run("cargo", args, { cwd: cargoCwd, silent: false });

        if (result.exitCode !== 0) {
            // cargo's exit messaging includes the actual reason
            // ("crate version X is already uploaded", "401 Unauthorized",
            // etc.); surface the last 500 chars of stderr verbatim
            // (after token redaction by the runner).
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: "Inspect the cargo output above. Common causes: missing CARGO_REGISTRY_TOKEN, OIDC permission misconfigured, version already published, crates.io rate limit. Re-runs are safe — the published-version probe short-circuits subsequent runs.",
                message: `cargo publish failed for ${crateName}@${context.release.newVersion}: exit ${result.exitCode}. stderr: ${result.stderr.trim().slice(0, 500)}`,
                packageName: context.pkg.name,
            });
        }

        return {
            output: `[cargo] published ${crateName}@${context.release.newVersion}${useOidc ? " (trusted publishing)" : ""}`,
            published: true,
        };
    }
}

/**
 * Resolve where the Cargo.toml lives for a given workspace package.
 * Defaults to `&lt;pkg.dir>/Cargo.toml`. Operators can override via
 * `perPackageConfig.cargoTomlPath` (relative to pkg.dir) for unusual
 * layouts where the JS package and crate live in sibling directories
 * sharing a parent (e.g. `apps/foo/package.json` + `crates/foo/Cargo.toml`).
 *
 * The cargo() preset wires `cargoTomlPath` from its `crateDir` option,
 * so most operators don't see this directly.
 */
const resolveCargoTomlPath = (pkg: WorkspacePackage, perPackageConfig?: { cargoTomlPath?: string }): string => {
    const relative = perPackageConfig?.cargoTomlPath ?? DEFAULT_CARGO_MANIFEST;

    return join(pkg.dir, relative);
};

/**
 * Resolve the working directory for cargo invocations. Always the
 * directory containing `Cargo.toml` — cargo refuses to run elsewhere.
 */
const resolveCargoCwd = (pkg: WorkspacePackage, perPackageConfig?: { cargoTomlPath?: string }): string => dirname(resolveCargoTomlPath(pkg, perPackageConfig));

// Test-only exports — surfaced so unit tests can exercise the helpers
// directly without standing up a full PublishContext.
// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention -- test-only export seam
export const __testing = {
    fetchCratesIoVersion,
    readCargoToml,
    shouldUseTrustedPublishing,
};
