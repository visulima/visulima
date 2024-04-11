import { describe, expect, it } from "vitest";

import inferEntries from "../../../../src/preset/utils/infer-entries";

describe("inferEntries", () => {
    it("recognises main and module outputs", () => {
        expect.assertions(1);

        const result = inferEntries({ main: "dist/test.cjs", module: "dist/test.mjs" }, ["src/", "src/test.ts"]);

        // eslint-disable-next-line vitest/valid-expect
        expect(result).to.deep.equal({
            cjs: true,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    input: "src/test",
                },
            ],
            warnings: [],
        });
    });

    it("handles nested indexes", () => {
        expect.assertions(1);

        const result = inferEntries({ module: "dist/index.mjs" }, ["src/", "src/event/index.ts", "src/index.ts"]);

        // eslint-disable-next-line vitest/valid-expect
        expect(result).to.deep.equal({
            cjs: false,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    input: "src/index",
                },
            ],
            warnings: [],
        });
    });

    it("handles binary outputs", () => {
        expect.assertions(3);
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ bin: "dist/cli.cjs" }, ["src/", "src/cli.ts"])).to.deep.equal({
            cjs: true,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    input: "src/cli",
                    isExecutable: true,
                },
            ],
            warnings: [],
        });
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ bin: { nuxt: "dist/cli.js" } }, ["src/", "src/cli.ts"])).to.deep.equal({
            cjs: true,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    input: "src/cli",
                    isExecutable: true,
                },
            ],
            warnings: [],
        });
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ bin: { nuxt: "dist/cli.js" }, type: "module" }, ["src/", "src/cli.ts"])).to.deep.equal({
            cjs: false,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    input: "src/cli",
                    isExecutable: true,
                },
            ],
            warnings: [],
        });
    });

    it("recognises `type: module` projects", () => {
        expect.assertions(1);

        const result = inferEntries({ main: "dist/test.js", type: "module" }, ["src/", "src/test.ts"]);

        // eslint-disable-next-line vitest/valid-expect
        expect(result).to.deep.equal({
            cjs: false,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    input: "src/test",
                },
            ],
            warnings: [],
        });
    });

    it("matches nested entrypoint paths", () => {
        expect.assertions(1);

        const result = inferEntries({ exports: "dist/runtime/index.js" }, ["src/", "src/other/runtime/index.ts"]);

        // eslint-disable-next-line vitest/valid-expect
        expect(result).to.deep.equal({
            cjs: false,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    input: "src/other/runtime/index",
                },
            ],
            warnings: [],
        });
    });

    it("handles declarations from `types`", () => {
        expect.assertions(3);
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ main: "dist/test.cjs", types: "custom/handwritten.d.ts" }, ["src/", "src/test.ts"])).to.deep.equal({
            cjs: true,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    input: "src/test",
                },
            ],
            warnings: ["Could not find entrypoint for `custom/handwritten.d.ts`"],
        });
        // eslint-disable-next-line vitest/valid-expect
        expect(
            inferEntries(
                {
                    main: "dist/test.cjs",
                    module: "dist/test.mjs",
                    types: "dist/test.d.ts",
                },
                ["src/", "src/test.ts"],
            ),
        ).to.deep.equal({
            cjs: true,
            dts: true,
            entries: [
                {
                    builder: "rollup",
                    input: "src/test",
                },
            ],
            warnings: [],
        });
        // eslint-disable-next-line vitest/valid-expect
        expect(
            inferEntries(
                {
                    main: "dist/test.cjs",
                    module: "dist/test.mjs",
                    typings: "dist/test.d.ts",
                },
                ["src/", "src/test.ts"],
            ),
        ).to.deep.equal({
            cjs: true,
            dts: true,
            entries: [
                {
                    builder: "rollup",
                    input: "src/test",
                },
            ],
            warnings: [],
        });
    });

    it("handles types within exports`", () => {
        expect.assertions(1);

        const result = inferEntries(
            {
                exports: {
                    import: {
                        default: "dist/test.mjs",
                        types: "dist/test.d.mts",
                    },
                    require: {
                        default: "dist/test.cjs",
                        types: "dist/test.d.cts",
                    },
                },
            },
            ["src/", "src/test.ts"],
        );

        // eslint-disable-next-line vitest/valid-expect
        expect(result).to.deep.equal({
            cjs: true,
            dts: true,
            entries: [
                {
                    builder: "rollup",
                    input: "src/test",
                },
            ],
            warnings: [],
        });
    });

    it("gracefully handles unknown entries", () => {
        expect.assertions(1);
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ exports: "dist/test.js" }, ["src/", "src/index.ts"])).to.deep.equal({
            cjs: false,
            dts: false,
            entries: [],
            warnings: ["Could not find entrypoint for `dist/test.js`"],
        });
    });

    it("ignores top-level exports", () => {
        expect.assertions(1);
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ exports: { "./*": "./*" } }, ["src/", "src/", "src/index.ts"])).to.deep.equal({
            cjs: false,
            dts: false,
            entries: [],
            warnings: [],
        });
    });

    it("handles multiple entries", () => {
        expect.assertions(1);
        // eslint-disable-next-line vitest/valid-expect
        expect(
            inferEntries(
                {
                    exports: {
                        ".": "./dist/index.cjs",
                        "./test": "./dist/test.cjs",
                        "first-test": "./dist/first-test.cjs",
                    },
                },
                ["src/", "src/", "src/index.ts", "src/first-test.ts", "src/test.mjs"],
            ),
        ).to.deep.equal({
            cjs: true,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    input: "src/index",
                },
                {
                    builder: "rollup",
                    input: "src/test",
                },
                {
                    builder: "rollup",
                    input: "src/first-test",
                },
            ],
            warnings: [],
        });
    });

    it("recognises directory mappings", () => {
        expect.assertions(4);
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ exports: "./dist/runtime/*" }, ["src/", "src/runtime/", "src/runtime/test.js"])).to.deep.equal({
            cjs: false,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    format: "esm",
                    input: "src/runtime/",
                    outDir: "./dist/runtime/",
                },
            ],
            warnings: [],
        });
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ exports: { "./runtime/*": "./dist/runtime/*.mjs," } }, ["src/", "src/runtime/"])).to.deep.equal({
            cjs: true,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    format: "cjs",
                    input: "src/runtime/",
                    outDir: "./dist/runtime/",
                },
            ],
            warnings: [],
        });
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ exports: { "./runtime/*": "./dist/runtime/*.mjs," }, type: "module" }, ["src/", "src/runtime/"])).to.deep.equal({
            cjs: false,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    format: "esm",
                    input: "src/runtime/",
                    outDir: "./dist/runtime/",
                },
            ],
            warnings: [],
        });
        // eslint-disable-next-line vitest/valid-expect
        expect(inferEntries({ exports: { "./runtime/*": { require: "./dist/runtime/*" } } }, ["src/", "src/runtime/"])).to.deep.equal({
            cjs: true,
            dts: false,
            entries: [
                {
                    builder: "rollup",
                    format: "cjs",
                    input: "src/runtime/",
                    outDir: "./dist/runtime/",
                },
            ],
            warnings: [],
        });
    });
});
