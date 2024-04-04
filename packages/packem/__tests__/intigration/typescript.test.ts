import { rm } from "node:fs/promises";

import { readFileSync,writeFileSync, writeJsonSync } from "@visulima/fs";
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

    describe("resolve-typescript-mjs-cjs plugin", () => {
        it("should resolve .jsx -> .tsx", async () => {
            expect.assertions(3);

            writeFileSync(`${distribution}/src/index.ts`, 'import "./file.jsx";');
            writeFileSync(`${distribution}/src/file.tsx`, "console.log(1);");
            writeJsonSync(`${distribution}/package.json`, {
                main: "./dist/index.mjs",
                type: "module",
            });

            const binProcess = execPackemSync(["--env NODE_ENV=development"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const content = readFileSync(`${distribution}/dist/index.mjs`);

            expect(content).toBe("console.log(1);\n");
        });

        it("should resolve .jsx -> .js", async () => {
            expect.assertions(3);

            writeFileSync(`${distribution}/src/index.js`, 'import "./file.jsx";');
            writeFileSync(`${distribution}/src/file.jsx`, "console.log(1);");
            writeJsonSync(`${distribution}/package.json`, {
                main: "./dist/index.mjs",
                type: "module",
            });

            const binProcess = execPackemSync(["--env NODE_ENV=development"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const content = readFileSync(`${distribution}/dist/index.mjs`);

            expect(content).toBe("console.log(1);\n");
        });

        it("should resolve .mjs -> .ts", async () => {
            expect.assertions(3);

            writeFileSync(`${distribution}/src/index.ts`, 'import "./file.mjs";');
            writeFileSync(`${distribution}/src/file.mjs`, "console.log(1);");
            writeJsonSync(`${distribution}/package.json`, {
                main: "./dist/index.mjs",
                type: "module",
            });

            const binProcess = execPackemSync(["--env NODE_ENV=development"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const content = readFileSync(`${distribution}/dist/index.mjs`);

            expect(content).toBe("console.log(1);\n");
        });

        it("should resolve .cjs -> .ts", async () => {
            expect.assertions(3);

            writeFileSync(`${distribution}/src/index.ts`, 'import "./file.cjs";');
            writeFileSync(`${distribution}/src/file.cjs`, "console.log(1);");
            writeJsonSync(`${distribution}/package.json`, {
                main: "./dist/index.mjs",
                type: "module",
            });

            const binProcess = execPackemSync(["--env NODE_ENV=development"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const content = readFileSync(`${distribution}/dist/index.mjs`);

            expect(content).toBe("console.log(1);\n");
        });
    });
});
