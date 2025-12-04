import { writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { isAccessibleSync, readJsonSync, writeJsonSync } from "@visulima/fs";
import { dirname, join, toNamespacedPath } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NormalizedReadResult } from "../../src/package-json";
import {
    ensurePackages,
    findPackageJson,
    findPackageJsonSync,
    getPackageJsonProperty,
    hasPackageJsonAnyDependency,
    hasPackageJsonProperty,
    parsePackageJson,
    parsePackageJsonSync,
    writePackageJson,
    writePackageJsonSync,
} from "../../src/package-json";
import type { NormalizedPackageJson } from "../../src/types";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "package-json");

const { mockConfirm, mockInstallPackage } = vi.hoisted(() => {
    return {
        // eslint-disable-next-line vitest/require-mock-type-parameters
        mockConfirm: vi.fn(),
        // eslint-disable-next-line vitest/require-mock-type-parameters
        mockInstallPackage: vi.fn(),
    };
});

vi.mock(import("../../src/utils/confirm"), () => {
    return {
        default: mockConfirm,
    };
});

vi.mock(import("@antfu/install-pkg"), () => {
    return { installPackage: mockInstallPackage };
});

describe("package-json", () => {
    describe.each([
        ["findPackageJson", findPackageJson],
        ["findPackageJsonSync", findPackageJsonSync],
    ])("%s", (name, function_) => {
        it("should return the content of the found package.json", async () => {
            expect.assertions(3);

            let result = function_(fixturePath);

            if (name === "findPackageJson") {
                result = await function_(fixturePath);
            }

            expect((result as NormalizedReadResult).packageJson).toBeTypeOf("object");
            expect((result as NormalizedReadResult).packageJson.name).toBe("nextjs_12_example_connect");
            expect((result as NormalizedReadResult).path).toBe(join(fixturePath, "package.json"));
        });
    });

    describe.each([
        ["writePackageJson", writePackageJson],
        ["writePackageJsonSync", writePackageJsonSync],
    ])("%s", (name, function_) => {
        let distribution: string;

        beforeEach(async () => {
            distribution = toNamespacedPath(temporaryDirectory());
        });

        afterEach(async () => {
            await rm(distribution, { recursive: true });
        });

        it("should write the package.json file with the given data", async () => {
            expect.assertions(2);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            if (name === "writePackageJson") {
                await function_(packageJson, {
                    cwd: distribution,
                });
            } else {
                function_(packageJson, {
                    cwd: distribution,
                });
            }

            expect(isAccessibleSync(join(distribution, "package.json"))).toBe(true);

            const packageJsonFile = readJsonSync(join(distribution, "package.json"));

            expect(packageJsonFile).toStrictEqual(packageJson);
        });
    });

    describe(parsePackageJson, () => {
        let distribution: string;

        beforeEach(() => {
            distribution = temporaryDirectory();
        });

        afterEach(async () => {
            await rm(distribution, { recursive: true });
        });

        it("should accept a valid package.json object and return a normalized package.json object", async () => {
            expect.assertions(1);

            const packageFile = {
                dependencies: {
                    "dependency-1": "^1.0.0",
                    "dependency-2": "^2.0.0",
                },
                name: "test-package",
                version: "1.0.0",
            };

            const result = await parsePackageJson(packageFile);

            expect(result).toStrictEqual({
                _id: "test-package@1.0.0",
                dependencies: {
                    "dependency-1": "^1.0.0",
                    "dependency-2": "^2.0.0",
                },
                name: "test-package",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should throw an error in strict mode when warnings are found during package.json parsing", async () => {
            expect.assertions(2);

            const packageFile = {
                dependencies: {
                    "dependency-1": "^1.0.0",
                    "dependency-2": "^2.0.0",
                },
                name: "test-package",
                version: "1.0.0",
            };

            try {
                await parsePackageJson(packageFile, {
                    strict: true,
                });

                expect(true).toBe(false);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
            }
        });

        it("should not throw in strict mode when no warnings occur", async () => {
            expect.assertions(1);

            const validPackage = {
                author: "Test Author",
                description: "A test package",
                license: "MIT",
                name: "test-package",
                readme: "ERROR: No README data found!",
                repository: {
                    directory: "packages/package",
                    type: "git",
                    url: "git+https://github.com/visulima/visulima.git",
                },
                version: "1.0.0",
            };

            await expect(parsePackageJson(validPackage, { strict: true })).resolves.not.toThrow();
        });

        it("should skip warnings that match exact strings in ignoreWarnings", async () => {
            expect.assertions(3);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                await parsePackageJson(packageFile, {
                    ignoreWarnings: ["No description", "No repository field."],
                    strict: true,
                });

                expect(true).toBe(false);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
                expect(error.message).not.toContain("No description");
                expect(error.message).not.toContain("No repository field.");
            }
        });

        it("should skip warnings that match regex patterns in ignoreWarnings", async () => {
            expect.assertions(3);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                await parsePackageJson(packageFile, {
                    ignoreWarnings: [/No description/, /repository field/],
                    strict: true,
                });

                expect(true).toBe(false);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
                expect(error.message).not.toContain("No description");
                expect(error.message).not.toContain("No repository field.");
            }
        });

        it("should skip warnings using both string and regex patterns", async () => {
            expect.assertions(3);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                await parsePackageJson(packageFile, {
                    ignoreWarnings: ["No description", /repository field/],
                    strict: true,
                });

                expect(true).toBe(false);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
                expect(error.message).not.toContain("No description");
                expect(error.message).not.toContain("No repository field.");
            }
        });

        it("should throw on warnings that don't match ignoreWarnings patterns", async () => {
            expect.assertions(2);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                await parsePackageJson(packageFile, {
                    ignoreWarnings: ["Different warning", /unrelated.*/],
                    strict: true,
                });

                expect(true).toBe(false);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
            }
        });

        it("should accept a valid package.json file path and return a normalized package.json object", async () => {
            expect.assertions(1);

            const packageFile = join(fixturePath, "simple-package.json");

            const result = await parsePackageJson(packageFile);

            expect(result).toStrictEqual({
                _id: "test@1.0.0",
                name: "test",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should accept a valid package.json string and return a normalized package.json object", async () => {
            expect.assertions(1);

            const packageFile = `{
        "name": "test-package",
        "version": "1.0.0",
        "dependencies": {
          "dependency-1": "^1.0.0",
          "dependency-2": "^2.0.0"
        }
      }`;

            const result = await parsePackageJson(packageFile);

            expect(result).toStrictEqual({
                _id: "test-package@1.0.0",
                dependencies: {
                    "dependency-1": "^1.0.0",
                    "dependency-2": "^2.0.0",
                },
                name: "test-package",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should throw a TypeError if the input is not an object or a string", async () => {
            expect.assertions(1);

            const packageFile = 123;

            await expect(() =>
                // @ts-expect-error - testing invalid input
                parsePackageJson(packageFile),
            ).rejects.toThrow(TypeError);
        });

        it("should handle and return a normalized package.json object for an empty package.json file", async () => {
            expect.assertions(1);

            const packageFile = {};

            const result = await parsePackageJson(packageFile);

            expect(result).toStrictEqual({
                _id: "@",
                name: "",
                readme: "ERROR: No README data found!",
                version: "",
            });
        });

        it("should resolve catalog references when resolveCatalogs is enabled and catalog exists", async () => {
            expect.assertions(1);

            // Mock the file system to return a package.json with catalog references
            const mockPackageJson = {
                dependencies: {
                    react: "catalog:",
                    typescript: "catalog:",
                },
                name: "test-package",
                version: "1.0.0",
            };

            // Create a temporary directory with package.json and pnpm-workspace.yaml
            const packageJsonPath = join(distribution, "package.json");
            const workspacePath = join(distribution, "pnpm-workspace.yaml");

            // Write package.json with catalog references
            writeJsonSync(packageJsonPath, mockPackageJson);

            // Write pnpm-workspace.yaml with catalog definitions
            const workspaceContent = `catalog:
  react: ^18.0.0
  typescript: ^5.0.0
packages:
  - .
`;

            writeFileSync(workspacePath, workspaceContent);

            const result = await parsePackageJson(packageJsonPath, { resolveCatalogs: true });

            expect(result).toStrictEqual({
                _id: "test-package@1.0.0",
                dependencies: {
                    react: "^18.0.0",
                    typescript: "^5.0.0",
                },
                name: "test-package",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should resolve named catalog references when resolveCatalogs is enabled", async () => {
            expect.assertions(1);

            const mockPackageJson = {
                dependencies: {
                    next: "catalog:next",
                    react: "catalog:next",
                },
                name: "test-package",
                version: "1.0.0",
            };

            const packageJsonPath = join(distribution, "package.json");
            const workspacePath = join(distribution, "pnpm-workspace.yaml");

            writeJsonSync(packageJsonPath, mockPackageJson);

            const workspaceContent = `catalogs:
  next:
    react: ^19.0.0
    next: ^15.0.0
packages:
  - .
`;

            writeFileSync(workspacePath, workspaceContent);

            const result = await parsePackageJson(packageJsonPath, { resolveCatalogs: true });

            expect(result).toStrictEqual({
                _id: "test-package@1.0.0",
                dependencies: {
                    next: "^15.0.0",
                    react: "^19.0.0",
                },
                name: "test-package",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should not resolve catalog references when resolveCatalogs is false or undefined", async () => {
            expect.assertions(1);

            const mockPackageJson = {
                dependencies: {
                    react: "catalog:",
                },
                name: "test-package",
                version: "1.0.0",
            };

            const packageJsonPath = join(distribution, "package.json");
            const workspacePath = join(distribution, "pnpm-workspace.yaml");

            writeJsonSync(packageJsonPath, mockPackageJson);

            const workspaceContent = `catalog:
  react: ^18.0.0
packages:
  - .
`;

            writeFileSync(workspacePath, workspaceContent);

            const result = await parsePackageJson(packageJsonPath, { resolveCatalogs: false });

            expect(result).toStrictEqual({
                _id: "test-package@1.0.0",
                dependencies: {
                    react: "catalog:",
                },
                name: "test-package",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should handle catalog references in all dependency fields", async () => {
            expect.assertions(1);

            const mockPackageJson = {
                dependencies: {
                    react: "catalog:",
                },
                devDependencies: {
                    typescript: "catalog:",
                },
                name: "test-package",
                optionalDependencies: {
                    eslint: "catalog:",
                },
                peerDependencies: {
                    node: "catalog:",
                },
                version: "1.0.0",
            };

            const packageJsonPath = join(distribution, "package.json");
            const workspacePath = join(distribution, "pnpm-workspace.yaml");

            writeJsonSync(packageJsonPath, mockPackageJson);

            const workspaceContent = `catalog:
  react: ^18.0.0
  typescript: ^5.0.0
  node: ^20.0.0
  eslint: ^8.0.0
packages:
  - .
`;

            writeFileSync(workspacePath, workspaceContent);

            const result = await parsePackageJson(packageJsonPath, { resolveCatalogs: true });

            expect(result).toStrictEqual({
                _id: "test-package@1.0.0",
                dependencies: {
                    eslint: "^8.0.0",
                    react: "^18.0.0",
                },
                devDependencies: {
                    typescript: "^5.0.0",
                },
                name: "test-package",
                optionalDependencies: {
                    eslint: "^8.0.0",
                },
                peerDependencies: {
                    node: "^20.0.0",
                },
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should throw an error when resolveCatalogs is true but input is not a file path", async () => {
            expect.assertions(2);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                await parsePackageJson(packageFile, { resolveCatalogs: true });

                expect(true).toBe(false);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toBe("The 'resolveCatalogs' option can only be used on a file path.");
            }
        });

        it("should throw an error when resolveCatalogs is true but input is a JSON string", async () => {
            expect.assertions(2);

            const packageFile = `{"name": "test-package", "version": "1.0.0"}`;

            try {
                await parsePackageJson(packageFile, { resolveCatalogs: true });

                expect(true).toBe(false);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toBe("The 'resolveCatalogs' option can only be used on a file path.");
            }
        });

        it("should throw an error synchronously when resolveCatalogs is true but input is not a file path", () => {
            expect.assertions(2);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                parsePackageJsonSync(packageFile, { resolveCatalogs: true });

                expect(true).toBe(false);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toBe("The 'resolveCatalogs' option can only be used on a file path.");
            }
        });

        it("should throw an error synchronously when resolveCatalogs is true but input is a JSON string", () => {
            expect.assertions(2);

            const packageFile = `{"name": "test-package", "version": "1.0.0"}`;

            try {
                parsePackageJsonSync(packageFile, { resolveCatalogs: true });

                expect(true).toBe(false);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toBe("The 'resolveCatalogs' option can only be used on a file path.");
            }
        });

        it("should resolve catalog references synchronously when resolveCatalogs is enabled and catalog exists", () => {
            expect.assertions(1);

            // Mock the file system to return a package.json with catalog references
            const mockPackageJson = {
                dependencies: {
                    react: "catalog:",
                    typescript: "catalog:",
                },
                name: "test-package",
                version: "1.0.0",
            };

            // Create a temporary directory with package.json and pnpm-workspace.yaml
            const packageJsonPath = join(distribution, "package.json");
            const workspacePath = join(distribution, "pnpm-workspace.yaml");

            // Write package.json with catalog references
            writeJsonSync(packageJsonPath, mockPackageJson);

            // Write pnpm-workspace.yaml with catalog definitions
            const workspaceContent = `catalog:
  react: ^18.0.0
  typescript: ^5.0.0
packages:
  - .
`;

            writeFileSync(workspacePath, workspaceContent);

            const result = parsePackageJsonSync(packageJsonPath, { resolveCatalogs: true });

            expect(result).toStrictEqual({
                _id: "test-package@1.0.0",
                dependencies: {
                    react: "^18.0.0",
                    typescript: "^5.0.0",
                },
                name: "test-package",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should resolve named catalog references synchronously when resolveCatalogs is enabled", () => {
            expect.assertions(1);

            const mockPackageJson = {
                dependencies: {
                    next: "catalog:next",
                    react: "catalog:next",
                },
                name: "test-package",
                version: "1.0.0",
            };

            const packageJsonPath = join(distribution, "package.json");
            const workspacePath = join(distribution, "pnpm-workspace.yaml");

            writeJsonSync(packageJsonPath, mockPackageJson);

            const workspaceContent = `catalogs:
  next:
    react: ^19.0.0
    next: ^15.0.0
packages:
  - .
`;

            writeFileSync(workspacePath, workspaceContent);

            const result = parsePackageJsonSync(packageJsonPath, { resolveCatalogs: true });

            expect(result).toStrictEqual({
                _id: "test-package@1.0.0",
                dependencies: {
                    next: "^15.0.0",
                    react: "^19.0.0",
                },
                name: "test-package",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should not resolve catalog references synchronously when resolveCatalogs is false or undefined", () => {
            expect.assertions(1);

            const mockPackageJson = {
                dependencies: {
                    react: "catalog:",
                },
                name: "test-package",
                version: "1.0.0",
            };

            const packageJsonPath = join(distribution, "package.json");
            const workspacePath = join(distribution, "pnpm-workspace.yaml");

            writeJsonSync(packageJsonPath, mockPackageJson);

            const workspaceContent = `catalog:
  react: ^18.0.0
packages:
  - .
`;

            writeFileSync(workspacePath, workspaceContent);

            const result = parsePackageJsonSync(packageJsonPath, { resolveCatalogs: false });

            expect(result).toStrictEqual({
                _id: "test-package@1.0.0",
                dependencies: {
                    react: "catalog:",
                },
                name: "test-package",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });
    });

    describe(getPackageJsonProperty, () => {
        it("should return the value of the specified property", () => {
            expect.assertions(1);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            const result = getPackageJsonProperty(packageJson as unknown as NormalizedPackageJson, "name");

            expect(result).toBe("test-package");
        });

        it("should return the default value if the property does not exist", () => {
            expect.assertions(1);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            const result = getPackageJsonProperty(packageJson as unknown as NormalizedPackageJson, "author", "anonymous");

            expect(result).toBe("anonymous");
        });

        it("should return the default value if the property is undefined", () => {
            expect.assertions(1);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            const result = getPackageJsonProperty(packageJson as unknown as NormalizedPackageJson, "dependencies.dependency-1", undefined);

            expect(result).toBeUndefined();
        });
    });

    describe(hasPackageJsonProperty, () => {
        it("should return true if the property exists in the package.json file", () => {
            expect.assertions(1);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonProperty(packageJson as unknown as NormalizedPackageJson, "name");

            expect(result).toBe(true);
        });

        it("should return false if the property does not exist in the package.json file", () => {
            expect.assertions(1);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonProperty(packageJson as unknown as NormalizedPackageJson, "author");

            expect(result).toBe(false);
        });
    });

    describe(hasPackageJsonAnyDependency, () => {
        it("should return true if any of the specified dependencies exist in the package.json file", () => {
            expect.assertions(1);

            const packageJson = {
                dependencies: {
                    "dependency-1": "^1.0.0",
                    "dependency-2": "^2.0.0",
                },
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-1", "dependency-3"]);

            expect(result).toBe(true);
        });

        it("should return false if none of the specified dependencies exist in the package.json file", () => {
            expect.assertions(1);

            const packageJson = {
                dependencies: {
                    "dependency-1": "^1.0.0",
                    "dependency-2": "^2.0.0",
                },
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-3", "dependency-4"]);

            expect(result).toBe(false);
        });

        it("should return false if the dependencies property is undefined", () => {
            expect.assertions(1);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-1", "dependency-2"]);

            expect(result).toBe(false);
        });

        it("should return false if the dependencies property is null", () => {
            expect.assertions(1);

            const packageJson = {
                // eslint-disable-next-line unicorn/no-null
                dependencies: null,
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-1", "dependency-2"]);

            expect(result).toBe(false);
        });

        it("should return false if the dependencies property is an empty object", () => {
            expect.assertions(1);

            const packageJson = {
                dependencies: {},
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-1", "dependency-2"]);

            expect(result).toBe(false);
        });

        it("should return false if the dependencies property is an empty array", () => {
            expect.assertions(1);

            const packageJson = {
                dependencies: [],
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-1", "dependency-2"]);

            expect(result).toBe(false);
        });
    });

    describe(ensurePackages, () => {
        beforeEach(() => {
            vi.resetAllMocks();
        });

        it("should install packages when user confirms and packages are missing", async () => {
            expect.assertions(2);

            mockConfirm.mockResolvedValue(true);

            vi.stubGlobal("process", {
                argv: [],
                env: { CI: false },
                stdout: { isTTY: true },
                versions: { ...process.versions },
            });

            const packageJson = {
                dependencies: {},
                devDependencies: {},
            } as NormalizedPackageJson;

            await ensurePackages(packageJson, ["package1", "package2"]);

            expect(mockConfirm).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    message: "Packages are required for this config: package1, package2. Do you want to install them?",
                }),
            );

            expect(mockInstallPackage).toHaveBeenCalledExactlyOnceWith(["package1", "package2"], expect.any(Object));
        });

        it("should install packages when user confirms and packages are missing with custom message function", async () => {
            expect.assertions(2);

            mockConfirm.mockResolvedValue(true);

            vi.stubGlobal("process", {
                argv: [],
                env: { CI: false },
                stdout: { isTTY: true },
                versions: { ...process.versions },
            });

            const packageJson = {
                dependencies: {},
                devDependencies: {},
            } as NormalizedPackageJson;

            await ensurePackages(packageJson, ["package1", "package2"], "dependencies", {
                confirm: {
                    message: (packages) => `Custom Packages are required for this config: ${packages.join(", ")}. Do you want to install them?`,
                },
            });

            expect(mockConfirm).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    message: "Custom Packages are required for this config: package1, package2. Do you want to install them?",
                }),
            );

            expect(mockInstallPackage).toHaveBeenCalledExactlyOnceWith(["package1", "package2"], expect.any(Object));
        });

        it("should not install packages when the packages are already installed", async () => {
            expect.assertions(2);

            mockConfirm.mockResolvedValue(true);

            vi.stubGlobal("process", {
                argv: [],
                env: { CI: false },
                stdout: { isTTY: true },
                versions: { ...process.versions },
            });

            const packageJson = {
                dependencies: {
                    package1: "^1.0.0",
                    package2: "^2.0.0",
                },
                devDependencies: {},
            } as unknown as NormalizedPackageJson;

            await ensurePackages(packageJson, ["package1", "package2"], "dependencies", {
                confirm: {
                    message: (packages) => `Custom Packages are required for this config: ${packages.join(", ")}. Do you want to install them?`,
                },
            });

            expect(mockConfirm).not.toHaveBeenCalled();
            expect(mockInstallPackage).not.toHaveBeenCalled();
        });

        it("should return early when running in CI environment", async () => {
            expect.assertions(2);

            vi.stubGlobal("process", {
                argv: [],
                env: { CI: true },
                stdout: { isTTY: true },
                versions: { ...process.versions },
            });

            const packageJson = {
                dependencies: {},
                devDependencies: {},
            } as NormalizedPackageJson;

            await ensurePackages(packageJson, ["package1"]);

            expect(mockConfirm).not.toHaveBeenCalled();
            expect(mockInstallPackage).not.toHaveBeenCalled();
        });

        it("should return early when not in TTY environment", async () => {
            expect.assertions(2);

            vi.stubGlobal("process", {
                argv: [],
                env: { CI: false },
                stdout: { isTTY: false },
                versions: { ...process.versions },
            });

            const packageJson = {
                dependencies: {},
                devDependencies: {},
            } as NormalizedPackageJson;

            await ensurePackages(packageJson, ["package1"]);

            expect(mockConfirm).not.toHaveBeenCalled();
            expect(mockInstallPackage).not.toHaveBeenCalled();
        });
    });

    describe("package.yaml and package.json5 support", () => {
        let distribution: string;

        beforeEach(() => {
            distribution = temporaryDirectory();
        });

        afterEach(async () => {
            await rm(distribution, { recursive: true });
        });

        describe("findPackageJson with package.yaml", () => {
            it("should find and parse package.yaml file", async () => {
                expect.assertions(3);

                const yamlContent = `name: test-package
version: 1.0.0
dependencies:
  react: ^18.0.0
  typescript: ^5.0.0`;

                writeFileSync(join(distribution, "package.yaml"), yamlContent);

                const result = await findPackageJson(distribution, { yaml: true });

                expect(result.packageJson.name).toBe("test-package");
                expect(result.packageJson.version).toBe("1.0.0");
                expect(result.path).toBe(join(distribution, "package.yaml"));
            });

            it("should find and parse package.yaml file synchronously", () => {
                expect.assertions(3);

                const yamlContent = `name: test-package
version: 1.0.0
dependencies:
  react: ^18.0.0
  typescript: ^5.0.0`;

                writeFileSync(join(distribution, "package.yaml"), yamlContent);

                const result = findPackageJsonSync(distribution, { yaml: true });

                expect(result.packageJson.name).toBe("test-package");
                expect(result.packageJson.version).toBe("1.0.0");
                expect(result.path).toBe(join(distribution, "package.yaml"));
            });

            it("should prefer package.json over package.yaml when both exist", async () => {
                expect.assertions(2);

                const jsonContent = { name: "json-package", version: "2.0.0" };
                const yamlContent = `name: yaml-package
version: 1.0.0`;

                writeJsonSync(join(distribution, "package.json"), jsonContent);
                writeFileSync(join(distribution, "package.yaml"), yamlContent);

                const result = await findPackageJson(distribution, { yaml: true });

                expect(result.packageJson.name).toBe("json-package");
                expect(result.path).toBe(join(distribution, "package.json"));
            });

            it("should not find package.yaml when yaml is false", async () => {
                expect.assertions(1);

                const yamlContent = `name: test-package
version: 1.0.0`;

                writeFileSync(join(distribution, "package.yaml"), yamlContent);

                await expect(findPackageJson(distribution, { yaml: false })).rejects.toThrow(
                    "No such file or directory, for package.json or package.json5 found.",
                );
            });
        });

        describe("findPackageJson with package.json5", () => {
            it("should find and parse package.json5 file", async () => {
                expect.assertions(3);

                const json5Content = `{
  name: 'test-package',
  version: '1.0.0',
  dependencies: {
    react: '^18.0.0',
    typescript: '^5.0.0'
  }
}`;

                writeFileSync(join(distribution, "package.json5"), json5Content);

                const result = await findPackageJson(distribution, { json5: true });

                expect(result.packageJson.name).toBe("test-package");
                expect(result.packageJson.version).toBe("1.0.0");
                expect(result.path).toBe(join(distribution, "package.json5"));
            });

            it("should find and parse package.json5 file synchronously", () => {
                expect.assertions(3);

                const json5Content = `{
  name: 'test-package',
  version: '1.0.0',
  dependencies: {
    react: '^18.0.0',
    typescript: '^5.0.0'
  }
}`;

                writeFileSync(join(distribution, "package.json5"), json5Content);

                const result = findPackageJsonSync(distribution, { json5: true });

                expect(result.packageJson.name).toBe("test-package");
                expect(result.packageJson.version).toBe("1.0.0");
                expect(result.path).toBe(join(distribution, "package.json5"));
            });

            it("should prefer package.json over package.json5 when both exist", async () => {
                expect.assertions(2);

                const jsonContent = { name: "json-package", version: "2.0.0" };
                const json5Content = `{
  name: 'json5-package',
  version: '1.0.0'
}`;

                writeJsonSync(join(distribution, "package.json"), jsonContent);
                writeFileSync(join(distribution, "package.json5"), json5Content);

                const result = await findPackageJson(distribution, { json5: true });

                expect(result.packageJson.name).toBe("json-package");
                expect(result.path).toBe(join(distribution, "package.json"));
            });

            it("should not find package.json5 when json5 is false", async () => {
                expect.assertions(1);

                const json5Content = `{
  name: 'test-package',
  version: '1.0.0'
}`;

                writeFileSync(join(distribution, "package.json5"), json5Content);

                await expect(findPackageJson(distribution, { json5: false })).rejects.toThrow(
                    "ENOENT: No such file or directory, for package.json, package.yaml or package.yml found.",
                );
            });
        });

        describe("parsePackageJson with package.yaml", () => {
            it("should parse package.yaml file path", async () => {
                expect.assertions(1);

                const yamlContent = `name: test-package
version: 1.0.0
dependencies:
  react: ^18.0.0`;

                const yamlPath = join(distribution, "package.yaml");

                writeFileSync(yamlPath, yamlContent);

                const result = await parsePackageJson(yamlPath, { yaml: true });

                expect(result).toStrictEqual({
                    _id: "test-package@1.0.0",
                    dependencies: {
                        react: "^18.0.0",
                    },
                    name: "test-package",
                    readme: "ERROR: No README data found!",
                    version: "1.0.0",
                });
            });

            it("should parse package.yaml file path synchronously", () => {
                expect.assertions(1);

                const yamlContent = `name: test-package
version: 1.0.0
dependencies:
  react: ^18.0.0`;

                const yamlPath = join(distribution, "package.yaml");

                writeFileSync(yamlPath, yamlContent);

                const result = parsePackageJsonSync(yamlPath, { yaml: true });

                expect(result).toStrictEqual({
                    _id: "test-package@1.0.0",
                    dependencies: {
                        react: "^18.0.0",
                    },
                    name: "test-package",
                    readme: "ERROR: No README data found!",
                    version: "1.0.0",
                });
            });

            it("should not parse package.yaml when yaml is false", async () => {
                expect.assertions(1);

                const yamlContent = `name: test-package
version: 1.0.0`;

                const yamlPath = join(distribution, "package.yaml");

                writeFileSync(yamlPath, yamlContent);

                // Should fall back to regular JSON parsing and fail
                await expect(parsePackageJson(yamlPath, { yaml: false })).rejects.toThrow(Error);
            });
        });

        describe("parsePackageJson with package.json5", () => {
            it("should parse package.json5 file path", async () => {
                expect.assertions(1);

                const json5Content = `{
  name: 'test-package',
  version: '1.0.0',
  dependencies: {
    react: '^18.0.0'
  }
}`;

                const json5Path = join(distribution, "package.json5");

                writeFileSync(json5Path, json5Content);

                const result = await parsePackageJson(json5Path, { json5: true });

                expect(result).toStrictEqual({
                    _id: "test-package@1.0.0",
                    dependencies: {
                        react: "^18.0.0",
                    },
                    name: "test-package",
                    readme: "ERROR: No README data found!",
                    version: "1.0.0",
                });
            });

            it("should parse package.json5 file path synchronously", () => {
                expect.assertions(1);

                const json5Content = `{
  name: 'test-package',
  version: '1.0.0',
  dependencies: {
    react: '^18.0.0'
  }
}`;

                const json5Path = join(distribution, "package.json5");

                writeFileSync(json5Path, json5Content);

                const result = parsePackageJsonSync(json5Path, { json5: true });

                expect(result).toStrictEqual({
                    _id: "test-package@1.0.0",
                    dependencies: {
                        react: "^18.0.0",
                    },
                    name: "test-package",
                    readme: "ERROR: No README data found!",
                    version: "1.0.0",
                });
            });

            it("should not parse package.json5 when json5 is false", async () => {
                expect.assertions(1);

                const json5Content = `{
  name: 'test-package',
  version: '1.0.0'
}`;

                const json5Path = join(distribution, "package.json5");

                writeFileSync(json5Path, json5Content);

                // Should fall back to regular JSON parsing and fail
                await expect(parsePackageJson(json5Path, { json5: false })).rejects.toThrow(Error);
            });
        });

        describe("file search priority", () => {
            it("should search files in correct priority order: package.json > package.yaml > package.json5", async () => {
                expect.assertions(1);

                const jsonContent = { name: "json-package", version: "1.0.0" };
                const yamlContent = `name: yaml-package
version: 2.0.0`;
                const json5Content = `{
  name: 'json5-package',
  version: '3.0.0'
}`;

                writeJsonSync(join(distribution, "package.json"), jsonContent);
                writeFileSync(join(distribution, "package.yaml"), yamlContent);
                writeFileSync(join(distribution, "package.json5"), json5Content);

                const result = await findPackageJson(distribution);

                expect(result.packageJson.name).toBe("json-package");
            });

            it("should find package.yaml when package.json doesn't exist", async () => {
                expect.assertions(1);

                const yamlContent = `name: yaml-package
version: 2.0.0`;
                const json5Content = `{
  name: 'json5-package',
  version: '3.0.0'
}`;

                writeFileSync(join(distribution, "package.yaml"), yamlContent);
                writeFileSync(join(distribution, "package.json5"), json5Content);

                const result = await findPackageJson(distribution);

                expect(result.packageJson.name).toBe("yaml-package");
            });

            it("should find package.json5 when package.json and package.yaml don't exist", async () => {
                expect.assertions(1);

                const json5Content = `{
  name: 'json5-package',
  version: '3.0.0'
}`;

                writeFileSync(join(distribution, "package.json5"), json5Content);

                const result = await findPackageJson(distribution);

                expect(result.packageJson.name).toBe("json5-package");
            });
        });
    });

    describe("catalog resolution support", () => {
        let distribution: string;

        beforeEach(() => {
            distribution = temporaryDirectory();
        });

        afterEach(async () => {
            await rm(distribution, { recursive: true });
        });

        describe("findPackageJson with resolveCatalogs", () => {
            it("should resolve catalog references when resolveCatalogs is enabled", async () => {
                expect.assertions(1);

                const packageJson = {
                    dependencies: {
                        react: "catalog:",
                        typescript: "catalog:",
                    },
                    name: "test-package",
                    version: "1.0.0",
                };

                const workspaceContent = {
                    catalog: {
                        react: "^18.0.0",
                        typescript: "^5.0.0",
                    },
                    packages: ["."],
                };

                writeJsonSync(join(distribution, "package.json"), packageJson);
                // eslint-disable-next-line unicorn/no-null
                writeFileSync(join(distribution, "pnpm-workspace.yaml"), JSON.stringify(workspaceContent, null, 2));

                const result = await findPackageJson(distribution, { resolveCatalogs: true });

                expect(result.packageJson).toStrictEqual({
                    _id: "test-package@1.0.0",
                    dependencies: {
                        react: "^18.0.0",
                        typescript: "^5.0.0",
                    },
                    name: "test-package",
                    readme: "ERROR: No README data found!",
                    version: "1.0.0",
                });
            });

            it("should resolve catalog references synchronously when resolveCatalogs is enabled", () => {
                expect.assertions(1);

                const packageJson = {
                    dependencies: {
                        react: "catalog:",
                        typescript: "catalog:",
                    },
                    name: "test-package",
                    version: "1.0.0",
                };

                const workspaceContent = {
                    catalog: {
                        react: "^18.0.0",
                        typescript: "^5.0.0",
                    },
                    packages: ["."],
                };

                writeJsonSync(join(distribution, "package.json"), packageJson);
                // eslint-disable-next-line unicorn/no-null
                writeFileSync(join(distribution, "pnpm-workspace.yaml"), JSON.stringify(workspaceContent, null, 2));

                const result = findPackageJsonSync(distribution, { resolveCatalogs: true });

                expect(result.packageJson).toStrictEqual({
                    _id: "test-package@1.0.0",
                    dependencies: {
                        react: "^18.0.0",
                        typescript: "^5.0.0",
                    },
                    name: "test-package",
                    readme: "ERROR: No README data found!",
                    version: "1.0.0",
                });
            });

            it("should not resolve catalog references when resolveCatalogs is false or undefined", async () => {
                expect.assertions(1);

                const packageJson = {
                    dependencies: {
                        react: "catalog:",
                        typescript: "catalog:",
                    },
                    name: "test-package",
                    version: "1.0.0",
                };

                const workspaceContent = {
                    catalog: {
                        react: "^18.0.0",
                        typescript: "^5.0.0",
                    },
                    packages: ["."],
                };

                writeJsonSync(join(distribution, "package.json"), packageJson);
                // eslint-disable-next-line unicorn/no-null
                writeFileSync(join(distribution, "pnpm-workspace.yaml"), JSON.stringify(workspaceContent, null, 2));

                const result = await findPackageJson(distribution, { resolveCatalogs: false });

                expect(result.packageJson).toStrictEqual({
                    _id: "test-package@1.0.0",
                    dependencies: {
                        react: "catalog:",
                        typescript: "catalog:",
                    },
                    name: "test-package",
                    readme: "ERROR: No README data found!",
                    version: "1.0.0",
                });
            });

            it("should resolve named catalog references when resolveCatalogs is enabled", async () => {
                expect.assertions(1);

                const packageJson = {
                    dependencies: {
                        next: "catalog:next",
                        react: "catalog:next",
                    },
                    name: "test-package",
                    version: "1.0.0",
                };

                const workspaceContent = {
                    catalogs: {
                        next: {
                            next: "^15.0.0",
                            react: "^19.0.0",
                        },
                    },
                    packages: ["."],
                };

                writeJsonSync(join(distribution, "package.json"), packageJson);
                // eslint-disable-next-line unicorn/no-null
                writeFileSync(join(distribution, "pnpm-workspace.yaml"), JSON.stringify(workspaceContent, null, 2));

                const result = await findPackageJson(distribution, { resolveCatalogs: true });

                expect(result.packageJson).toStrictEqual({
                    _id: "test-package@1.0.0",
                    dependencies: {
                        next: "^15.0.0",
                        react: "^19.0.0",
                    },
                    name: "test-package",
                    readme: "ERROR: No README data found!",
                    version: "1.0.0",
                });
            });

            it("should handle catalog references in all dependency fields", async () => {
                expect.assertions(1);

                const packageJson = {
                    dependencies: {
                        react: "catalog:",
                    },
                    devDependencies: {
                        typescript: "catalog:",
                    },
                    name: "test-package",
                    optionalDependencies: {
                        eslint: "catalog:",
                    },
                    peerDependencies: {
                        node: "catalog:",
                    },
                    version: "1.0.0",
                };

                const workspaceContent = {
                    catalog: {
                        eslint: "^8.0.0",
                        node: "^20.0.0",
                        react: "^18.0.0",
                        typescript: "^5.0.0",
                    },
                    packages: ["."],
                };

                writeJsonSync(join(distribution, "package.json"), packageJson);
                // eslint-disable-next-line unicorn/no-null
                writeFileSync(join(distribution, "pnpm-workspace.yaml"), JSON.stringify(workspaceContent, null, 2));

                const result = await findPackageJson(distribution, { resolveCatalogs: true });

                expect(result.packageJson).toStrictEqual({
                    _id: "test-package@1.0.0",
                    dependencies: {
                        eslint: "^8.0.0",
                        react: "^18.0.0",
                    },
                    devDependencies: {
                        typescript: "^5.0.0",
                    },
                    name: "test-package",
                    optionalDependencies: {
                        eslint: "^8.0.0",
                    },
                    peerDependencies: {
                        node: "^20.0.0",
                    },
                    readme: "ERROR: No README data found!",
                    version: "1.0.0",
                });
            });
        });
    });

    describe("caching support", () => {
        let distribution: string;

        beforeEach(() => {
            distribution = temporaryDirectory();
        });

        afterEach(async () => {
            await rm(distribution, { recursive: true });
        });

        describe("parsePackageJson with cache", () => {
            it("should cache parsed results for file paths", async () => {
                expect.assertions(2);

                const packageJson = {
                    name: "test-package",
                    version: "1.0.0",
                };

                const packagePath = join(distribution, "package.json");

                writeJsonSync(packagePath, packageJson);

                const cache = new Map<string, NormalizedPackageJson>();

                // First parse - should populate cache
                const result1 = await parsePackageJson(packagePath, { cache });

                expect(result1.name).toBe("test-package");

                // Modify the file on disk
                const modifiedPackageJson = {
                    name: "modified-package",
                    version: "2.0.0",
                };

                writeJsonSync(packagePath, modifiedPackageJson);

                // Second parse - should return cached result
                const result2 = await parsePackageJson(packagePath, { cache });

                expect(result2.name).toBe("test-package"); // Should be cached value, not modified value
            });

            it("should cache parsed results synchronously for file paths", () => {
                expect.assertions(2);

                const packageJson = {
                    name: "test-package",
                    version: "1.0.0",
                };

                const packagePath = join(distribution, "package.json");

                writeJsonSync(packagePath, packageJson);

                const cache = new Map<string, NormalizedPackageJson>();

                // First parse - should populate cache
                const result1 = parsePackageJsonSync(packagePath, { cache });

                expect(result1.name).toBe("test-package");

                // Modify the file on disk
                const modifiedPackageJson = {
                    name: "modified-package",
                    version: "2.0.0",
                };

                writeJsonSync(packagePath, modifiedPackageJson);

                // Second parse - should return cached result
                const result2 = parsePackageJsonSync(packagePath, { cache });

                expect(result2.name).toBe("test-package"); // Should be cached value, not modified value
            });

            it("should not cache object inputs", async () => {
                expect.assertions(3);

                const packageJson = {
                    name: "test-package",
                    version: "1.0.0",
                };

                const cache = new Map<string, NormalizedPackageJson>();

                // Parse object - should not be cached
                const result1 = await parsePackageJson(packageJson, { cache });

                expect(result1.name).toBe("test-package");

                // Parse same object again - should work but not use cache
                const result2 = await parsePackageJson(packageJson, { cache });

                expect(result2.name).toBe("test-package");

                // Cache should still be empty for non-file inputs
                expect(cache.size).toBe(0);
            });

            it("should not cache JSON string inputs", async () => {
                expect.assertions(3);

                const packageJsonString = `{"name": "test-package", "version": "1.0.0"}`;

                const cache = new Map<string, NormalizedPackageJson>();

                // Parse JSON string - should not be cached
                const result1 = await parsePackageJson(packageJsonString, { cache });

                expect(result1.name).toBe("test-package");

                // Parse same string again - should work but not use cache
                const result2 = await parsePackageJson(packageJsonString, { cache });

                expect(result2.name).toBe("test-package");

                // Cache should still be empty for non-file inputs
                expect(cache.size).toBe(0);
            });
        });
    });
});
