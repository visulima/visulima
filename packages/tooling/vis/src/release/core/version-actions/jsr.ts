/**
 * `jsr` versionActions — first-class JSR (jsr.io) publishing for the
 * Deno-flavoured registry that's increasingly used as a TS-native
 * alternative to npm. Companion to the `jsr()` preset in `presets.ts`,
 * which handles the version-string bump in `jsr.json` / `deno.json`.
 *
 * Why first-class instead of the generic `shell` path:
 *
 *   - **Scoped-name enforcement** — JSR mandates `@scope/name` package
 *     identifiers. A misconfigured manifest (`name: "foo"` without a
 *     scope) would surface as a confusing `jsr publish` error mid-
 *     upload; vis fails it pre-publish with `CONFIG_INVALID` and a
 *     pointed hint.
 *
 *   - **HTTP version detection** — jsr.io exposes `meta.json` per
 *     package (`GET https://jsr.io/@scope/name/meta.json`) which
 *     carries a `latest` field. Cheaper + more reliable than shelling
 *     out to `npx jsr` for a metadata probe, and the response is
 *     amenable to the same SSRF-safe fetch path the cargo / python /
 *     maven actions already use.
 *
 *   - **OIDC trusted publishing** — JSR added trusted publishing in
 *     mid-2024 (GH OIDC; same shape as crates.io's flow). vis detects
 *     `ACTIONS_ID_TOKEN_REQUEST_URL` and lets the `jsr publish` CLI
 *     pick up the OIDC token itself — we don't perform the exchange,
 *     just verify auth presence so AUTH_MISSING fires pre-publish
 *     rather than mid-upload.
 *
 * Auth precedence (aligned with cargo.ts / python.ts):
 *   1. OIDC trusted publishing — preferred whenever
 *      `ACTIONS_ID_TOKEN_REQUEST_URL` is present in the env.
 *   2. `JSR_API_KEY` env var (JSR's native variable for static auth) —
 *      used when OIDC env is absent, or when the operator opts back
 *      into static-token precedence via
 *      `release.publish.preferStaticToken: true` in vis.config.ts.
 *   3. Whatever's in the `~/.deno/auth.json` / `~/.config/jsr/auth.json`
 *      cache (deno login state — vis doesn't manage this).
 *
 * Wire it via per-package config (the `jsr()` preset already does this
 * for you):
 *
 *     release: {
 *         packages: {
 *             "@scope/sdk-jsr": jsr({ manifestPath: "jsr.json" }),
 *         },
 *     }
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, VisReleaseConfig, WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { resolveAuthMode } from "./auth";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

/** Base URL for jsr.io's per-package metadata. Override only for testing. */
const JSR_API_BASE = "https://jsr.io";

/**
 * Subset of the JSR manifest we care about. Both `jsr.json` and
 * `deno.json` carry the same shape for the fields we need (name,
 * version). `deno.json` allows additional Deno-specific keys (imports,
 * tasks) we don't touch.
 */
export interface JsrManifest {
    /** `@scope/name` — JSR refuses unscoped publishes. */
    name?: string;
    /** SemVer literal. */
    version?: string;
}

/**
 * Match JSR's scoped-name requirement. JSR enforces `@scope/name`
 * where:
 *   - scope: 2-32 chars, [a-z0-9-]
 *   - name:  1-58 chars, [a-z0-9-]
 *
 * The regex is intentionally permissive on the upper bound (60 chars
 * total ignoring the @ and /) — we'd rather defer the exact-length
 * decision to JSR itself than reject a borderline-valid name. The hard
 * rule we enforce is "must have the \@scope/ prefix".
 */
const JSR_NAME_REGEX = /^@[a-z0-9-]+\/[a-z0-9-]+$/i;

/**
 * Parse a JSR manifest at the given absolute path. Returns the parsed
 * object on success; throws `CONFIG_INVALID` for unreadable / malformed
 * JSON / unscoped name / missing version.
 *
 * Exposed as a helper so the version-read path and the publish path
 * share validation — neither flow can act on a manifest the other
 * would reject.
 */
