/**
 * `native-addon` versionActions — for NAPI parents (RFC §12).
 *
 * Port of `scripts/semantic-release-native-addons.mjs` (the existing
 * visulima plugin). Steps:
 *   1. Discover platform packages under `&lt;pkg.dir>/npm/&lt;platform>/`
 *   2. Bump every platform package's version to match the parent
 *   3. Resolve auth: GitHub Actions OIDC (per-package token exchange)
 *      with NPM_TOKEN fallback
 *   4. Pack each platform package; publish under the channel's dist-tag
 *   5. Pack + publish the parent (with `optionalDependencies` resolved
 *      to literal versions matching the platforms)
 *
 * Auto-detected via the `napi` field in `package.json` (RFC §12.3).
 * Override per-package: `vis-release: { versionActions: "native-addon" }`.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { PackageManifest, WorkspacePackage } from "../../types";
import { rewriteCatalogRefs } from "../catalog";
import { cleanPackageJsonForPublish } from "../clean-package-json";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { assertValidPackageName } from "../security";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
const OIDC_AUDIENCE = "npm:registry.npmjs.org";

interface AuthToken {
    source: "oidc" | "NPM_TOKEN";
    token: string;
}

const getPlatformDirs = async (cwd: string): Promise<string[]> => {
    const npmDir = join(cwd, "npm");

    try {
        const entries = await readdir(npmDir, { withFileTypes: true });

        return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
        return [];
    }
};

const getGithubActionsIdToken = async (env: NodeJS.ProcessEnv): Promise<string | undefined> => {
    const requestUrl = env["ACTIONS_ID_TOKEN_REQUEST_URL"];
    const requestToken = env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"];

    if (!requestUrl || !requestToken) {
        return undefined;
    }

    const url = `${requestUrl}${requestUrl.includes("?") ? "&" : "?"}audience=${encodeURIComponent(OIDC_AUDIENCE)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });

    if (!response.ok) {
        return undefined;
    }

    const body = (await response.json().catch(() => {
        return {};
    })) as { value?: string };

    return typeof body.value === "string" ? body.value : undefined;
};

const exchangeOidcTokenForPackage = async (packageName: string, idToken: string): Promise<string | undefined> => {
    const response = await fetch(`${OFFICIAL_REGISTRY}-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(packageName)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        method: "POST",
    });

    if (!response.ok) {
        return undefined;
    }

    const body = (await response.json().catch(() => {
        return {};
    })) as { token?: string };

    return typeof body.token === "string" ? body.token : undefined;
};

const resolveAuthToken = async (packageName: string, idToken: string | undefined, env: NodeJS.ProcessEnv): Promise<AuthToken> => {
    if (idToken) {
        const oidcToken = await exchangeOidcTokenForPackage(packageName, idToken);

        if (oidcToken) {
            return { source: "oidc", token: oidcToken };
        }
    }

    const npmToken = env["NPM_TOKEN"];

    if (npmToken) {
        return { source: "NPM_TOKEN", token: npmToken };
    }

    throw new VisReleaseError({
        code: "AUTH_MISSING",
        message: `Cannot publish ${packageName}: OIDC exchange did not succeed and NPM_TOKEN is not set.`,
        packageName,
    });
};

const writeNpmrc = (path: string, token: string): void => {
    writeFileSync(path, `//registry.npmjs.org/:_authToken=${token}\nregistry=${OFFICIAL_REGISTRY}\n`);
};

export class NativeAddonVersionActions extends VersionActions {
    // fallow-ignore-next-line unused-class-member -- version-action adapter contract member (accessed polymorphically via the adapter interface)
    public readonly id = "native-addon" as const;

    // fallow-ignore-next-line unused-class-member -- version-action adapter contract member (accessed polymorphically via the adapter interface)
    public async readPublishedVersion(context: { pkg: WorkspacePackage; pm: PackageManagerAdapter }): Promise<string | undefined> {
        try {
            assertValidPackageName(context.pkg.name);

            const { execFileSync } = await import("node:child_process");
            const out = execFileSync("npm", ["view", context.pkg.name, "version"], { stdio: ["ignore", "pipe", "ignore"] })
                .toString()
                .trim();

            return out || undefined;
        } catch {
            return undefined;
        }
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        if (context.dryRun) {
            const platforms = await getPlatformDirs(context.pkg.dir);

            return {
                output: `[dry-run] would publish ${context.pkg.name}@${context.release.newVersion} + ${platforms.length} platform package(s)`,
                published: true,
            };
        }

        const platforms = await getPlatformDirs(context.pkg.dir);

        if (platforms.length === 0) {
            // No platform packages — fall back to default npm publish path.
            const { NpmVersionActions } = await import("./npm");

            return new NpmVersionActions().publish(context);
        }

        // 1. Auth
        const { env } = process;
        const idToken = await getGithubActionsIdToken(env);

        // 2. Bump all platform package.jsons to the parent's new version
        const parentNewVersion = context.release.newVersion;
        const platformOriginals = new Map<string, string>();
        // Track every temp dir we create so the finally block can wipe them
        // even if npm publish throws mid-flight (RFC §19.4 — token hygiene).
        const tempDirs: string[] = [];

        try {
            // 2a. Bump every platform package.json in parallel (8 small fs writes).
            await Promise.all(
                platforms.map(async (platform) => {
                    const manifestPath = join(context.pkg.dir, "npm", platform, "package.json");
                    const original = await readFile(manifestPath, "utf8");

                    platformOriginals.set(manifestPath, original);

                    const manifest = JSON.parse(original) as PackageManifest;

                    manifest.version = parentNewVersion;

                    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
                }),
            );

            // 2b. Resolve OIDC tokens for every platform in parallel (8
            // independent token-exchange round-trips to npmjs.org). Was the
            // dominant wall-time cost — typically ~400ms each, so 8×400ms
            // sequential drops to ~400ms total.
            const { execFileSync } = await import("node:child_process");
            const platformResolved = await Promise.all(
                platforms.map(async (platform) => {
                    const platformDir = join(context.pkg.dir, "npm", platform);
                    const manifestPath = join(platformDir, "package.json");
                    const manifestRaw = await readFile(manifestPath, "utf8");
                    const manifest = JSON.parse(manifestRaw) as PackageManifest;

                    assertValidPackageName(manifest.name);

                    const auth = await resolveAuthToken(manifest.name, idToken, env);
                    const tempDir = mkdtempSync(join(tmpdir(), "vis-release-napi-"));

                    tempDirs.push(tempDir);

                    const npmrcPath = join(tempDir, ".npmrc");

                    writeNpmrc(npmrcPath, auth.token);

                    return { manifest, npmrcPath, platform, platformDir };
                }),
            );

            // 3. Pre-publish guards on every platform package. Platform
            // packages ship binaries, so this is precisely where malicious
            // `postinstall` scripts or leaked credentials in the tarball
            // would cause the most damage. Runs sequentially (cheap; the
            // gates are pure / fs-only) and short-circuits the wave on
            // any blocker rather than allowing partial-publish corruption.
            const guardsConfig = context.workspaceConfig?.publish?.guards;

            if (guardsConfig && Object.values(guardsConfig).some((v) => v !== undefined && v !== false && v !== "off")) {
                const { runPublishGuards } = await import("../publish-guards");

                for (const { manifest, platformDir } of platformResolved) {
                    // List files via npm pack --dry-run --json so the
                    // packSecretScan / exportsExist gates see the same
                    // file set the registry will receive.
                    const listing = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: platformDir, stdio: ["ignore", "pipe", "ignore"] }).toString();
                    let packFiles: string[] = [];

                    try {
                        const parsed = JSON.parse(listing) as { files?: { path: string }[] }[];

                        packFiles = parsed[0]?.files?.map((f) => f.path) ?? [];
                    } catch {
                        // Fall through with empty pack-file list — gates that
                        // depend on it pass trivially; better than crashing.
                    }

                    const report = await runPublishGuards({
                        config: guardsConfig,
                        manifest,
                        packFiles,
                        pkgDir: platformDir,
                        runner: context.pm.runner,
                        sourceManifest: manifest,
                    });

                    if (report.blockers.length > 0) {
                        const summary = report.blockers
                            .flatMap((r) => r.findings.map((f) => `  • [${r.gate}] ${f.message}${f.hint ? `\n      → ${f.hint}` : ""}`))
                            .join("\n");

                        throw new VisReleaseError({
                            code: "PUBLISH_FAILED",
                            message: `Pre-publish guards failed for ${manifest.name}@${parentNewVersion} (platform package):\n${summary}`,
                            packageName: manifest.name,
                        });
                    }
                }
            }

            // 4. Publish each platform package. Sequential here — npm publish
            // is network-bound but registries throttle concurrent uploads from
            // the same account; sequential keeps us under rate limits.
            const tag = context.tag ?? "latest";
            const publishArgs = (dir: string, npmrcPath: string): string[] => {
                const args = ["publish", dir, "--tag", tag, "--access", "public", "--userconfig", npmrcPath];

                if (context.provenance) {
                    args.push("--provenance");
                }

                return args;
            };

            for (const { manifest, npmrcPath, platformDir } of platformResolved) {
                try {
                    execFileSync("npm", publishArgs(platformDir, npmrcPath), { env: { ...env, NPM_CONFIG_USERCONFIG: npmrcPath }, stdio: "inherit" });
                } catch (error) {
                    // Already-published is OK — common on idempotent re-runs.
                    const errMsg = (error as Error).message;

                    if (!errMsg.includes("EPUBLISHCONFLICT") && !errMsg.includes("cannot publish over")) {
                        throw new VisReleaseError({
                            cause: error,
                            code: "PUBLISH_FAILED",
                            message: `Failed to publish platform package ${manifest.name}@${parentNewVersion}: ${errMsg}`,
                            packageName: manifest.name,
                        });
                    }
                }
            }

            // 4. Compose the parent's manifest with optionalDependencies pinned
            //    to literal versions of the platforms. Re-use the manifests
            //    already loaded in step 2b (avoid 8 redundant fs reads).
            const parentManifest = context.versionedManifestByName.get(context.pkg.name) ?? context.pkg.manifest;
            const composed: PackageManifest = { ...parentManifest };
            const optDeps: Record<string, string> = { ...parentManifest.optionalDependencies };

            for (const { manifest: platformManifest } of platformResolved) {
                if (Object.hasOwn(optDeps, platformManifest.name)) {
                    optDeps[platformManifest.name] = parentNewVersion;
                }
            }

            composed.optionalDependencies = optDeps;

            // Resolve catalog: refs + clean
            const catalogResolved = rewriteCatalogRefs(composed, context.catalogs);
            const cleaned = cleanPackageJsonForPublish(catalogResolved, context.cleanPackageJsonConfig);

            // 5. Publish the parent. Re-use npm publish path for consistency.
            const originalParent = await readFile(context.pkg.manifestPath, "utf8");

            try {
                await writeFile(context.pkg.manifestPath, `${JSON.stringify(cleaned, null, 4)}\n`);

                assertValidPackageName(context.pkg.name);

                const auth = await resolveAuthToken(context.pkg.name, idToken, env);
                const tempDir = mkdtempSync(join(tmpdir(), "vis-release-napi-parent-"));

                tempDirs.push(tempDir);

                const npmrcPath = join(tempDir, ".npmrc");

                writeNpmrc(npmrcPath, auth.token);

                // Pack first so we can hash the tarball before publishing
                // (fed into release-asset attestation in the orchestrator).
                // `npm pack --json` emits the tarball filename; we then run
                // `npm publish <tarball>` instead of `npm publish <dir>` so
                // the publish bytes match the hashed bytes exactly.
                const packOutput = execFileSync("npm", ["pack", "--pack-destination", tempDir, "--json"], {
                    cwd: context.pkg.dir,
                    env,
                    stdio: ["ignore", "pipe", "ignore"],
                }).toString();

                let parentTarball: string | undefined;

                try {
                    const parsed = JSON.parse(packOutput) as { filename: string }[];

                    if (parsed[0]?.filename) {
                        parentTarball = join(tempDir, parsed[0].filename);
                    }
                } catch {
                    // Fall through — we'll publish from the dir below.
                }

                const tarballArgs = ["publish", parentTarball ?? context.pkg.dir, "--tag", tag, "--access", "public", "--userconfig", npmrcPath];

                if (context.provenance) {
                    tarballArgs.push("--provenance");
                }

                execFileSync("npm", tarballArgs, { env: { ...env, NPM_CONFIG_USERCONFIG: npmrcPath }, stdio: "inherit" });

                if (parentTarball) {
                    const { hashTarball } = await import("../publish-guards");
                    const hashes = await hashTarball(parentTarball);

                    return { published: true, tarball: hashes };
                }

                return { published: true };
            } finally {
                await writeFile(context.pkg.manifestPath, originalParent);
            }
        } finally {
            // Always restore platform package.jsons (even on failure) so the
            // working tree is clean for the version-PR commit.
            for (const [path, original] of platformOriginals) {
                try {
                    await writeFile(path, original);
                } catch {
                    // best-effort
                }
            }

            // Wipe every OIDC-token-bearing temp dir. Critical on multi-tenant
            // CI runners where /tmp is shared (RFC §19.4).
            for (const dir of tempDirs) {
                try {
                    await rm(dir, { force: true, recursive: true });
                } catch {
                    // best-effort
                }
            }
        }
    }
}
