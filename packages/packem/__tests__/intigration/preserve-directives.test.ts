import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, installPackage, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - preserve-directives", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should preserve user added shebang", async () => {
        expect.assertions(4);

        writeFileSync(
            `${distribution}/src/index.ts`,
            `#!/usr/bin/env node
console.log("Hello, world!");`,
        );
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/index.cjs",
            module: "./dist/index.mjs",
            type: "commonjs",
            types: "./dist/index.d.ts",
        });
        writeJsonSync(`${distribution}/tsconfig.json`, { "compilerOptions": { "rootDir": "./src" } });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`#!/usr/bin/env node
console.log("Hello, world!");
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`#!/usr/bin/env node
'use strict';

console.log("Hello, world!");
`);
    });

    it("should preserve package.json bin added shebang", async () => {
        expect.assertions(4);

        writeFileSync(`${distribution}/src/index.ts`, `console.log("Hello, world!");`);
        writeJsonSync(`${distribution}/package.json`, {
            bin: "./dist/index.cjs",
            type: "commonjs",
            types: "./dist/index.d.ts",
        });
        writeJsonSync(`${distribution}/tsconfig.json`, { "compilerOptions": { "rootDir": "./src" } });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`#!/usr/bin/env node
console.log("Hello, world!");
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`#!/usr/bin/env node
'use strict';

console.log("Hello, world!");
`);
    });

    it("should preserve directives like 'use client;'", async () => {
        expect.assertions(7);

        writeFileSync(
            `${distribution}/src/index.tsx`,
            `"use client";

const Tr = () => (<tr className={"m-0 border-t border-gray-300 p-0 dark:border-gray-600 even:bg-gray-100 even:dark:bg-gray-600/20"} />);

export default Tr;`,
        );
        writeJsonSync(`${distribution}/package.json`, {
            dependencies: {
                react: "^18.2.0",
                "react-dom": "^18.2.0",
            },
            devDependencies: {
                "@types/react": "^18.0.0",
                "@types/react-dom": "^18.0.0",
                typescript: "^5",
            },
            main: "./dist/index.cjs",
            module: "./dist/index.mjs",
            type: "commonjs",
            types: "./dist/index.d.ts",
        });
        writeJsonSync(`${distribution}/tsconfig.json`, {
            compilerOptions: {
                jsx: "react-jsx",
                moduleResolution: "bundler",
            },
        });

        await installPackage(distribution, "typescript");
        await installPackage(distribution, "react");
        await installPackage(distribution, "react-dom");

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`'use client';
import { jsx } from 'react/jsx-runtime';

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const Tr = /* @__PURE__ */ __name(() => jsx("tr", { className: "m-0 border-t border-gray-300 p-0 dark:border-gray-600 even:bg-gray-100 even:dark:bg-gray-600/20" }), "Tr");

export { Tr as default };
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use client';
'use strict';

const jsxRuntime = require('react/jsx-runtime');

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const Tr = /* @__PURE__ */ __name(() => jsxRuntime.jsx("tr", { className: "m-0 border-t border-gray-300 p-0 dark:border-gray-600 even:bg-gray-100 even:dark:bg-gray-600/20" }), "Tr");

module.exports = Tr;
`);
        const dCtsContent = readFileSync(`${distribution}/dist/index.d.cts`);

        expect(dCtsContent).toBe(`declare const Tr: () => any;

export { Tr as default };
`);

        const dMtsContent = readFileSync(`${distribution}/dist/index.d.mts`);

        expect(dMtsContent).toBe(`declare const Tr: () => any;

export { Tr as default };
`);

        const dContent = readFileSync(`${distribution}/dist/index.d.ts`);

        expect(dContent).toBe(`declare const Tr: () => any;

export { Tr as default };
`);
    });

    it("should merge duplicated directives", async () => {
        expect.assertions(6);

        writeFileSync(
            `${distribution}/src/cli.ts`,
            `#!/usr/bin/env node
console.log("Hello, cli!");`,
        );
        writeFileSync(`${distribution}/src/index.ts`, `export const foo = 'foo';`);
        writeJsonSync(`${distribution}/package.json`, {
            bin: {
                packem: "./dist/cli.cjs",
            },
            main: "./dist/index.cjs",
            module: "./dist/index.mjs",
            type: "commonjs",
            types: "./dist/index.d.ts",
        });
        writeJsonSync(`${distribution}/tsconfig.json`, { "compilerOptions": { "rootDir": "./src" } });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`const foo = "foo";

export { foo };
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use strict';

const foo = "foo";

exports.foo = foo;
`);

        const cjsCliContent = readFileSync(`${distribution}/dist/cli.cjs`);

        expect(cjsCliContent).toBe(`#!/usr/bin/env node
'use strict';

console.log("Hello, cli!");
`);
        const dtsContent = readFileSync(`${distribution}/dist/cli.d.ts`);

        expect(dtsContent).toBe(`\n`);
    });

    it("should merge duplicated directives from many files", async () => {
        expect.assertions(4);

        writeFileSync(`${distribution}/src/bar.ts`, `'use client';export const bar = 'bar';`);
        writeFileSync(
            `${distribution}/src/foo.ts`,
            `"use client";
'use sukka';

export const foo = 'foo';`,
        );
        writeFileSync(
            `${distribution}/src/index.ts`,
            `export { foo } from './foo';
export { bar } from './bar';
export const baz = 'baz';`,
        );
        writeJsonSync(`${distribution}/package.json`, {
            main: "./dist/index.cjs",
            module: "./dist/index.mjs",
            packem: {
                rollup: {
                    output: {
                        preserveModules: false,
                    },
                },
            },
            type: "commonjs",
            types: "./dist/index.d.ts",
        });
        writeJsonSync(`${distribution}/tsconfig.json`, { "compilerOptions": { "rootDir": "./src" } });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");
        expect(binProcess.exitCode).toBe(0);

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`'use client';
'use sukka';
const foo = "foo";

const bar = "bar";

const baz = "baz";

export { bar, baz, foo };
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use client';
'use sukka';
'use strict';

const foo = "foo";

const bar = "bar";

const baz = "baz";

exports.bar = bar;
exports.baz = baz;
exports.foo = foo;
`);
    });
});
