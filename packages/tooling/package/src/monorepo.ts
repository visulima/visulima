import { existsSync, readFileSync } from "node:fs";

import { findUp, findUpSync, readJson, readJsonSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { parseJson } from "@visulima/fs/utils";
import { dirname, join } from "@visulima/path";

import { findPackageManager, findPackageManagerSync } from "./package-manager";

/**
 * Determines whether a raw package.json string declares a `workspaces` field.
 * Parses the content and confirms the field is a non-null object (npm/yarn accept
 * either an array or a `{ packages, nohoist }` object) rather than matching the bare
 * substring `workspaces`, which any description/keyword/dependency name could contain.
 * @param rawPackageJson The raw package.json file content.
 * @returns `true` when a workspaces field is present and object-shaped.
 */
const hasWorkspacesField = (rawPackageJson: string): boolean => {
    let parsed: unknown;

    try {
        parsed = parseJson(rawPackageJson);
    } catch {
        return false;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return false;
    }

    const workspaces = (parsed as { workspaces?: unknown }).workspaces;

    return typeof workspaces === "object" && workspaces !== null;
};

export type Strategy = "lerna" | "npm" | "pnpm" | "turbo" | "yarn";

export interface RootMonorepo<T extends Strategy = Strategy> {
    path: string;
    strategy: T;
}

/**
 * An asynchronous function to find the root directory path and strategy for a monorepo based on
 * the given current working directory (cwd).
 * @param cwd The current working directory. The type of `cwd` is part of an `Options` type, specifically `Options["cwd"]`.
 * Default is undefined.
 * @returns A `Promise` that resolves to the root directory path and strategy for the monorepo.
 * The type of the returned promise is `Promise&lt;RootMonorepo>`.
 * @throws An `Error` if no monorepo root can be found using lerna, yarn, pnpm, or npm as indicators.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const findMonorepoRoot = async (cwd?: URL | string): Promise<RootMonorepo> => {
    const workspaceFilePath: string | undefined = await findUp(["lerna.json", "turbo.json"], {
        type: "file",
        ...cwd && { cwd },
    });

    if (workspaceFilePath?.endsWith("lerna.json")) {
        const lerna = await readJson(workspaceFilePath);

        if (lerna && typeof lerna === "object" && !Array.isArray(lerna)) {
            const l = lerna as { packages?: unknown; useWorkspaces?: unknown };

            if (l.useWorkspaces || l.packages) {
                return {
                    path: dirname(workspaceFilePath),
                    strategy: "lerna",
                };
            }
        }
    }

    const isTurbo: boolean | undefined = workspaceFilePath?.endsWith("turbo.json");

    try {
        const { packageManager, path } = await findPackageManager(cwd);

        if (["npm", "yarn"].includes(packageManager)) {
            const packageJsonFilePath = join(path, "package.json");

            if (existsSync(packageJsonFilePath)) {
                const packageJson = readFileSync(join(path, "package.json"), "utf8");

                if (hasWorkspacesField(packageJson)) {
                    return {
                        path,
                        strategy: isTurbo ? "turbo" : (packageManager as "npm" | "yarn"),
                    };
                }
            }
        } else if (packageManager === "pnpm") {
            const pnpmWorkspacesFilePath = join(path, "pnpm-workspace.yaml");

            if (existsSync(pnpmWorkspacesFilePath)) {
                return {
                    path,
                    strategy: isTurbo ? "turbo" : "pnpm",
                };
            }
        }
    } catch (error: unknown) {
        // Skip this error to show the error message from the next block
        if (!(error instanceof NotFoundError)) {
            throw error;
        }
    }

    throw new Error(
        `No monorepo root could be found upwards from the directory ${String(cwd ?? process.cwd())} using lerna, yarn, pnpm, or npm as indicators.`,
    );
};

/**
 * An function to find the root directory path and strategy for a monorepo based on
 * the given current working directory (cwd).
 * @param cwd The current working directory. The type of `cwd` is part of an `Options` type, specifically `Options["cwd"]`.
 * Default is undefined.
 * @returns A `Promise` that resolves to the root directory path and strategy for the monorepo.
 * The type of the returned promise is `Promise&lt;RootMonorepo>`.
 * @throws An `Error` if no monorepo root can be found using lerna, yarn, pnpm, or npm as indicators.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const findMonorepoRootSync = (cwd?: URL | string): RootMonorepo => {
    const workspaceFilePath: string | undefined = findUpSync(["lerna.json", "turbo.json"], {
        type: "file",
        ...cwd && { cwd },
    });

    if (workspaceFilePath?.endsWith("lerna.json")) {
        const lerna = readJsonSync(workspaceFilePath);

        if (lerna && typeof lerna === "object" && !Array.isArray(lerna)) {
            const l = lerna as { packages?: unknown; useWorkspaces?: unknown };

            if (l.useWorkspaces || l.packages) {
                return {
                    path: dirname(workspaceFilePath),
                    strategy: "lerna",
                };
            }
        }
    }

    const isTurbo: boolean | undefined = workspaceFilePath?.endsWith("turbo.json");

    try {
        const { packageManager, path } = findPackageManagerSync(cwd);

        if (["npm", "yarn"].includes(packageManager)) {
            const packageJsonFilePath = join(path, "package.json");

            if (existsSync(packageJsonFilePath)) {
                const packageJson = readFileSync(join(path, "package.json"), "utf8");

                if (hasWorkspacesField(packageJson)) {
                    return {
                        path,
                        strategy: isTurbo ? "turbo" : (packageManager as "npm" | "yarn"),
                    };
                }
            }
        } else if (packageManager === "pnpm") {
            const pnpmWorkspacesFilePath = join(path, "pnpm-workspace.yaml");

            if (existsSync(pnpmWorkspacesFilePath)) {
                return {
                    path,
                    strategy: isTurbo ? "turbo" : "pnpm",
                };
            }
        }
    } catch (error: unknown) {
        // Skip this error to show the error message from the next block
        if (!(error instanceof NotFoundError)) {
            throw error;
        }
    }

    throw new Error(
        `No monorepo root could be found upwards from the directory ${String(cwd ?? process.cwd())} using lerna, yarn, pnpm, or npm as indicators.`,
    );
};
