/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import { findUpSync, readFileSync } from "@visulima/fs";
import { join, resolve } from "@visulima/path";
import { parse } from "jsonc-parser";

import { getPnpApi } from "./pnp";

/**
 * Resolves the version of TypeScript installed near `directoryPath` by locating
 * its `package.json` and returning the `version` field.
 *
 * Resolution order matches what `tsc` would see when invoked from
 * `directoryPath`:
 *
 * 1. Yarn Berry pnp — if running under pnp, ask the API to resolve
 * `typescript/package.json` against `directoryPath`.
 * 2. node_modules walk-up — search for `node_modules/typescript/package.json`
 * from `directoryPath` toward the filesystem root.
 *
 * Returns `undefined` if no installation is found or the `package.json` is
 * malformed.
 */
// eslint-disable-next-line import/prefer-default-export
export const detectTypeScriptVersion = (directoryPath: string): string | undefined => {
    const fromDirectory = resolve(directoryPath);

    let packageJsonPath: string | undefined;
    const pnpApi = getPnpApi(fromDirectory);

    if (pnpApi) {
        try {
            const resolved = pnpApi.resolveRequest("typescript/package.json", fromDirectory);

            packageJsonPath = resolved ?? undefined;
        } catch {
            // pnp couldn't resolve — fall through to node_modules walk
        }
    }

    packageJsonPath ??= findUpSync((directory) => join(directory, "node_modules", "typescript", "package.json"), {
        cwd: fromDirectory,
        type: "file",
    });

    if (!packageJsonPath) {
        return undefined;
    }

    try {
        const parsed = parse(readFileSync(packageJsonPath, { buffer: false })) as { version?: string } | undefined;

        if (typeof parsed?.version === "string") {
            return parsed.version;
        }
    } catch {
        // malformed JSON — treat as "not found"
    }

    return undefined;
};
