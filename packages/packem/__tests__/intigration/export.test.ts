import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - export", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should output 'default export' correctly", async () => {
        expect.assertions(4);

        writeFileSync(`${distribution}/src/index.ts`, `const test = "this should be in final bundle";\nexport default test;`);
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/index.cjs",
            type: "commonjs",
        });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`const test = "this should be in final bundle";

export { test as default };
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use strict';

const test = "this should be in final bundle";

module.exports = test;
`);
    });

    it("should output 'default export' correctly with named export", async () => {
        expect.assertions(4);

        writeFileSync(
            `${distribution}/src/index.ts`,
            `const test = "this should be in final bundle";\nexport const test2 = "this should be in final bundle";\nexport default test;`,
        );
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/index.cjs",
            type: "commonjs",
        });

        const binProcess = execPackemSync(["--env NODE_ENV=development", "--cjsInterop"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`const test = "this should be in final bundle";
const test2 = "this should be in final bundle";

export { test as default, test2 };
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const test = "this should be in final bundle";
const test2 = "this should be in final bundle";

module.exports = exports = test;
exports.default = test;
exports.test2 = test2;
`);
    });
});
