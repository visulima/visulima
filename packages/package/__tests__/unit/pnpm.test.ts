import { writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";

import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PnpmCatalogs } from "../../src/pnpm";
import {
    isPackageInWorkspace,
    readPnpmCatalogs,
    readPnpmCatalogsSync,
    resolveCatalogReference,
    resolveCatalogReferences,
    resolveDependenciesCatalogReferences,
} from "../../src/pnpm";

describe("pnpm", () => {
    let temporaryDirection: string;

    beforeEach(() => {
        temporaryDirection = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(temporaryDirection, { recursive: true });
    });

    describe(isPackageInWorkspace, () => {
        it("should return true for packages in workspace with /* pattern", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "packages", "my-package", "package.json");
            const workspacePackages = ["packages/*"];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(true);
        });

        it("should return false for packages outside workspace with /* pattern", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "other", "my-package", "package.json");
            const workspacePackages = ["packages/*"];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(false);
        });

        it("should return true for exact pattern match", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "apps", "my-app", "package.json");
            const workspacePackages = ["apps/my-app"];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(true);
        });

        it("should return true for root workspace package", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "package.json");
            const workspacePackages = ["."];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(true);
        });

        it("should return false for empty workspace packages", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "packages", "my-package", "package.json");
            const workspacePackages: string[] = [];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(false);
        });

        it("should return true for packages in workspace with /** recursive pattern", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "packages", "nested", "deep", "my-package", "package.json");
            const workspacePackages = ["packages/**"];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(true);
        });

        it("should return true for packages in workspace with /** pattern matching exact directory", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "packages", "package.json");
            const workspacePackages = ["packages/**"];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(true);
        });

        it("should return false for packages outside workspace with /** pattern", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "other", "nested", "deep", "my-package", "package.json");
            const workspacePackages = ["packages/**"];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(false);
        });

        it("should handle leading ./ in patterns", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "packages", "my-package", "package.json");
            const workspacePackages = ["./packages/*"];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(true);
        });

        it("should handle leading ./ in recursive patterns", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "packages", "nested", "deep", "my-package", "package.json");
            const workspacePackages = ["./packages/**"];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(true);
        });

        it("should handle leading ./ in relative paths", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const packagePath = join(temporaryDirection, "packages", "my-package", "package.json");
            const workspacePackages = ["packages/*"];

            const result = isPackageInWorkspace(workspacePath, packagePath, workspacePackages);

            expect(result).toBe(true);
        });
    });

    describe(readPnpmCatalogs, () => {
        it("should read catalogs from pnpm-workspace.yaml in same directory", async () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const workspaceContent = {
                catalog: {
                    react: "^18.0.0",
                    typescript: "^5.0.0",
                },
                packages: ["packages/*"],
            };

            // eslint-disable-next-line unicorn/no-null
            writeFileSync(workspacePath, JSON.stringify(workspaceContent, null, 2));

            const packagePath = join(temporaryDirection, "packages", "my-package", "package.json");
            const result = await readPnpmCatalogs(packagePath);

            expect(result).toStrictEqual({
                catalog: {
                    react: "^18.0.0",
                    typescript: "^5.0.0",
                },
            });
        });

        it("should read catalogs from pnpm-workspace.yaml in parent directory", async () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const workspaceContent = {
                catalog: {
                    react: "^18.0.0",
                },
                packages: ["packages/*"],
            };

            // eslint-disable-next-line unicorn/no-null
            writeFileSync(workspacePath, JSON.stringify(workspaceContent, null, 2));

            const packagePath = join(temporaryDirection, "packages", "nested", "deep", "my-package", "package.json");
            const result = await readPnpmCatalogs(packagePath);

            expect(result).toStrictEqual({
                catalog: {
                    react: "^18.0.0",
                },
            });
        });

        it("should return undefined when package is not in workspace", async () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const workspaceContent = {
                catalog: {
                    react: "^18.0.0",
                },
                packages: ["packages/*"],
            };

            // eslint-disable-next-line unicorn/no-null
            writeFileSync(workspacePath, JSON.stringify(workspaceContent, null, 2));

            const packagePath = join(temporaryDirection, "other", "my-package", "package.json");
            const result = await readPnpmCatalogs(packagePath);

            expect(result).toBeUndefined();
        });

        it("should return undefined when no pnpm-workspace.yaml exists", async () => {
            expect.assertions(1);

            const packagePath = join(temporaryDirection, "packages", "my-package", "package.json");
            const result = await readPnpmCatalogs(packagePath);

            expect(result).toBeUndefined();
        });

        it("should read named catalogs", async () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const workspaceContent = {
                catalog: {
                    react: "^18.0.0",
                },
                catalogs: {
                    next: {
                        react: "^19.0.0",
                    },
                },
                packages: ["packages/*"],
            };

            // eslint-disable-next-line unicorn/no-null
            writeFileSync(workspacePath, JSON.stringify(workspaceContent, null, 2));

            const packagePath = join(temporaryDirection, "packages", "my-package", "package.json");
            const result = await readPnpmCatalogs(packagePath);

            expect(result).toStrictEqual({
                catalog: {
                    react: "^18.0.0",
                },
                catalogs: {
                    next: {
                        react: "^19.0.0",
                    },
                },
            });
        });
    });

    describe(readPnpmCatalogsSync, () => {
        it("should read catalogs synchronously", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const workspaceContent = {
                catalog: {
                    react: "^18.0.0",
                },
                packages: ["packages/*"],
            };

            // eslint-disable-next-line unicorn/no-null
            writeFileSync(workspacePath, JSON.stringify(workspaceContent, null, 2));

            const packagePath = join(temporaryDirection, "packages", "my-package", "package.json");
            const result = readPnpmCatalogsSync(packagePath);

            expect(result).toStrictEqual({
                catalog: {
                    react: "^18.0.0",
                },
            });
        });

        it("should return undefined when package is not in workspace", () => {
            expect.assertions(1);

            const workspacePath = join(temporaryDirection, "pnpm-workspace.yaml");
            const workspaceContent = {
                catalog: {
                    react: "^18.0.0",
                },
                packages: ["packages/*"],
            };

            // eslint-disable-next-line unicorn/no-null
            writeFileSync(workspacePath, JSON.stringify(workspaceContent, null, 2));

            const packagePath = join(temporaryDirection, "other", "my-package", "package.json");
            const result = readPnpmCatalogsSync(packagePath);

            expect(result).toBeUndefined();
        });
    });

    describe(resolveCatalogReference, () => {
        const catalogs: PnpmCatalogs = {
            catalog: {
                react: "^18.0.0",
                typescript: "^5.0.0",
            },
            catalogs: {
                next: {
                    react: "^19.0.0",
                },
            },
        };

        it("should resolve default catalog references", () => {
            expect.assertions(1);

            const result = resolveCatalogReference("react", "catalog:", catalogs);

            expect(result).toBe("^18.0.0");
        });

        it("should resolve named catalog references", () => {
            expect.assertions(1);

            const result = resolveCatalogReference("react", "catalog:next", catalogs);

            expect(result).toBe("^19.0.0");
        });

        it("should return undefined for non-catalog references", () => {
            expect.assertions(1);

            const result = resolveCatalogReference("react", "^17.0.0", catalogs);

            expect(result).toBeUndefined();
        });

        it("should return undefined for unknown packages", () => {
            expect.assertions(1);

            const result = resolveCatalogReference("unknown-package", "catalog:", catalogs);

            expect(result).toBeUndefined();
        });

        it("should return undefined for unknown named catalogs", () => {
            expect.assertions(1);

            const result = resolveCatalogReference("react", "catalog:unknown", catalogs);

            expect(result).toBeUndefined();
        });
    });

    describe(resolveDependenciesCatalogReferences, () => {
        const catalogs: PnpmCatalogs = {
            catalog: {
                react: "^18.0.0",
                typescript: "^5.0.0",
            },
        };

        it("should resolve catalog references in dependencies object", () => {
            expect.assertions(1);

            const dependencies: Record<string, string> = {
                lodash: "^4.17.0", // Non-catalog reference should remain unchanged
                react: "catalog:",
                typescript: "catalog:",
            };

            resolveDependenciesCatalogReferences(dependencies, catalogs);

            expect(dependencies).toStrictEqual({
                lodash: "^4.17.0",
                react: "^18.0.0",
                typescript: "^5.0.0",
            });
        });

        it("should skip non-string version specs", () => {
            expect.assertions(1);

            const dependencies: Record<string, string> = {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                invalid: 123 as any,
                react: "catalog:",
            };

            resolveDependenciesCatalogReferences(dependencies, catalogs);

            expect(dependencies).toStrictEqual({
                invalid: 123,
                react: "^18.0.0",
            });
        });
    });

    describe(resolveCatalogReferences, () => {
        const catalogs: PnpmCatalogs = {
            catalog: {
                react: "^18.0.0",
                typescript: "^5.0.0",
            },
        };

        it("should resolve catalog references in all dependency fields", () => {
            expect.assertions(1);

            const packageJson = {
                dependencies: {
                    lodash: "^4.17.0",
                    react: "catalog:",
                },
                devDependencies: {
                    "@types/node": "^20.0.0",
                    typescript: "catalog:",
                },
                optionalDependencies: {
                    typescript: "catalog:",
                },
                peerDependencies: {
                    react: "catalog:",
                },
            };

            resolveCatalogReferences(packageJson, catalogs);

            expect(packageJson).toStrictEqual({
                dependencies: {
                    lodash: "^4.17.0",
                    react: "^18.0.0",
                },
                devDependencies: {
                    "@types/node": "^20.0.0",
                    typescript: "^5.0.0",
                },
                optionalDependencies: {
                    typescript: "^5.0.0",
                },
                peerDependencies: {
                    react: "^18.0.0",
                },
            });
        });

        it("should skip fields that are not objects", () => {
            expect.assertions(1);

            const packageJson = {
                dependencies: "invalid",
                devDependencies: {
                    typescript: "catalog:",
                },
            };

            resolveCatalogReferences(packageJson, catalogs);

            expect(packageJson).toStrictEqual({
                dependencies: "invalid",
                devDependencies: {
                    typescript: "^5.0.0",
                },
            });
        });

        it("should skip fields that don't exist", () => {
            expect.assertions(1);

            const packageJson = {
                devDependencies: {
                    typescript: "catalog:",
                },
            };

            resolveCatalogReferences(packageJson, catalogs);

            expect(packageJson).toStrictEqual({
                devDependencies: {
                    typescript: "^5.0.0",
                },
            });
        });
    });
});
