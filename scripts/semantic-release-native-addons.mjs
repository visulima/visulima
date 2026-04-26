/**
 * semantic-release plugin that publishes NAPI-style native binding platform
 * packages (under ./npm/<platform>/) before the main package is published.
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

const getPlatformDirs = async (cwd) => {
    const npmDir = join(cwd, "npm");

    if (!existsSync(npmDir)) {
        return [];
    }

    return (await readdir(npmDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
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

export const verifyConditions = async (_pluginConfig, context) => {
    const { cwd, env, logger } = context;
    const platformDirs = await getPlatformDirs(cwd);

    if (platformDirs.length === 0) {
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

    logger.log(`Verified auth for ${platformDirs.length} native addon package(s) — OIDC: ${hasOidc}, NPM_TOKEN: ${hasNpmToken}`);
};

export const prepare = async (_pluginConfig, context) => {
    const { cwd, env, logger, nextRelease } = context;
    const platformDirs = await getPlatformDirs(cwd);

    if (platformDirs.length === 0) {
        return;
    }

    const { version } = nextRelease;
    const npmTag = getNpmTag(version);
    const npmDir = join(cwd, "npm");

    logger.log(`Publishing ${platformDirs.length} native addon package(s) at version ${version} with tag ${npmTag}`);

    const idToken = await getGithubActionsIdToken(env, logger);

    if (!idToken) {
        logger.log("No GitHub Actions OIDC context detected; falling back to NPM_TOKEN.");
    }

    const authTempDir = mkdtempSync(join(tmpdir(), "semantic-release-native-addons-"));

    try {
        for (const dir of platformDirs) {
            const platformPath = join(npmDir, dir);
            const pkgPath = join(platformPath, "package.json");
            let pkg;
            let originalVersion;

            try {
                pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
                originalVersion = pkg.version;
            } catch {
                continue;
            }

            pkg.version = version;
            writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");

            const auth = await resolveAuthToken(pkg.name, idToken, env, logger);
            const npmrcPath = join(authTempDir, `${dir}.npmrc`);

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
