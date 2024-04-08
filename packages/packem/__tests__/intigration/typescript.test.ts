import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
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

    describe("resolve-typescript-tsconfig-paths plugin", () => {
        it("should resolve tsconfig paths", async () => {
            expect.assertions(4);

            writeFileSync(`${distribution}/src/index.ts`, 'import "components:Test";');
            writeFileSync(`${distribution}/src/components/Test.ts`, "console.log(1);");
            writeJsonSync(`${distribution}/tsconfig.json`, {
                compilerOptions: {
                    baseUrl: "src",
                    paths: {
                        "components:*": ["components/*.ts"],
                    },
                },
            });
            writeJsonSync(`${distribution}/package.json`, { main: "./dist/index.cjs" });

            const binProcess = execPackemSync(["--env NODE_ENV=development"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const cjs = readFileSync(`${distribution}/dist/index.cjs`);

            expect(cjs).toBe(`'use strict';

console.log(1);
`);

            const mjs = readFileSync(`${distribution}/dist/index.mjs`);

            expect(mjs).toBe(`console.log(1);
`);
        });

        it("should resolve tsconfig paths with a '@'", async () => {
            expect.assertions(4);

            writeFileSync(`${distribution}/src/index.ts`, 'import "@/Test";');
            writeFileSync(`${distribution}/src/components/Test.ts`, "console.log(1);");
            writeJsonSync(`${distribution}/tsconfig.json`, {
                compilerOptions: {
                    baseUrl: "src",
                    paths: {
                        "@/*": ["components/*.ts"],
                    },
                },
            });
            writeJsonSync(`${distribution}/package.json`, { main: "./dist/index.cjs" });

            const binProcess = execPackemSync(["--env NODE_ENV=development"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const cjs = readFileSync(`${distribution}/dist/index.cjs`);

            expect(cjs).toBe(`'use strict';

console.log(1);
`);

            const mjs = readFileSync(`${distribution}/dist/index.mjs`);

            expect(mjs).toBe(`console.log(1);
`);
        });
    });

    describe("resolve-typescript-tsconfig-root-dirs plugin", () => {
        it("should resolve tsconfig rootDirs", async () => {
            expect.assertions(4);

            writeFileSync(`${distribution}/src/index.ts`, 'import { b } from "./bb";\n\nconsole.log(b);');
            writeFileSync(`${distribution}/tt/a/aa.ts`, "export const a = 1;");
            writeFileSync(`${distribution}/tt/b/bb.ts`, 'import { a } from "./aa";\nnconsole.log(a);\n\nexport const b = 2;');
            writeJsonSync(`${distribution}/tsconfig.json`, {
                compilerOptions: {
                    rootDir: ".",
                    rootDirs: ["src", "tt/b", "tt/a"],
                },
            });
            writeJsonSync(`${distribution}/package.json`, { main: "./dist/index.cjs" });

            const binProcess = execPackemSync(["--env NODE_ENV=development"], {
                cwd: distribution,
                nodePath,
            });

            await expect(streamToString(binProcess.stderr)).resolves.toBe("");
            expect(binProcess.exitCode).toBe(0);

            const cjs = readFileSync(`${distribution}/dist/index.cjs`);

            expect(cjs).toBe(`'use strict';

const a = 1;

nconsole.log(a);
const b = 2;

console.log(b);
`);

            const mjs = readFileSync(`${distribution}/dist/index.mjs`);

            expect(mjs).toBe(`const a = 1;

nconsole.log(a);
const b = 2;

console.log(b);
`);
        });
    });
});
