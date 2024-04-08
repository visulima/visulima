import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - css modules", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should support css modules", async () => {
        expect.assertions(3);

        writeFileSync(
            `${distribution}/src/button.module.css`,
            `.Button {
  border: 1px solid transparent;
  border-radius: 4px;
}`,
        );
        writeFileSync(
            `${distribution}/src/button.tsx`,
            `import styles from "./button.module.css";
console.log(styles.Button);
`,
        );
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/button.cjs",
            module: "./dist/button.msj",
            type: "commonjs",
        });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const buttonCss = readFileSync(`${distribution}/dist/button.module.css`);

        expect(buttonCss).toBe(`.Button {
  border: 1px solid transparent;
  border-radius: 4px;
}`);

        const mjsContent = readFileSync(`${distribution}/dist/button.mjs`);

        expect(mjsContent).toBe(`function log() {
  return 'this should be in final bundle'
}

export { log as effect };
`);

        const cjsContent = readFileSync(`${distribution}/dist/button.cjs`);

        expect(cjsContent).toBe(`'use strict';

function log() {
  return 'this should be in final bundle'
}

exports.effect = log;
`);
    });
});
