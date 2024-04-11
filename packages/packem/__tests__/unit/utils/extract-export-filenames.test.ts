import { describe, expect, it } from "vitest";

import extractExportFilenames from "../../../src/utils/extract-export-filenames";

describe("extractExportFilenames", () => {
    it("should return an empty array when packageExports is falsy", () => {
        expect.assertions(1);

        const packageExports = null;
        const type = "module";

        const result = extractExportFilenames(packageExports, type, []);

        expect(result).toStrictEqual([]);
    });

    it("should return an array with a single object when packageExports is a string", () => {
        expect.assertions(1);

        const packageExports = "index.js";
        const type = "module";

        const result = extractExportFilenames(packageExports, type, []);

        expect(result).toStrictEqual([{ file: "index.js", type: "esm" }]);
    });

    it("should return an array of objects when packageExports is an object", () => {
        expect.assertions(1);

        const packageExports = {
            "./lib": "./lib/index.js",
            "./src": "./src/index.js",
        };
        const type = "module";

        const result = extractExportFilenames(packageExports, type, []);

        expect(result).toStrictEqual([
            { file: "./lib/index.js", type: "esm" },
            { file: "./src/index.js", type: "esm" },
        ]);
    });

    it("should infer the export type from the filename when it is provided", () => {
        expect.assertions(1);

        const packageExports = {
            "./lib": "./lib/index.js",
            "./src": "./src/index.mjs",
        };
        const type = "commonjs";

        const result = extractExportFilenames(packageExports, type, []);

        expect(result).toStrictEqual([
            { file: "./lib/index.js", type: "cjs" },
            { file: "./src/index.mjs", type: "esm" },
        ]);
    });

    it('should infer the export type as "esm" when condition is "import"', () => {
        expect.assertions(1);

        const packageExports = {
            "./lib": {
                import: "./lib/index.js",
            },
            "./src": {
                import: "./src/index.js",
            },
        };
        const type = "commonjs";

        const result = extractExportFilenames(packageExports, type, []);

        expect(result).toStrictEqual([
            { file: "./lib/index.js", type: "esm" },
            { file: "./src/index.js", type: "esm" },
        ]);
    });

    it('should infer the export type as "esm" when condition is "import" and "cjs" when condition is "require"', () => {
        expect.assertions(1);

        const packageExports = {
            "./lib": {
                import: "./lib/index.mjs",
                require: "./src/index.cjs",
            },
            "./src": {
                import: "./src/index.mjs",
                require: "./src/index.cjs",
            },
        };
        const type = "commonjs";

        const result = extractExportFilenames(packageExports, type, []);

        expect(result).toStrictEqual([
            {
                file: "./lib/index.mjs",
                type: "esm",
            },
            {
                file: "./src/index.cjs",
                type: "cjs",
            },
            {
                file: "./src/index.mjs",
                type: "esm",
            },
            {
                file: "./src/index.cjs",
                type: "cjs",
            },
        ]);
    });

    it('should throw an error and exit with code 1 when inferredType does not match the package.json "type" field', () => {
        expect.assertions(1);

        const packageExports = "./src/index.cjs";
        const type = "module";

        expect(() => {
            extractExportFilenames(packageExports, type, []);
        }).toThrow('Exported file "./src/index.cjs" has an extension that does not match the package.json type "module".');
    });
});
