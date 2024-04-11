import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { esc, execPackemSync, getNodePathList, installPackage, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - jsx", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should correctly export react tsx to js", async () => {
        expect.assertions(7);

        writeFileSync(
            `${distribution}/src/index.tsx`,
            `const Tr = () => (<tr className={"m-0 border-t border-gray-300 p-0 dark:border-gray-600 even:bg-gray-100 even:dark:bg-gray-600/20"} />);

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

        expect(mjsContent).toBe(`import { jsx } from 'react/jsx-runtime';

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const Tr = /* @__PURE__ */ __name(() => jsx("tr", { className: "m-0 border-t border-gray-300 p-0 dark:border-gray-600 even:bg-gray-100 even:dark:bg-gray-600/20" }), "Tr");

export { Tr as default };
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use strict';

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

    it("should throw a error if 'rollup.esbuild.preserve' is set in packem.config", async () => {
        expect.assertions(2);

        writeFileSync(
            `${distribution}/src/index.tsx`,
            `const Tr = () => (<tr className={"m-0 border-t border-gray-300 p-0 dark:border-gray-600 even:bg-gray-100 even:dark:bg-gray-600/20"} />);

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
        writeFileSync(
            `${distribution}/packem.config.js`,
            `module.exports = {
    rollup: {
        esbuild: {
            jsx: "preserve",
        },
    },
};`,
        );
        await installPackage(distribution, "typescript");
        await installPackage(distribution, "react");
        await installPackage(distribution, "react-dom");

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toMatch(
            esc(`Packem does not support 'preserve' jsx option. Please use 'transform' or
'automatic' instead.`),
        );
        expect(binProcess.exitCode).toBe(1);
    });

    it("should throw a error if 'preserve' is set in tsconfig", async () => {
        expect.assertions(2);

        writeFileSync(
            `${distribution}/src/index.tsx`,
            `const Tr = () => (<tr className={"m-0 border-t border-gray-300 p-0 dark:border-gray-600 even:bg-gray-100 even:dark:bg-gray-600/20"} />);

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
                jsx: "preserve",
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

        await expect(streamToString(binProcess.stderr)).resolves.toMatch(
            esc(`Packem does not support 'preserve' jsx option. Please change it to 'react' or
'react-jsx' or 'react-jsxdev' instead.`),
        );
        expect(binProcess.exitCode).toBe(1);
    });

    it("should contain 'use client' flag", async () => {
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
});
