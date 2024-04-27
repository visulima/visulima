import { rm } from "node:fs/promises";

import { readFileSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { execPackemSync, getNodePathList, streamToString } from "../helpers";

describe.each(await getNodePathList())("node %s - output", (_, nodePath) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should generate output with all exports", async () => {
        expect.assertions(19);

        writeFileSync(`${distribution}/src/bin/cli.js`, `export const cli = 'cli';`);
        writeFileSync(`${distribution}/src/foo.js`, `export const foo = 'foo'`);
        writeFileSync(`${distribution}/src/index.js`, `export const index = 'index'`);
        writeFileSync(`${distribution}/src/index.react-server.js`, `export const index = 'index.react-server'`);
        writeJsonSync(`${distribution}/package.json`, {
            bin: {
                cli: "./dist/bin/cli.cjs",
            },
            exports: {
                ".": {
                    import: "./dist/index.cjs",
                    "react-server": "./dist/index.react-server.cjs",
                },
                "./foo": "./dist/foo.cjs",
            },
            name: "@scope/output-app",
        });

        const binProcess = execPackemSync(["--env NODE_ENV=development", "--no-color"], {
            cwd: distribution,
            nodePath,
        });

        const stdout = await streamToString(binProcess.stdout);

        await expect(streamToString(binProcess.stderr)).resolves.toBe("");

        expect(stdout).toContain("Build succeeded for output-app");
        expect(stdout).toContain("dist/index.react-server.cjs (total size: 75 Bytes, chunk size: 75 Bytes)");
        expect(stdout).toContain("exports: index");
        expect(stdout).toContain("dist/foo.cjs (total size: 54 Bytes, chunk size: 54 Bytes)");
        expect(stdout).toContain("exports: foo");
        expect(stdout).toContain("dist/bin/cli.cjs (total size: 74 Bytes, chunk size: 74 Bytes)");
        expect(stdout).toContain("exports: cli");
        expect(stdout).toContain("dist/index.mjs (total size: 42 Bytes, chunk size: 42 Bytes)");
        expect(stdout).toContain("exports: index");
        expect(stdout).toContain("dist/index.react-server.mjs (total size: 55 Bytes, chunk size: 55 Bytes)");
        expect(stdout).toContain("exports: index");
        expect(stdout).toContain("dist/foo.mjs (total size: 36 Bytes, chunk size: 36 Bytes)");
        expect(stdout).toContain("exports: foo");
        expect(stdout).toContain("dist/bin/cli.mjs (total size: 56 Bytes, chunk size: 56 Bytes)");
        expect(stdout).toContain("exports: cli");
        expect(stdout).toContain("Σ Total dist size (byte size): 714 Bytes");

        const mjsContent = readFileSync(`${distribution}/dist/index.mjs`);

        expect(mjsContent).toBe(`const index = "index";

export { index };
`);

        const cjsContent = readFileSync(`${distribution}/dist/index.cjs`);

        expect(cjsContent).toBe(`'use strict';

const index = "index";

exports.index = index;
`);
    });
});