export const parseJsrManifest = async (jsonPath: string): Promise<{ name: string; version: string }> => {
    let raw: string;

    try {
        raw = await readFile(jsonPath, "utf8");
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            file: jsonPath,
            message: `Failed to read JSR manifest at ${jsonPath}: ${(error as Error).message}`,
        });
    }

    let parsed: JsrManifest;

    try {
        parsed = JSON.parse(raw) as JsrManifest;
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            file: jsonPath,
            message: `Failed to parse JSR manifest at ${jsonPath}: ${(error as Error).message}`,
        });
    }

    if (typeof parsed.name !== "string" || parsed.name.length === 0) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            file: jsonPath,
            hint: "JSR manifests must declare a `name` field with the `@scope/name` form.",
            message: `JSR manifest at ${jsonPath} is missing the \`name\` field.`,
        });
    }

    if (!JSR_NAME_REGEX.test(parsed.name)) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            file: jsonPath,
            hint: "JSR requires every package to publish under `@scope/name`. Add the `@scope/` prefix and lowercase the name (a-z, 0-9, hyphen).",
            message: `JSR manifest at ${jsonPath} declares an invalid \`name\`: "${parsed.name}". JSR requires the @scope/name form.`,
        });
    }

    if (typeof parsed.version !== "string" || parsed.version.length === 0) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            file: jsonPath,
            hint: "Add a `version` literal to the JSR manifest, or wire the `jsr()` preset so vis bumps it for you.",
            message: `JSR manifest at ${jsonPath} is missing the \`version\` field.`,
        });
    }

    return { name: parsed.name, version: parsed.version };
};

interface JsrMetaResponse {
    /** Highest published stable version, per JSR's convention. */
    latest?: string;
    /** Optional per-version listing — we don't currently consume it. */
    versions?: Record<string, unknown>;
}

/**
 * Fetch a JSR package's metadata and return the `latest` field. JSR's
 * `meta.json` is the public, unauthenticated endpoint they expose for
 * registry tooling.
 *
 *   - 200 + body.latest → string returned
 *   - 404               → undefined (fresh package, never published)
 *   - everything else   → undefined (network / parse / cross-host
 *     redirect — caller treats as "publish anyway", which `jsr publish`
 *     itself will reject if the version is actually live)
 *
 * Routed through {@link safeFetchVersionMetadata} so we inherit the
 * SSRF guard + contact `User-Agent`.
 */
