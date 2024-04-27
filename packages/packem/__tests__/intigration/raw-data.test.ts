import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - raw data", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should generate js files with included raw content", async () => {
        expect.assertions(6);

        writeFileSync(
            `${distribution}/src/index.ts`,
            `import content from './content.txt'

export const data = content;`,
        );
        writeFileSync(`${distribution}/src/content.txt`, `thisismydata`);
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/index.cjs",
            module: "./dist/index.mjs",
        });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsTextContent = readFileSync(`${distribution}/dist/content.txt.mjs`);

        expect(mjsTextContent).toBe(`const content = "thisismydata";

export { content as default };
`);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`import content from './content.txt.mjs';

const data = content;

export { data };
`);

        const cjsTextContent = readFileSync(`${distribution}/dist/content.txt.cjs`);

        expect(cjsTextContent).toBe(`'use strict';

const content = "thisismydata";

module.exports = content;
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use strict';

const content = require('./content.txt.cjs');

const data = content;

exports.data = data;
`);
    });
});
