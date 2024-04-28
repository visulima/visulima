import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - package.json exports", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should generate proper assets with js based on the package.json exports default", async () => {
        expect.assertions(4);

        writeFileSync(
            `${distribution}/src/index.js`,
            `import myMod from 'my-mod'

export default 'exports-sugar-default'

export function method() {
  return myMod.test()
}
`,
        );
        writeJsonSync(`${distribution}/package.json`, {
            dependencies: {
                "my-mod": "*",
            },
            exports: {
                default: "./dist/index.mjs",
                node: "./dist/index.cjs",
            },
        });

        const binProcess = execPackemSync([], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`import myMod from 'my-mod';

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const index = "exports-sugar-default";
function method() {
  return myMod.test();
}
__name(method, "method");

export { index as default, method };
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const myMod = require('my-mod');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const myMod__default = /*#__PURE__*/_interopDefaultCompat(myMod);

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const index = "exports-sugar-default";
function method() {
  return myMod__default.test();
}
__name(method, "method");

exports.default = index;
exports.method = method;
`);
    });

    it("should generate proper assets with js based on the package.json exports", async () => {
        expect.assertions(4);

        writeFileSync(`${distribution}/src/index.js`, `export default 'exports-sugar'`);
        writeJsonSync(`${distribution}/package.json`, {
            dependencies: {
                "my-mod": "*",
            },
            exports: {
                import: "./dist/index.mjs",
                module: "./dist/index.esm.js",
                require: "./dist/index.cjs",
            },
        });

        const binProcess = execPackemSync([], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const file of ["index.cjs", "index.esm.js", "index.mjs"]) {
            expect(existsSync(`${distribution}/dist/${file}`)).toBeTruthy();
        }
    });

    it("should work with dev and prod optimize conditions", async () => {
        expect.assertions(6);

        writeFileSync(`${distribution}/src/index.ts`, `export const value = process.env.NODE_ENV;`);
        writeJsonSync(`${distribution}/package.json`, {
            exports: {
                ".": {
                    default: "./dist/index.js",
                    import: {
                        default: "./dist/index.mjs",
                        development: "./dist/index.development.mjs",
                        production: "./dist/index.production.mjs",
                    },
                    require: {
                        default: "./dist/index.js",
                        development: "./dist/index.development.js",
                        production: "./dist/index.production.js",
                    },
                },
            },
        });

        const binProcess = execPackemSync([], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const [file, regex] of [
            ["index.development.cjs", /= "development"/],
            ["index.development.mjs", /= "development"/],
            ["index.production.cjs", /= "production"/],
            ["index.production.mjs", /= "production"/],
            // In vitest the NODE_ENV is set to test
            ["index.js", /= "test"/],
            ["index.mjs", /= "test"/],
        ]) {
            const content = readFileSync(`${distribution}/dist/${file}`);

            expect(content).toMatch(regex as RegExp);
        }
    });

    it("should work with dev and prod optimize conditions in nested-convention", async () => {
        expect.assertions(6);

        writeFileSync(`${distribution}/src/index.ts`, `export const value = 'index';`);
        writeFileSync(`${distribution}/src/index.production.ts`, `export const value = process.env.NODE_ENV;`);
        writeFileSync(`${distribution}/src/index.development.ts`, `export const value = process.env.NODE_ENV;`);
        writeFileSync(`${distribution}/src/core.ts`, `export const value = 'core';`);
        writeFileSync(`${distribution}/src/core.production.ts`, `export const value = 'core' + process.env.NODE_ENV;`);
        writeFileSync(`${distribution}/src/core.development.ts`, `export const value = 'core' + process.env.NODE_ENV;`);
        writeJsonSync(`${distribution}/package.json`, {
            exports: {
                ".": {
                    import: {
                        default: "./dist/index.mjs",
                        development: "./dist/index.development.mjs",
                        production: "./dist/index.production.mjs",
                    },
                    require: {
                        default: "./dist/index.js",
                        development: "./dist/index.development.js",
                        production: "./dist/index.production.js",
                    },
                },
                "./core": {
                    import: {
                        default: "./dist/core.mjs",
                        development: "./dist/core.development.mjs",
                        production: "./dist/core.production.mjs",
                    },
                    require: {
                        default: "./dist/core.js",
                        development: "./dist/core.development.js",
                        production: "./dist/core.production.js",
                    },
                },
            },
        });

        const binProcess = execPackemSync([], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const [file, regex] of [
            ["index.development.cjs", /= "development"/],
            ["index.development.mjs", /= "development"/],
            ["index.production.cjs", /= "production"/],
            ["index.production.mjs", /= "production"/],
            // In vitest the NODE_ENV is set to test
            ["index.js", /= "test"/],
            ["index.mjs", /= "test"/],

            // core export
            ["core.development.js", /= 'core' \+ "development"/],
            ["core.development.mjs", /= 'core' \+ "development"/],
            ["core.production.js", /= 'core' \+ "production"/],
            ["core.production.mjs", /= 'core' \+ "production"/],
            ["core.js", /= 'core'/],
            ["core.mjs", /= 'core'/],
        ]) {
            const content = readFileSync(`${distribution}/dist/${file}`);

            expect(content).toMatch(regex as RegExp);
        }
    });

    it("should generate proper assets for rsc condition with ts", async () => {
        expect.assertions(6);

        writeFileSync(
            `${distribution}/src/index.ts`,
            `export default 'index';
export const shared = true;

export type IString = string;`,
        );
        writeFileSync(`${distribution}/src/index.react-native.ts`, `export default 'react-native';`);
        writeFileSync(`${distribution}/src/index.react-server.ts`, `export default 'react-server';`);
        writeFileSync(
            `${distribution}/src/api/index.ts`,
            `import index, { type IString } from '../index';

export default 'api:' + index;
export { IString };`,
        );
        writeJsonSync(`${distribution}/package.json`, {
            exports: {
                ".": {
                    import: "./dist/index.mjs",
                    "react-native": "./dist/react-native.js",
                    "react-server": "./dist/react-server.mjs",
                    require: "./dist/index.cjs",
                    types: "./dist/index.d.ts",
                },
                "./api": {
                    import: "./dist/api.mjs",
                    require: "./dist/api.cjs",
                },
            },
        });

        const binProcess = execPackemSync([], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const [file, regex] of [
            ["./index.mjs", /const shared = true/],
            ["./react-server.mjs", /'react-server'/],
            ["./react-native.js", /'react-native'/],
            ["./index.d.ts", /declare const shared = true/],
            ["./api.mjs", /'pkg-export-ts-rsc'/],
        ]) {
            const content = readFileSync(`${distribution}/dist/${file}`);

            expect(content).toMatch(regex as RegExp);
        }
    });

    it("should work with nested path in exports", async () => {
        expect.assertions(6);

        writeFileSync(`${distribution}/src/foo/bar.js`, `export const value = 'foo.bar';`);
        writeJsonSync(`${distribution}/package.json`, {
            exports: {
                "./foo/bar": "./dist/foo/bar.js",
            },
        });

        const binProcess = execPackemSync([], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const content = readFileSync(`${distribution}/dist/foo/bar.js`);

        expect(content).toMatch("export const value = 'foo.bar';");
    });

    it("should work with ESM package with CJS main field", async () => {
        expect.assertions(4);

        writeFileSync(`${distribution}/src/index.js`, `export const value = 'cjs';`);
        writeJsonSync(`${distribution}/package.json`, {
            exports: {
                ".": {
                    import: "./dist/index.mjs",
                    require: "./dist/index.cjs",
                },
            },
            main: "./dist/index.cjs",
            type: "module",
        });

        const binProcess = execPackemSync([], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`const value = "cjs";

export { value };
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use strict';

const value = "cjs";

exports.value = value;
`);
    });
});
