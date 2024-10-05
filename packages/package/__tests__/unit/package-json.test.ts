import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { dirname, join, toNamespacedPath } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { NormalizedReadResult } from "../../src/package-json";
import {
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
});
