import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - alias", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should not trigger a warning if alias option is used", async () => {
        expect.assertions(4);

        writeFileSync(
            `${distribution}/src/index.ts`,
            `import { log } from "@/test/logger";

export default log();`,
        );
        writeFileSync(`${distribution}/src/test/logger.ts`, `export const log = () => console.log("test");`);
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/index.cjs",
            type: "commonjs",
        });
        writeFileSync(
            `${distribution}/packem.config.ts`,
            `import { resolve } from "path";

export default [{
    alias: {
        '@/test/*': resolve('${distribution}', 'src/test'),
    },
}];`,
        );

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stdout)).resolves.toBe("");
        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/importer.mjs`);

        expect(mjsContent).toMatchSnapshot();

        const cjsContent = readFileSync(`${distribution}/dist/importer.cjs`);

        expect(cjsContent).toMatchSnapshot();
    });
});
