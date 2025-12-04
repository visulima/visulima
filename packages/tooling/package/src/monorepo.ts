import { existsSync, readFileSync } from "node:fs";

import { findUp, findUpSync, readJson, readJsonSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { dirname, join } from "@visulima/path";

import { findPackageManager, findPackageManagerSync } from "./package-manager";

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
    const workspaceFilePath = await findUp(["lerna.json", "turbo.json"], {
        type: "file",
        ...(cwd && { cwd }),
    });

    if (workspaceFilePath?.endsWith("lerna.json")) {
        const lerna = await readJson<{ packages?: string[]; useWorkspaces?: boolean }>(workspaceFilePath);

        if (lerna.useWorkspaces || lerna.packages) {
            return {
                path: dirname(workspaceFilePath),
                strategy: "lerna",
            };
        }
    }

    const isTurbo = workspaceFilePath?.endsWith("turbo.json");

    try {
        const { packageManager, path } = await findPackageManager(cwd);

        if (["npm", "yarn"].includes(packageManager)) {
            const packageJsonFilePath = join(path, "package.json");

            if (existsSync(packageJsonFilePath)) {
                const packageJson = readFileSync(join(path, "package.json"), "utf8");

                if (packageJson.includes("workspaces")) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // Skip this error to show the error message from the next block
        if (!(error instanceof NotFoundError)) {
            throw error;
        }
    }

    throw new Error(`No monorepo root could be found upwards from the directory ${cwd as string} using lerna, yarn, pnpm, or npm as indicators.`);
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
    const workspaceFilePath = findUpSync(["lerna.json", "turbo.json"], {
        type: "file",
        ...(cwd && { cwd }),
    });

    if (workspaceFilePath?.endsWith("lerna.json")) {
        const lerna = readJsonSync<{ packages?: string[]; useWorkspaces?: boolean }>(workspaceFilePath);

        if (lerna.useWorkspaces || lerna.packages) {
            return {
                path: dirname(workspaceFilePath),
                strategy: "lerna",
            };
        }
    }

    const isTurbo = workspaceFilePath?.endsWith("turbo.json");

    try {
        const { packageManager, path } = findPackageManagerSync(cwd);

        if (["npm", "yarn"].includes(packageManager)) {
            const packageJsonFilePath = join(path, "package.json");

            if (existsSync(packageJsonFilePath)) {
                const packageJson = readFileSync(join(path, "package.json"), "utf8");

                if (packageJson.includes("workspaces")) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // Skip this error to show the error message from the next block
        if (!(error instanceof NotFoundError)) {
            throw error;
        }
    }

    throw new Error(`No monorepo root could be found upwards from the directory ${cwd as string} using lerna, yarn, pnpm, or npm as indicators.`);
};
