import type { NormalizedPackageJson } from "@visulima/package";
import { describe, expect, it } from "vitest";

import overwriteWithPublishConfig from "../../../src/preset/utils/overwrite-with-publish-config";

// eslint-disable-next-line no-secrets/no-secrets
describe("overwriteWithPublishConfig", () => {
    it("should correctly overwrite package.json properties with publishConfig properties when they exist", () => {
        expect.assertions(6);

        const package_ = {
            name: "test-package",
            publishConfig: {
                bin: {
                    "test-bin": "./bin/test-bin.js",
                },
                exports: {
                    ".": {
                        import: "./dist/main.js",
                        require: "./dist/main.js",
                    },
                },
                main: "./dist/main.js",
                module: "./dist/module.js",
                type: "module",
                types: "./dist/types.d.ts",
            },
            version: "1.0.0",
        };

        const result = overwriteWithPublishConfig(package_ as unknown as NormalizedPackageJson);

        expect(result.bin).toStrictEqual(package_.publishConfig.bin);
        expect(result.type).toStrictEqual(package_.publishConfig.type);
        expect(result.main).toStrictEqual(package_.publishConfig.main);
        expect(result.module).toStrictEqual(package_.publishConfig.module);
        expect(result.types).toStrictEqual(package_.publishConfig.types);
        expect(result.exports).toStrictEqual(package_.publishConfig.exports);
    });

    it("should return the package object with updated properties", () => {
        expect.assertions(1);

        const package_ = {
            name: "test-package",
            publishConfig: {
                bin: {
                    "test-bin": "./bin/test-bin.js",
                },
                exports: {
                    ".": {
                        import: "./dist/main.js",
                        require: "./dist/main.js",
                    },
                },
                main: "./dist/main.js",
                module: "./dist/module.js",
                type: "module",
                types: "./dist/types.d.ts",
            },
            version: "1.0.0",
        };

        const result = overwriteWithPublishConfig(package_ as unknown as NormalizedPackageJson);

        expect(result).toStrictEqual(package_);
    });

    it("should not modify package.json properties when publishConfig properties do not exist", () => {
        expect.assertions(1);

        const package_ = {
            name: "test-package",
            version: "1.0.0",
        };

        const result = overwriteWithPublishConfig(package_ as unknown as NormalizedPackageJson);

        expect(result).toStrictEqual(package_);
    });

    it("should handle empty publishConfig object", () => {
        expect.assertions(1);

        const package_ = {
            name: "test-package",
            publishConfig: {},
            version: "1.0.0",
        };

        const result = overwriteWithPublishConfig(package_ as unknown as NormalizedPackageJson);

        expect(result).toStrictEqual(package_);
    });

    it("should handle publishConfig with empty properties", () => {
        expect.assertions(1);

        const package_ = {
            name: "test-package",
            publishConfig: {
                bin: {},
                exports: {},
                main: "",
                module: "",
                type: "",
                types: "",
            },
            version: "1.0.0",
        };

        const result = overwriteWithPublishConfig(package_ as unknown as NormalizedPackageJson);

        expect(result).toStrictEqual(package_);
    });

    it("should handle package object with empty properties", () => {
        expect.assertions(1);

        const package_ = {
            name: "",
            publishConfig: {
                bin: {
                    "test-bin": "./bin/test-bin.js",
                },
                exports: {
                    ".": {
                        import: "./dist/main.js",
                        require: "./dist/main.js",
                    },
                },
                main: "./dist/main.js",
                module: "./dist/module.js",
                type: "module",
                types: "./dist/types.d.ts",
            },
            version: "",
        };

        const result = overwriteWithPublishConfig(package_ as unknown as NormalizedPackageJson);

        expect(result).toStrictEqual(package_);
    });
});
