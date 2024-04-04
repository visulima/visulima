import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - resolve-file-url", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should resolve import with file:// annotation", async () => {
        expect.assertions(4);

        writeFileSync(
            `${distribution}/src/importee.mjs`,
            `function log() {
  return 'this should be in final bundle'
}

export default log`,
        );
        writeFileSync(`${distribution}/src/importer.mjs`, `export { default as effect } from "file://${distribution}/src/importee.mjs"`);
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/importer.cjs",
            type: "commonjs",
        });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/importer.mjs`);

        expect(mjsContent).toMatchSnapshot();

        const cjsContent = readFileSync(`${distribution}/dist/importer.cjs`);

        expect(cjsContent).toMatchSnapshot();
    });
});
