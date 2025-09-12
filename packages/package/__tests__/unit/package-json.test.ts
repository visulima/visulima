import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
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
    writePackageJson,
    writePackageJsonSync,
} from "../../src/package-json";
import type { NormalizedPackageJson } from "../../src/types";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "package-json");

const { mockConfirm, mockInstallPackage } = vi.hoisted(() => {
    return {
        mockConfirm: vi.fn(),
        mockInstallPackage: vi.fn(),
    };
});

vi.mock("@inquirer/confirm", () => {
    return {
        default: mockConfirm,
    };
});

vi.mock("@antfu/install-pkg", () => {
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

            expect(isAccessibleSync(join(distribution, "package.json"))).toBeTruthy();

            const packageJsonFile = readJsonSync(join(distribution, "package.json"));

            expect(packageJsonFile).toStrictEqual(packageJson);
        });
    });

    describe("parsePackageJson", () => {
        it("should accept a valid package.json object and return a normalized package.json object", () => {
            expect.assertions(1);

            const packageFile = {
                dependencies: {
                    "dependency-1": "^1.0.0",
                    "dependency-2": "^2.0.0",
                },
                name: "test-package",
                version: "1.0.0",
            };

            const result = parsePackageJson(packageFile);

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

        it("should throw an error in strict mode when warnings are found during package.json parsing", () => {
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
                parsePackageJson(packageFile, {
                    strict: true,
                });

                expect(true).toBeFalsy();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
            }
        });

        it("should not throw in strict mode when no warnings occur", () => {
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

            expect(() => {
                parsePackageJson(validPackage, { strict: true });
            }).not.toThrow();
        });

        it("should skip warnings that match exact strings in ignoreWarnings", () => {
            expect.assertions(3);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                parsePackageJson(packageFile, {
                    ignoreWarnings: ["No description", "No repository field."],
                    strict: true,
                });

                expect(true).toBeFalsy();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
                expect(error.message).not.toContain("No description");
                expect(error.message).not.toContain("No repository field.");
            }
        });

        it("should skip warnings that match regex patterns in ignoreWarnings", () => {
            expect.assertions(3);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                parsePackageJson(packageFile, {
                    ignoreWarnings: [/No description/, /repository field/],
                    strict: true,
                });

                expect(true).toBeFalsy();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
                expect(error.message).not.toContain("No description");
                expect(error.message).not.toContain("No repository field.");
            }
        });

        it("should skip warnings using both string and regex patterns", () => {
            expect.assertions(3);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                parsePackageJson(packageFile, {
                    ignoreWarnings: ["No description", /repository field/],
                    strict: true,
                });

                expect(true).toBeFalsy();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
                expect(error.message).not.toContain("No description");
                expect(error.message).not.toContain("No repository field.");
            }
        });

        it("should throw on warnings that don't match ignoreWarnings patterns", () => {
            expect.assertions(2);

            const packageFile = {
                name: "test-package",
                version: "1.0.0",
            };

            try {
                parsePackageJson(packageFile, {
                    ignoreWarnings: ["Different warning", /unrelated.*/],
                    strict: true,
                });

                expect(true).toBeFalsy();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain("The following warnings were encountered while normalizing package data:");
            }
        });

        it("should accept a valid package.json file path and return a normalized package.json object", () => {
            expect.assertions(1);

            const packageFile = join(fixturePath, "simple-package.json");

            const result = parsePackageJson(packageFile);

            expect(result).toStrictEqual({
                _id: "test@1.0.0",
                name: "test",
                readme: "ERROR: No README data found!",
                version: "1.0.0",
            });
        });

        it("should accept a valid package.json string and return a normalized package.json object", () => {
            expect.assertions(1);

            const packageFile = `{
        "name": "test-package",
        "version": "1.0.0",
        "dependencies": {
          "dependency-1": "^1.0.0",
          "dependency-2": "^2.0.0"
        }
      }`;

            const result = parsePackageJson(packageFile);

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

        it("should throw a TypeError if the input is not an object or a string", () => {
            expect.assertions(1);

            const packageFile = 123;

            expect(() => {
                // @ts-expect-error - testing invalid input
                parsePackageJson(packageFile);
            }).toThrow(TypeError);
        });

        it("should handle and return a normalized package.json object for an empty package.json file", () => {
            expect.assertions(1);

            const packageFile = {};

            const result = parsePackageJson(packageFile);

            expect(result).toStrictEqual({
                _id: "@",
                name: "",
                readme: "ERROR: No README data found!",
                version: "",
            });
        });
    });

    describe("getPackageJsonProperty", () => {
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

            // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
            const result = getPackageJsonProperty(packageJson as unknown as NormalizedPackageJson, "dependencies.dependency-1", undefined);

            expect(result).toBeUndefined();
        });
    });

    describe("hasPackageJsonProperty", () => {
        it("should return true if the property exists in the package.json file", () => {
            expect.assertions(1);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonProperty(packageJson as unknown as NormalizedPackageJson, "name");

            expect(result).toBeTruthy();
        });

        it("should return false if the property does not exist in the package.json file", () => {
            expect.assertions(1);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonProperty(packageJson as unknown as NormalizedPackageJson, "author");

            expect(result).toBeFalsy();
        });
    });

    describe("hasPackageJsonAnyDependency", () => {
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

            expect(result).toBeTruthy();
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

            expect(result).toBeFalsy();
        });

        it("should return false if the dependencies property is undefined", () => {
            expect.assertions(1);

            const packageJson = {
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-1", "dependency-2"]);

            expect(result).toBeFalsy();
        });

        it("should return false if the dependencies property is null", () => {
            expect.assertions(1);

            const packageJson = {
                dependencies: null,
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-1", "dependency-2"]);

            expect(result).toBeFalsy();
        });

        it("should return false if the dependencies property is an empty object", () => {
            expect.assertions(1);

            const packageJson = {
                dependencies: {},
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-1", "dependency-2"]);

            expect(result).toBeFalsy();
        });

        it("should return false if the dependencies property is an empty array", () => {
            expect.assertions(1);

            const packageJson = {
                dependencies: [],
                name: "test-package",
                version: "1.0.0",
            };

            const result = hasPackageJsonAnyDependency(packageJson as unknown as NormalizedPackageJson, ["dependency-1", "dependency-2"]);

            expect(result).toBeFalsy();
        });
    });

    describe("ensurePackages", () => {
        beforeEach(() => {
            vi.resetAllMocks();
        });

        it("should install packages when user confirms and packages are missing", async () => {
            mockConfirm.mockResolvedValue(true);

            vi.stubGlobal("process", {
                argv: [],
                env: { CI: false },
                stdout: { isTTY: true },
            });

            const packageJson = {
                dependencies: {},
                devDependencies: {},
            } as NormalizedPackageJson;

            await ensurePackages(packageJson, ["package1", "package2"]);

            expect(mockConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Packages are required for this config: package1, package2. Do you want to install them?",
                }),
            );

            expect(mockInstallPackage).toHaveBeenCalledWith(["package1", "package2"], expect.any(Object));
        });

        it("should install packages when user confirms and packages are missing with custom message function", async () => {
            mockConfirm.mockResolvedValue(true);

            vi.stubGlobal("process", {
                argv: [],
                env: { CI: false },
                stdout: { isTTY: true },
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

            expect(mockConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Custom Packages are required for this config: package1, package2. Do you want to install them?",
                }),
            );

            expect(mockInstallPackage).toHaveBeenCalledWith(["package1", "package2"], expect.any(Object));
        });

        it("should not install packages when the packages are already installed", async () => {
            mockConfirm.mockResolvedValue(true);

            vi.stubGlobal("process", {
                argv: [],
                env: { CI: false },
                stdout: { isTTY: true },
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
            vi.stubGlobal("process", {
                argv: [],
                env: { CI: true },
                stdout: { isTTY: true },
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
            vi.stubGlobal("process", {
                argv: [],
                env: { CI: false },
                stdout: { isTTY: false },
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
});
