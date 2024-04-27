import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

import { writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - copy", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should not trigger a warning if alias option is used", async () => {
        expect.assertions(4);

        writeFileSync(`${distribution}/src/index.ts`, `console.log("Hello, world!");`);
        writeFileSync(`${distribution}/assets/style.css`, `body { background-color: red; }`);
        writeFileSync(`${distribution}/assets/data.csv`, `name,age`);
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/index.cjs",
            packem: {
                rollup: {
                    copy: {
                        targets: "assets/*",
                    },
                },
            },
            type: "commonjs",
        });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(`${distribution}/dist/style.css`)).toBeTruthy();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(`${distribution}/dist/data.csv`)).toBeTruthy();
    });
});
