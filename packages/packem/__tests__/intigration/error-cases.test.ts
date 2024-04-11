import { mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";

import { writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - jsx", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should throw a error if no package.json was found", async () => {
        expect.assertions(2);

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toMatch("No such file or directory, for package.json found.");
        expect(binProcess.exitCode).toBe(1);
    });

    it("should throw a error if package.json is invalid", async () => {
        expect.assertions(2);

        writeFileSync(`${distribution}/package.json`, "{");

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toMatch("Unexpected end of JSON input in");
        expect(binProcess.exitCode).toBe(1);
    });

    it("should throw a error if no src directory was found", async () => {
        expect.assertions(2);

        writeJsonSync(`${distribution}/package.json`, {
            dependencies: {},
            name: "pkg",
        });

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toMatch("No 'src' directory found. Please provide entries manually.");
        expect(binProcess.exitCode).toBe(1);
    });

    it("should throw a error if src dir has no entries", async () => {
        expect.assertions(2);

        writeJsonSync(`${distribution}/package.json`, {
            dependencies: {},
            name: "pkg",
        });
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(`${distribution}/src`);

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toMatch("No source files found in 'src' directory. Please provide entries manually.");
        expect(binProcess.exitCode).toBe(1);
    });

    it("should throw a error if package.json has no entry", async () => {
        expect.assertions(2);

        writeJsonSync(`${distribution}/package.json`, {
            dependencies: {},
            name: "pkg",
        });
        writeFileSync(`${distribution}/src/index.ts`, "");

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stderr)).resolves.toMatch("No entries detected. Please provide entries manually.");
        expect(binProcess.exitCode).toBe(1);
    });

    it.todo("should throw a error if conflicting entry in package.json", async () => {
        expect.assertions(2);

        writeJsonSync(`${distribution}/package.json`, {
            dependencies: {},
            main: "dist/index.js",
            module: "dist/index.js",
            name: "pkg",
        });
        writeFileSync(`${distribution}/src/index.ts`, "");

        const binProcess = execPackemSync(["--env NODE_ENV=development"], {
            cwd: distribution,
            nodePath,
        });

        await expect(streamToString(binProcess.stdout)).resolves.toBe("")
        await expect(streamToString(binProcess.stderr)).resolves.toMatch(`Conflicting field "module" with entry "dist/index.js" detected. Conflicts with "main" field. Please change one of the entries inside your package.json.`);
        expect(binProcess.exitCode).toBe(1);
    });
});
