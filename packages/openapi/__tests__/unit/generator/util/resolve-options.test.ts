import { describe, expect, it } from "vitest";

import resolveOptions from "../../../../src/generator/util/resolve-options";
import type { Options } from "../../../../src/generator/types";

const exclude = [
    "coverage/**",
    ".github/**",
    "packages/*/test{,s}/**",
    "**/*.d.ts",
    "test{,s}/**",
    "test{,-*}.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}",
    "**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}",
    "**/__tests__/**",
    "**/{ava,babel,nyc}.config.{js,cjs,mjs}",
    "**/jest.config.{js,cjs,mjs,ts}",
    "**/{karma,rollup,webpack}.config.js",
    "**/.{eslint,mocha}rc.{js,cjs}",
    "**/.{travis,yarnrc}.yml",
    "**/{docker-compose,docker}.yml",
    "**/.yamllint.{yaml,yml}",
    "**/node_modules/**",
    "**/pnpm-lock.yaml",
    "**/pnpm-workspace.yaml",
    "**/{package,package-lock}.json",
    "**/yarn.lock",
    "**/package.json5",
    "**/.next/**",
];

const info = {
    title: "API",
    version: "1.0.0",
};

describe("resolveOptions", () => {
    it("should merge the provided options with the default options", () => {
        const options: Options = {
            include: ["src"],
            outputFilePath: "dist/output.js",
            swaggerDefinition: { info, openapi: "" },
        };
        const expectedOptions: Required<Options> = {
            exclude,
            extensions: [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml", ".json"],
            followSymlinks: false,
            include: ["src"],
            outputFilePath: "dist/output.js",
            stopOnInvalid: true,
            swaggerDefinition: { info, openapi: "" },
            verbose: false,
        };

        const resolvedOptions = resolveOptions(options);

        expect(resolvedOptions).toStrictEqual(expectedOptions);
    });

    it("should add the exclude paths to the default exclude paths", () => {
        const options: Options = {
            exclude: ["dist"],
            include: ["src"],
            outputFilePath: "dist/output.js",
            swaggerDefinition: { info, openapi: "" },
        };
        const expectedOptions: Required<Options> = {
            exclude: [...exclude, "dist"],
            extensions: [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml", ".json"],
            followSymlinks: false,
            include: ["src"],
            outputFilePath: "dist/output.js",
            stopOnInvalid: true,
            swaggerDefinition: { info, openapi: "" },
            verbose: false,
        };

        const resolvedOptions = resolveOptions(options);

        expect(resolvedOptions).toStrictEqual(expectedOptions);
    });

    it("should throw an error if no include paths are specified", () => {
        // Arrange
        const options: Options = {
            include: [],
            outputFilePath: "dist/output.js",
            swaggerDefinition: { info, openapi: "" },
        };

        expect(() => resolveOptions(options)).toThrow("No include paths specified");
    });

    it("should throw an error if no output file path is specified", () => {
        const options: Options = {
            include: ["src"],
            outputFilePath: "",
            swaggerDefinition: { info, openapi: "" },
        };

        expect(() => resolveOptions(options)).toThrow("No output file path specified");
    });

    it("should return the resolved options with all properties set", () => {
        const options: Options = {
            exclude: ["dist"],
            extensions: [".ts"],
            followSymlinks: true,
            include: ["src"],
            outputFilePath: "dist/output.js",
            stopOnInvalid: false,
            swaggerDefinition: { info: { title: "API", version: "1.0.0" }, openapi: "3.0.0" },
            verbose: true,
        };
        const expectedOptions: Required<Options> = {
            exclude: [...exclude, "dist"],
            extensions: [".ts"],
            followSymlinks: true,
            include: ["src"],
            outputFilePath: "dist/output.js",
            stopOnInvalid: false,
            swaggerDefinition: { info: { title: "API", version: "1.0.0" }, openapi: "3.0.0" },
            verbose: true,
        };

        const resolvedOptions = resolveOptions(options);

        expect(resolvedOptions).toStrictEqual(expectedOptions);
    });
});
