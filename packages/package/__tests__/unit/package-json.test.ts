import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { findPackageJson, parsePackageJson } from "../../src/package-json";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "package-json");

describe("package-json", () => {
    it("should return the content of the found package.json", async () => {
        expect.assertions(3);

        const result = await findPackageJson(fixturePath);

        expect(result.packageJson).toBeTypeOf("object");
        expect(result.packageJson.name).toBe("nextjs_12_example_connect");
        expect(result.path).toBe(join(fixturePath, "package.json"));
    });

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
