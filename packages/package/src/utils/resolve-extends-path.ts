/**
 * A modified version of `resolveExtendsPath` from `https://github.com/privatenumber/get-tsconfig/blob/develop/src/parse-tsconfig/resolve-extends-path.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
import { existsSync, statSync } from "node:fs";
import Module from "node:module";
import { isAbsolute, join, resolve } from "node:path";

import { findUpSync, readFileSync } from "@visulima/fs";
import { parse } from "jsonc-parser";
import type { PathConditions } from "resolve-pkg-maps";
import { resolveExports } from "resolve-pkg-maps";
import type { PackageJson } from "type-fest";

import type { Cache } from "../types";

const readJsonc = (jsonPath: string) => parse(readFileSync(jsonPath) as string) as unknown;

const getPnpApi = () => {
    // @ts-expect-error
    const { findPnpApi } = Module;

    // https://yarnpkg.com/advanced/pnpapi/#requirepnpapi
    return findPnpApi?.(process.cwd());
};

const resolveFromPackageJsonPath = (packageJsonPath: string, subpath: string, ignoreExports?: boolean, cache?: Cache<string>) => {
    const cacheKey = `resolveFromPackageJsonPath:${packageJsonPath}:${subpath}:${ignoreExports}`;

    if (cache?.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const packageJson = readJsonc(packageJsonPath);

    if (!packageJson) {
        return undefined;
    }

    let resolvedPath = subpath || "tsconfig.json";

    if (!ignoreExports && (packageJson as PackageJson).exports) {
        try {
            const [resolvedExport] = resolveExports((packageJson as PackageJson).exports as PathConditions, subpath, ["require", "types"]);

            resolvedPath = resolvedExport as string;
        } catch {
            // Block
            return false;
        }
    } else if (!subpath && (packageJson as PackageJson).tsconfig) {
        resolvedPath = (packageJson as PackageJson).tsconfig as string;
    }

    resolvedPath = join(packageJsonPath, "..", resolvedPath);

    cache?.set(cacheKey, resolvedPath);

    return resolvedPath;
};

const PACKAGE_JSON = "package.json";
const TS_CONFIG_JSON = "tsconfig.json";

// eslint-disable-next-line sonarjs/cognitive-complexity
const resolveExtendsPath = (requestedPath: string, directoryPath: string, cache?: Cache<string>): string | undefined => {
    let filePath = requestedPath;

    if (requestedPath === "..") {
        filePath = join(filePath, TS_CONFIG_JSON);
    }

    if (requestedPath.startsWith(".")) {
        filePath = resolve(directoryPath, filePath);
    }

    if (isAbsolute(filePath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (existsSync(filePath)) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            if (statSync(filePath).isFile()) {
                return filePath;
            }
        } else if (!filePath.endsWith(".json")) {
            const jsonPath = `${filePath}.json`;

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            if (existsSync(jsonPath)) {
                return jsonPath;
            }
        }

        return undefined;
    }

    const [orgOrName, ...remaining] = requestedPath.split("/");
    const packageName = ((orgOrName as string).startsWith("@") ? `${orgOrName}/${remaining.shift()}` : orgOrName) as string;
    const subpath = remaining.join("/");

    const pnpApi = getPnpApi();

    if (pnpApi) {
        const { resolveRequest: resolveWithPnp } = pnpApi;

        try {
            if (packageName === requestedPath) {
                const packageJsonPath = resolveWithPnp(join(packageName, PACKAGE_JSON), directoryPath);

                if (packageJsonPath) {
                    const resolvedPath = resolveFromPackageJsonPath(packageJsonPath, subpath, false, cache);

                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    if (resolvedPath && existsSync(resolvedPath)) {
                        return resolvedPath;
                    }
                }
            } else {
                let resolved: string | null;

                try {
                    resolved = resolveWithPnp(requestedPath, directoryPath, { extensions: [".json"] });
                } catch {
                    resolved = resolveWithPnp(join(requestedPath, TS_CONFIG_JSON), directoryPath);
                }

                if (resolved) {
                    return resolved;
                }
            }
        } catch {
            /* empty */
        }
    }

    const packagePath = findUpSync(
        (directory) => {
            const path = join(directory, "node_modules", packageName);

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            if (existsSync(path)) {
                return join("node_modules", packageName);
            }

            return undefined;
        },
        {
            cwd: directoryPath,
            type: "directory",
        },
    );

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!packagePath || !statSync(packagePath).isDirectory()) {
        return undefined;
    }

    const packageJsonPath = join(packagePath, PACKAGE_JSON);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(packageJsonPath)) {
        const resolvedPath = resolveFromPackageJsonPath(packageJsonPath, subpath, false, cache);

        // Blocked
        if (resolvedPath === false) {
            return undefined;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (resolvedPath && existsSync(resolvedPath) && statSync(resolvedPath).isFile()) {
            return resolvedPath;
        }
    }

    const fullPackagePath = join(packagePath, subpath);
    const jsonExtension = fullPackagePath.endsWith(".json");

    if (!jsonExtension) {
        const fullPackagePathWithJson = `${fullPackagePath}.json`;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (existsSync(fullPackagePathWithJson)) {
            return fullPackagePathWithJson;
        }
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(fullPackagePath)) {
        return undefined;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (statSync(fullPackagePath).isDirectory()) {
        const fullPackageJsonPath = join(fullPackagePath, PACKAGE_JSON);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (existsSync(fullPackageJsonPath)) {
            const resolvedPath = resolveFromPackageJsonPath(fullPackageJsonPath, "", true, cache);

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            if (resolvedPath && existsSync(resolvedPath)) {
                return resolvedPath;
            }
        }

        const tsconfigPath = join(fullPackagePath, TS_CONFIG_JSON);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (existsSync(tsconfigPath)) {
            return tsconfigPath;
        }
    } else if (jsonExtension) {
        return fullPackagePath;
    }

    return undefined;
};

export default resolveExtendsPath;
