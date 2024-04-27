import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - node exports", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should output 'default export' correctly", async () => {
        expect.assertions(7);

        writeFileSync(`${distribution}/src/index.ts`, `const test = "this should be in final bundle";\nexport default test;`);
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/index.cjs",
            module: "./dist/index.mjs",
            type: "commonjs",
            types: "./dist/index.d.ts",
        });
        writeJsonSync(`${distribution}/tsconfig.json`, { compilerOptions: { rootDir: "./src" } });

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

        const dCtsContent = readFileSync(`${distribution}/dist/index.d.cts`);

        expect(dCtsContent).toBe(`declare const test = "this should be in final bundle";

export { test as default };
`);

        const dMtsContent = readFileSync(`${distribution}/dist/index.d.mts`);

        expect(dMtsContent).toBe(`declare const test = "this should be in final bundle";

export { test as default };
`);

        const dContent = readFileSync(`${distribution}/dist/index.d.ts`);

        expect(dContent).toBe(`declare const test = "this should be in final bundle";

export { test as default };
`);
    });

    describe("cjs-interop", () => {
        it("should output 'default export' correctly and dont transform dts when cjsInterop", async () => {
            expect.assertions(7);

            writeFileSync(`${distribution}/src/index.ts`, `const test = () => "this should be in final bundle";\nexport default test;`);
            writeJsonSync(`${distribution}/package.json`, {
                main: "./dist/index.cjs",
                module: "./dist/index.mjs",
                type: "commonjs",
                types: "./dist/index.d.ts",
            });
            writeJsonSync(`${distribution}/tsconfig.json`, { compilerOptions: { rootDir: "./src" } });

            const binProcess = execPackemSync(["--env NODE_ENV=development", "--cjsInterop"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

            expect(mjsContent).toBe(`var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const test = /* @__PURE__ */ __name(() => "this should be in final bundle", "test");

export { test as default };
`);

            const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

            expect(cjsContent).toBe(`'use strict';

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const test = /* @__PURE__ */ __name(() => "this should be in final bundle", "test");

module.exports = test;
`);
            const dCtsContent = readFileSync(`${distribution}/dist/index.d.cts`);

            expect(dCtsContent).toBe(`declare const test: () => string;

export { test as default };

declare const defaultExport: {

} & typeof test;

export default defaultExport;
`);

            const dMtsContent = readFileSync(`${distribution}/dist/index.d.mts`);

            expect(dMtsContent).toBe(`declare const test: () => string;

export { test as default };
`);

            const dContent = readFileSync(`${distribution}/dist/index.d.ts`);

            expect(dContent).toBe(`declare const test: () => string;

export { test as default };

declare const defaultExport: {

} & typeof test;

export default defaultExport;
`);
        });

        it("should output 'default export with named export' correctly when cjsInterop", async () => {
            expect.assertions(7);

            writeFileSync(
                `${distribution}/src/index.ts`,
                `const test = () => {
    return "this should be in final bundle";
};

const test2 = "this should be in final bundle";

export { test2, test as default };`,
            );
            writeJsonSync(`${distribution}/package.json`, {
                main: "./dist/index.cjs",
                module: "./dist/index.mjs",
                type: "commonjs",
                types: "./dist/index.d.ts",
            });
            writeJsonSync(`${distribution}/tsconfig.json`, { compilerOptions: { rootDir: "./src" } });

            const binProcess = execPackemSync(["--env NODE_ENV=development", "--cjsInterop"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

            expect(mjsContent).toBe(`var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const test = /* @__PURE__ */ __name(() => {
  return "this should be in final bundle";
}, "test");
const test2 = "this should be in final bundle";

export { test as default, test2 };
`);

            const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

            expect(cjsContent).toBe(`'use strict';



var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const test = /* @__PURE__ */ __name(() => {
  return "this should be in final bundle";
}, "test");
const test2 = "this should be in final bundle";

module.exports = test;
module.exports.test2 = test2;
`);

            const dCtsContent = readFileSync(`${distribution}/dist/index.d.cts`);

            expect(dCtsContent).toBe(`declare const test: () => string;
declare const test2 = "this should be in final bundle";

export { test2 };

declare const defaultExport: {
  test2: typeof test2;
} & typeof test;

export default defaultExport;
`);

            const dMtsContent = readFileSync(`${distribution}/dist/index.d.mts`);

            expect(dMtsContent).toBe(`declare const test: () => string;
declare const test2 = "this should be in final bundle";

export { test as default, test2 };
`);
            const dContent = readFileSync(`${distribution}/dist/index.d.ts`);

            expect(dContent).toBe(`declare const test: () => string;
declare const test2 = "this should be in final bundle";

export { test2 };

declare const defaultExport: {
  test2: typeof test2;
} & typeof test;

export default defaultExport;
`);
        });

        it("should output 'default export with multi named export' correctly when cjsInterop", async () => {
            expect.assertions(7);

            writeFileSync(
                `${distribution}/src/index.ts`,
                `const test = () => {
    return "this should be in final bundle";
};

const test2 = "this should be in final bundle";
const test3 = "this should be in final bundle";
const test4 = "this should be in final bundle";
const test5 = "this should be in final bundle";

export { test2, test3, test4, test5, test as default };`,
            );
            writeJsonSync(`${distribution}/package.json`, {
                main: "./dist/index.cjs",
                module: "./dist/index.mjs",
                type: "commonjs",
                types: "./dist/index.d.ts",
            });
            writeJsonSync(`${distribution}/tsconfig.json`, { compilerOptions: { rootDir: "./src" } });

            const binProcess = execPackemSync(["--env NODE_ENV=development", "--cjsInterop"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

            expect(mjsContent).toBe(`var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const test = /* @__PURE__ */ __name(() => {
  return "this should be in final bundle";
}, "test");
const test2 = "this should be in final bundle";
const test3 = "this should be in final bundle";
const test4 = "this should be in final bundle";
const test5 = "this should be in final bundle";

export { test as default, test2, test3, test4, test5 };
`);

            const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

            expect(cjsContent).toBe(`'use strict';



var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const test = /* @__PURE__ */ __name(() => {
  return "this should be in final bundle";
}, "test");
const test2 = "this should be in final bundle";
const test3 = "this should be in final bundle";
const test4 = "this should be in final bundle";
const test5 = "this should be in final bundle";

module.exports = test;
module.exports.test2 = test2;
module.exports.test3 = test3;
module.exports.test4 = test4;
module.exports.test5 = test5;
`);

            const dCtsContent = readFileSync(`${distribution}/dist/index.d.cts`);

            expect(dCtsContent).toBe(`declare const test: () => string;
declare const test2 = "this should be in final bundle";
declare const test3 = "this should be in final bundle";
declare const test4 = "this should be in final bundle";
declare const test5 = "this should be in final bundle";

export { test2, test3, test4, test5 };

declare const defaultExport: {
  test2: typeof test2;
  test3: typeof test3;
  test4: typeof test4;
  test5: typeof test5;
} & typeof test;

export default defaultExport;
`);
            const dMtsContent = readFileSync(`${distribution}/dist/index.d.mts`);

            expect(dMtsContent).toBe(`declare const test: () => string;
declare const test2 = "this should be in final bundle";
declare const test3 = "this should be in final bundle";
declare const test4 = "this should be in final bundle";
declare const test5 = "this should be in final bundle";

export { test as default, test2, test3, test4, test5 };
`);
            const dContent = readFileSync(`${distribution}/dist/index.d.ts`);

            expect(dContent).toBe(`declare const test: () => string;
declare const test2 = "this should be in final bundle";
declare const test3 = "this should be in final bundle";
declare const test4 = "this should be in final bundle";
declare const test5 = "this should be in final bundle";

export { test2, test3, test4, test5 };

declare const defaultExport: {
  test2: typeof test2;
  test3: typeof test3;
  test4: typeof test4;
  test5: typeof test5;
} & typeof test;

export default defaultExport;
`);
        });
    });

    it("should output 'default export' for nested folder correctly", async () => {
        expect.assertions(7);

        writeFileSync(`${distribution}/src/test/index.ts`, `const test = "this should be in final bundle";\nexport default test;`);
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/test/index.cjs",
            module: "./dist/test/index.mjs",
            type: "commonjs",
            types: "./dist/test/index.d.ts",
        });
        writeJsonSync(`${distribution}/tsconfig.json`, { compilerOptions: { rootDir: "./src" } });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/test/index.mjs`);

        expect(mjsContent).toBe(`const test = "this should be in final bundle";

export { test as default };
`);

        const cjsContent = readFileSync(`${distribution}/dist/test/index.cjs`);

        expect(cjsContent).toBe(`'use strict';

const test = "this should be in final bundle";

module.exports = test;
`);
        const dCtsContent = readFileSync(`${distribution}/dist/test/index.d.cts`);

        expect(dCtsContent).toBe(`declare const test = "this should be in final bundle";

export { test as default };
`);

        const dMtsContent = readFileSync(`${distribution}/dist/test/index.d.mts`);

        expect(dMtsContent).toBe(`declare const test = "this should be in final bundle";

export { test as default };
`);

        const dContent = readFileSync(`${distribution}/dist/test/index.d.ts`);

        expect(dContent).toBe(`declare const test = "this should be in final bundle";

export { test as default };
`);
    });
});
