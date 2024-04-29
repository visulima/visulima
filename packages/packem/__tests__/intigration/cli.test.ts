import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { join } from "pathe";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - typescript", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should support of tsconfig overwrite", async () => {
        expect.assertions(5);

        writeFileSync(`${distribution}/src/index.ts`, `export default class A {}`);
        writeJsonSync(`${distribution}/tsconfig.json`, {
            compilerOptions: { target: "es5" },
        });
        writeJsonSync(`${distribution}/tsconfig.build.json`, {
            compilerOptions: { target: "es2018" },
        });
        writeJsonSync(`${distribution}/package.json`, {
            exports: {
                ".": {
                    default: "./dist/index.mjs",
                    types: "./dist/index.d.ts",
                },
            },
            type: "module",
        });

        const binProcess = execPackemSync([], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const dMtsContent = readFileSync(`${distribution}/dist/index.d.mts`);

        expect(dMtsContent).toBe(`declare const _default: () => string;

export { _default as default };
`);

        const dTsContent = readFileSync(`${distribution}/dist/index.d.ts`);

        expect(dTsContent).toBe(`declare const _default: () => string;

export { _default as default };
`);

        const dCtsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(dCtsContent).toBe(`var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const index = /* @__PURE__ */ __name(() => "index", "default");

export { index as default };
`);

        const binProcessEs2018 = execPackemSync(["--tsconfig=tsconfig.build.json"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcessEs2018.stderr)).resolves.toBe("");
        expect(binProcessEs2018.exitCode).toBe(0);

        const dMtsContentEs2018 = readFileSync(`${distribution}/dist/index.d.mts`);

        expect(dMtsContentEs2018).toBe(`declare class A {
}

export { A as default };
`);

        const dTsContentEs2018 = readFileSync(`${distribution}/dist/index.d.ts`);

        expect(dTsContentEs2018).toBe(`declare class A {
}

export { A as default };
`);

        const dCtsContentEs2018 = readFileSync(`${distribution}/dist/index.mjs`);

        expect(dCtsContentEs2018).toBe(`var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const _A = class _A {
};
__name(_A, "A");
let A = _A;

export { A as default };
`);
    });
});
