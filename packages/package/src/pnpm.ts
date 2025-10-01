import { findUp, findUpSync } from "@visulima/fs";
import { readYaml, readYamlSync } from "@visulima/fs/yaml";
import { dirname } from "@visulima/path";
import type { JsonObject } from "type-fest";

export type PnpmCatalog = Record<string, string>;

export type PnpmCatalogs = {
    catalog?: PnpmCatalog;
    catalogs?: Record<string, PnpmCatalog>;
};

/** Checks if a package directory is included in the workspace packages configuration. */
export const isPackageInWorkspace = (workspacePath: string, packagePath: string, workspacePackages: string[]): boolean => {
    const workspaceDirectory = dirname(workspacePath);
    const packageDirectory = dirname(packagePath);

    // Calculate relative path from workspace root to package directory
    const relativePath = packageDirectory === workspaceDirectory ? "." : packageDirectory.replace(`${workspaceDirectory}/`, "");

    // Check if the relative path matches any workspace package pattern
    return workspacePackages.some((pattern) => {
        if (pattern === "." && relativePath === ".") {
            return true;
        }

        // Simple glob matching for common patterns
        if (pattern.endsWith("/*")) {
            const prefix = pattern.slice(0, -2);

            return relativePath.startsWith(`${prefix}/`) || relativePath === prefix;
        }

        // Exact match
        return relativePath === pattern || relativePath.startsWith(`${pattern}/`);
    });
};

/** Reads, parses, and resolves catalogs from a pnpm-workspace file found by walking up the directory tree. */
export const readPnpmCatalogs = async (packagePath: string): Promise<PnpmCatalogs | undefined> => {
    // Find pnpm-workspace.yaml by walking up the directory tree
    const workspacePath = await findUp("pnpm-workspace.yaml", {
        cwd: dirname(packagePath),
        type: "file",
    });

    if (!workspacePath) {
        return undefined;
    }

    const workspaceData = (await readYaml(workspacePath)) as unknown as Record<string, unknown>;

    // Check if this package is actually part of the workspace
    const workspacePackages = Array.isArray(workspaceData.packages) ? (workspaceData.packages as string[]) : [];

    if (!isPackageInWorkspace(workspacePath, packagePath, workspacePackages)) {
        return undefined;
    }

    const catalogs: PnpmCatalogs = {};

    if (workspaceData.catalog && typeof workspaceData.catalog === "object") {
        catalogs.catalog = workspaceData.catalog as PnpmCatalog;
    }

    if (workspaceData.catalogs && typeof workspaceData.catalogs === "object") {
        catalogs.catalogs = workspaceData.catalogs as Record<string, PnpmCatalog>;
    }

    return Object.keys(catalogs).length > 0 ? catalogs : undefined;
};

/** Reads, parses, and resolves catalogs from a pnpm-workspace file found by walking up the directory tree (synchronous). */
export const readPnpmCatalogsSync = (packagePath: string): PnpmCatalogs | undefined => {
    // Find pnpm-workspace.yaml by walking up the directory tree
    const workspacePath = findUpSync("pnpm-workspace.yaml", {
        cwd: dirname(packagePath),
        type: "file",
    });

    if (!workspacePath) {
        return undefined;
    }

    const workspaceData = readYamlSync(workspacePath) as unknown as Record<string, unknown>;

    // Check if this package is actually part of the workspace
    const workspacePackages = Array.isArray(workspaceData.packages) ? (workspaceData.packages as string[]) : [];

    if (!isPackageInWorkspace(workspacePath, packagePath, workspacePackages)) {
        return undefined;
    }

    const catalogs: PnpmCatalogs = {};

    if (workspaceData.catalog && typeof workspaceData.catalog === "object") {
        catalogs.catalog = workspaceData.catalog as PnpmCatalog;
    }

    if (workspaceData.catalogs && typeof workspaceData.catalogs === "object") {
        catalogs.catalogs = workspaceData.catalogs as Record<string, PnpmCatalog>;
    }

    return Object.keys(catalogs).length > 0 ? catalogs : undefined;
};

/** Resolves a single catalog reference to its actual version. */
export const resolveCatalogReference = (packageName: string, versionSpec: string, catalogs: PnpmCatalogs): string | undefined => {
    if (versionSpec === "catalog:") {
        // Use default catalog
        return catalogs.catalog?.[packageName];
    }

    if (versionSpec.startsWith("catalog:")) {
        // Use named catalog
        const catalogName = versionSpec.slice(8); // Remove "catalog:" prefix

        return catalogs.catalogs?.[catalogName]?.[packageName];
    }

    return undefined;
};

/** Resolves catalog references in a single dependency object. */
export const resolveDependenciesCatalogReferences = (dependencies: Record<string, string>, catalogs: PnpmCatalogs): void => {
    for (const [packageName, versionSpec] of Object.entries(dependencies)) {
        if (typeof versionSpec !== "string") {
            continue;
        }

        const resolvedVersion = resolveCatalogReference(packageName, versionSpec, catalogs);

        if (resolvedVersion) {
            // eslint-disable-next-line no-param-reassign
            dependencies[packageName] = resolvedVersion;
        }
    }
};

/** Resolves catalog references in package.json dependencies using the provided catalogs. */
export const resolveCatalogReferences = (packageJson: JsonObject, catalogs: PnpmCatalogs): void => {
    const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

    for (const field of dependencyFields) {
        if (!packageJson[field] || typeof packageJson[field] !== "object") {
            continue;
        }

        const dependencies = packageJson[field] as Record<string, string>;

        resolveDependenciesCatalogReferences(dependencies, catalogs);
    }
};
