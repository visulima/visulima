/**
 * semantic-release plugin that publishes NAPI-style native binding platform
 * packages (under ./npm/<platform>/) before the main package is published, and
 * patches the host package's index.js so the NAPI version-check string matches
 * the version semantic-release just bumped to (otherwise loaders running with
 * NAPI_RS_ENFORCE_VERSION_CHECK=1 throw on every install of the new release).
 *
 * Why a plugin instead of @semantic-release/exec?
 * - Runs inside semantic-release's lifecycle with context.{cwd,env,logger},
 *   proper AggregateError surfacing, and no extra node child process.
 * - verifyConditions fails the release early if neither OIDC nor NPM_TOKEN
 *   is available — @semantic-release/exec would only discover this mid-prepare.
 *
 * Auth path (mirrors @anolilab/semantic-release-pnpm/src/trusted-publishing/*):
 * 1. If GH Actions OIDC is available (ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN),
 *    request an id-token scoped to "npm:registry.npmjs.org".
 * 2. For every platform package, exchange it at
 *    https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/<name>
 *    and use the returned short-lived token in a per-package temp .npmrc.
 * 3. Fall back to NPM_TOKEN if OIDC isn't available or a package isn't yet
 *    configured as a trusted publisher on npm.
 *
 * Registered via .releaserc.json plugins array:
 *   "../../../scripts/semantic-release-native-addons.mjs"
 * Run by semantic-release during `verifyConditions` + `prepare`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
const OIDC_AUDIENCE = "npm:registry.npmjs.org";

const getNpmTag = (version) => {
    if (version.includes("-alpha.")) {
        return "alpha";
    }

    if (version.includes("-beta.")) {
        return "beta";
    }

    if (version.includes("-rc.")) {
        return "next";
    }

    return "latest";
};

// Platform packages live under `./npm/<platform>/` (the napi binding addons) and
// `./launcher/npm/<platform>/` (the Rust launcher binaries). Both are published the
// same way (set version → pnpm publish); only the host index.js version-check patch
// (below) is napi-specific and stays scoped to the binding host.
const PLATFORM_PACKAGE_BASES = ["npm", join("launcher", "npm")];

const getPlatformPackagePaths = async (cwd) => {
    const paths = [];

    for (const base of PLATFORM_PACKAGE_BASES) {
        const baseDir = join(cwd, base);

        if (!existsSync(baseDir)) {
            continue;
        }

        const entries = await readdir(baseDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory() && existsSync(join(baseDir, entry.name, "package.json"))) {
                paths.push(join(baseDir, entry.name));
            }
        }
    }

    return paths;
};

const getGithubActionsIdToken = async (env, logger) => {
    const requestUrl = env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const requestToken = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

    if (!requestUrl || !requestToken) {
        return undefined;
    }

    const url = `${requestUrl}${requestUrl.includes("?") ? "&" : "?"}audience=${encodeURIComponent(OIDC_AUDIENCE)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });

    if (!response.ok) {
        logger.warn(`GitHub Actions OIDC id-token request failed: ${response.status} ${response.statusText}`);

        return undefined;
    }

    const body = await response.json().catch(() => undefined);

    return typeof body?.value === "string" ? body.value : undefined;
};

const exchangeOidcTokenForPackage = async (packageName, idToken, logger) => {
    const response = await fetch(`${OFFICIAL_REGISTRY}-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(packageName)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        method: "POST",
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        logger.warn(`OIDC token exchange failed for ${packageName}: ${response.status} ${body?.message ?? response.statusText}`);

        return undefined;
    }

    return typeof body?.token === "string" ? body.token : undefined;
};

const resolveAuthToken = async (packageName, idToken, env, logger) => {
    if (idToken) {
        const oidcToken = await exchangeOidcTokenForPackage(packageName, idToken, logger);

        if (oidcToken) {
            return { source: "oidc", token: oidcToken };
        }
    }

    if (env.NPM_TOKEN) {
        return { source: "NPM_TOKEN", token: env.NPM_TOKEN };
    }

    throw new Error(`Cannot publish ${packageName}: OIDC exchange did not succeed and NPM_TOKEN is not set.`);
};

const writeNpmrc = (path, token) => {
    writeFileSync(path, `//registry.npmjs.org/:_authToken=${token}\nregistry=${OFFICIAL_REGISTRY}\n`);
};

// napi-rs hard-codes the host package's version into the runtime version-check
// error string, generated per platform branch in index.js. The string is emitted
// by @napi-rs/cli's loader template (see packages/cli/src/api/templates/load-host.ts
// in napi-rs/napi-rs) — if napi-rs changes that template, this regex needs to
// follow. We validate that we matched at least one occurrence to fail loudly
// rather than silently shipping a stale version on the next codegen drift.
const VERSION_CHECK_PATTERN = /expected \S+ but got \$\{bindingPackageVersion\}/g;

export const patchVersionCheck = (content, version) => {
    const matches = content.match(VERSION_CHECK_PATTERN);

    if (!matches || matches.length === 0) {
        throw new Error(
            "index.js contains no NAPI version-check strings — napi-rs codegen format may have changed. Update VERSION_CHECK_PATTERN in scripts/semantic-release-native-addons.mjs.",
        );
    }

    const replacement = `expected ${version} but got \${bindingPackageVersion}`;

    return { count: matches.length, patched: content.replace(VERSION_CHECK_PATTERN, replacement) };
};

export const verifyConditions = async (_pluginConfig, context) => {
    const { cwd, env, logger } = context;
    const platformPaths = await getPlatformPackagePaths(cwd);

    if (platformPaths.length === 0) {
        logger.log("No native addon packages found; nothing to do.");

        return;
    }

    const hasOidc = Boolean(env.ACTIONS_ID_TOKEN_REQUEST_URL && env.ACTIONS_ID_TOKEN_REQUEST_TOKEN);
    const hasNpmToken = Boolean(env.NPM_TOKEN);

    if (!hasOidc && !hasNpmToken) {
        throw new Error(
            "Cannot publish native addons: no authentication available. Set NPM_TOKEN, or run in a GitHub Actions workflow with `id-token: write`.",
        );
    }

    logger.log(`Verified auth for ${platformPaths.length} native package(s) — OIDC: ${hasOidc}, NPM_TOKEN: ${hasNpmToken}`);
};

export const prepare = async (_pluginConfig, context) => {
    const { cwd, env, logger, nextRelease } = context;
    const platformPaths = await getPlatformPackagePaths(cwd);

    if (platformPaths.length === 0) {
        return;
    }

    const { version } = nextRelease;
    const npmTag = getNpmTag(version);

    logger.log(`Publishing ${platformPaths.length} native package(s) at version ${version} with tag ${npmTag}`);

    const indexPath = join(cwd, "index.js");

    if (existsSync(indexPath)) {
        const original = readFileSync(indexPath, "utf-8");
        const { count, patched } = patchVersionCheck(original, version);

        if (patched !== original) {
            writeFileSync(indexPath, patched);
            logger.log(`Patched ${count} NAPI version-check string(s) in index.js to ${version}`);
        }
    }

    const idToken = await getGithubActionsIdToken(env, logger);

    if (!idToken) {
        logger.log("No GitHub Actions OIDC context detected; falling back to NPM_TOKEN.");
    }

    const authTempDir = mkdtempSync(join(tmpdir(), "semantic-release-native-addons-"));

    try {
        for (const platformPath of platformPaths) {
            const pkgPath = join(platformPath, "package.json");
            let pkg;
            let originalVersion;

            try {
                pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
                originalVersion = pkg.version;
            } catch {
                continue;
            }

            // A binary platform package (files: ["bin/"], e.g. the launcher) with no
            // staged binary would publish empty — skip it until the CI step that
            // downloads the built binary into <pkg>/bin/ is wired. Binding addons
            // (files: the .node name) are unaffected by this guard.
            if (Array.isArray(pkg.files) && pkg.files.includes("bin/")) {
                const binDir = join(platformPath, "bin");
                const staged = existsSync(binDir) && (await readdir(binDir)).length > 0;

                if (!staged) {
                    logger.warn(`Skipping ${pkg.name}: no binary staged in bin/ (build artifact not present).`);

                    continue;
                }
            }

            pkg.version = version;
            writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");

            const auth = await resolveAuthToken(pkg.name, idToken, env, logger);
            // Keyed by package name so npm/<t> and launcher/npm/<t> never collide.
            const npmrcPath = join(authTempDir, `${pkg.name.replace(/[^a-z0-9]+/giu, "_")}.npmrc`);

            writeNpmrc(npmrcPath, auth.token);

            try {
                const output = execFileSync("pnpm", ["publish", platformPath, "--tag", npmTag, "--access", "public", "--no-git-checks"], {
                    cwd,
                    encoding: "utf-8",
                    env: { ...env, NPM_CONFIG_USERCONFIG: npmrcPath },
                    stdio: "pipe",
                });

                logger.log(output.trimEnd());
                logger.log(`Published ${pkg.name}@${version} (auth: ${auth.source})`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);

                if (message.includes("You cannot publish over the previously published versions")) {
                    logger.warn(`${pkg.name}@${version} already published, skipping`);
                } else {
                    pkg.version = originalVersion;
                    writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");

                    throw new AggregateError([error instanceof Error ? error : new Error(message)], `Failed to publish ${pkg.name}@${version}`);
                }
            }
        }

        logger.log("All native addon packages published successfully");
    } finally {
        rmSync(authTempDir, { force: true, recursive: true });
    }
};