const fetchJsrLatestVersion = async (packageName: string, httpProxy?: string): Promise<string | undefined> => {
    // `packageName` is `@scope/name`; the URL is `${base}/@scope/name/meta.json`.
    // We don't encodeURIComponent the scope/name pair because `/` is
    // structural here — but we do validate via `JSR_NAME_REGEX` above so
    // no untrusted input reaches this point.
    const url = `${JSR_API_BASE}/${packageName}/meta.json`;

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

        const body = (await response.json()) as JsrMetaResponse | undefined;

        return typeof body?.latest === "string" ? body.latest : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Whether JSR's OIDC trusted-publishing path should be used.
 *
 * Aligned with `shouldUseTrustedPublishing` in cargo.ts and `detectAuthMode`
 * in python.ts: OIDC wins by default when the env signal is present;
 * the operator can opt back into static-token precedence via the
 * workspace-level escape hatch `release.publish.preferStaticToken: true`.
 */
const shouldUseTrustedPublishing = (env: NodeJS.ProcessEnv, workspaceConfig?: VisReleaseConfig): boolean =>
    resolveAuthMode({ env, staticTokenVar: "JSR_API_KEY", workspaceConfig }) === "oidc";

/**
 * Resolve the absolute path to the JSR manifest for a given workspace
 * package. Defaults to `&lt;pkg.dir>/jsr.json`; the `jsr()` preset wires
 * `jsrConfigPath` from its `manifestPath` option so operators using
 * `deno.json` (or a custom subdirectory) get pointed at the right file.
 */
const resolveJsrManifestPath = (pkg: WorkspacePackage, perPackageConfig?: { jsrConfigPath?: string }): string => {
    const relative = perPackageConfig?.jsrConfigPath ?? "jsr.json";

    return join(pkg.dir, relative);
};

export class JsrVersionActions extends VersionActions {
    public readonly id = "jsr" as const;

    public async readPublishedVersion(context: {
        perPackageConfig?: PerPackageReleaseConfig;
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
        workspaceConfig?: VisReleaseConfig;
    }): Promise<string | undefined> {
        const manifestPath = resolveJsrManifestPath(context.pkg, context.perPackageConfig);

        try {
            const { name } = await parseJsrManifest(manifestPath);

            return await fetchJsrLatestVersion(name, context.workspaceConfig?.httpProxy);
        } catch {
            // Manifest unreadable / malformed / unscoped — degrade to
            // "publish anyway" so the orchestrator's read-only probes
            // don't fail the whole wave on a misconfigured manifest.
            // The publish path re-runs `parseJsrManifest` and DOES throw
            // there, which is the right place to surface the config bug.
            return undefined;
        }
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        if (context.dryRun) {
            return {
                output: `[dry-run / jsr] would publish ${context.pkg.name}@${context.release.newVersion}`,
                published: true,
            };
        }

        const manifestPath = resolveJsrManifestPath(context.pkg, context.perPackageConfig);

        // Re-parse the manifest (with full validation) — the read-only
        // probe in readPublishedVersion swallowed any errors; the
        // publish path must surface them.
        const { name: jsrName, version: onDiskVersion } = await parseJsrManifest(manifestPath);

        if (onDiskVersion !== context.release.newVersion) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: manifestPath,
                hint: `Confirm the jsr() preset's manifestPath points at the JSR config file the extra-files rule rewrites. Expected ${context.release.newVersion} on disk after the bump.`,
                message: `JSR manifest version (${onDiskVersion}) does not match planned release version (${context.release.newVersion}) for ${context.pkg.name}.`,
                packageName: context.pkg.name,
            });
        }

        // Idempotency probe — short-circuit when the registry already
        // has this version. Cheaper than a `jsr publish` that JSR will
        // bounce as a duplicate, and the same shape every other action
        // uses.
        const publishedVersion = await fetchJsrLatestVersion(jsrName, context.workspaceConfig?.httpProxy);

        if (publishedVersion === context.release.newVersion) {
            return {
                alreadyPublished: true,
                output: `[jsr] ${jsrName}@${context.release.newVersion} already on jsr.io`,
                published: false,
            };
        }

        const useOidc = shouldUseTrustedPublishing(process.env, context.workspaceConfig);

        if (!useOidc && !process.env["JSR_API_KEY"]) {
            throw new VisReleaseError({
                code: "AUTH_MISSING",
                hint: "Set JSR_API_KEY for static-token auth, or run from a GH-Actions job with `permissions: id-token: write` so ACTIONS_ID_TOKEN_REQUEST_URL is exposed for OIDC trusted publishing.",
                message: `Cannot publish ${jsrName}@${context.release.newVersion}: neither JSR_API_KEY nor OIDC trusted publishing is available.`,
                packageName: context.pkg.name,
            });
        }

        // We invoke via `npx jsr publish` so operators don't need to
        // install the CLI globally. The flag matrix is intentionally
        // small — JSR's CLI auto-detects the manifest in the cwd, picks
        // up OIDC env vars natively, and reads JSR_API_KEY as a fallback.
        //
        // `--config` is passed only when the operator points at a
        // non-default location (e.g. `deno.json` instead of `jsr.json`,
        // or a subdirectory). When `jsrConfigPath` is absent the CLI's
        // own discovery picks up whichever of `jsr.json` / `deno.json`
        // it finds.
        const args = ["jsr", "publish", "--allow-dirty"];

        const configRelative = context.perPackageConfig?.jsrConfigPath;

        if (configRelative !== undefined && configRelative !== "jsr.json") {
            args.push("--config", configRelative);
        }

        // Operator-supplied flags (e.g. `--allow-slow-types`), wired via the
        // `jsr()` preset's `allowSlowTypes` / `publishArgs` options.
        for (const extra of context.perPackageConfig?.jsrPublishArgs ?? []) {
            args.push(extra);
        }

        const result = await context.pm.runner.run("npx", args, {
            cwd: context.pkg.dir,
            silent: false,
        });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: "Inspect the jsr CLI output above. Common causes: invalid JSR_API_KEY, OIDC permission misconfigured, version already published, slow-mode rate limit. Re-runs are safe — the published-version probe short-circuits subsequent runs.",
                message: `jsr publish failed for ${jsrName}@${context.release.newVersion}: exit ${result.exitCode}. stderr: ${result.stderr.trim().slice(0, 500)}`,
                packageName: context.pkg.name,
            });
        }

        return {
            output: `[jsr] published ${jsrName}@${context.release.newVersion}${useOidc ? " (trusted publishing)" : ""}`,
            published: true,
        };
    }
}

// Test-only exports — surfaced so unit tests can exercise the helpers
// directly without standing up a full PublishContext.
// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention -- test-only export seam
export const __testing = {
    fetchJsrLatestVersion,
    JSR_NAME_REGEX,
    parseJsrManifest,
    shouldUseTrustedPublishing,
};
