import { bench, describe, beforeEach, afterEach } from "vitest";
import { writeFile as nodeWriteFile, readFile as nodeReadFile, rename as nodeRename, rm as nodeRm } from "node:fs/promises";
import * as fsExtra from "fs-extra";
import {
    ensureFile as visulimaEnsureFile,
    move as visulimaMove,
    readFile as visulimaReadFile,
    remove as visulimaRemove,
    writeFile as visulimaWriteFile,
    removeSync as visulimaRemoveSync,
    ensureFileSync as visulimaEnsureFileSync,
    writeFileSync as visulimaWriteFileSync,
    readFileSync as visulimaReadFileSync,
    moveSync as visulimaMoveSync,
} from "../src";
import { existsSync, writeFileSync as nodeWriteFileSync, readFileSync as nodeReadFileSync, renameSync as nodeRenameSync, rmSync as nodeRmSync } from "node:fs";

const testFile = "./bench-test.txt";
const testFile2 = "./bench-test2.txt";
const testData = "Hello, world!";

async function cleanup() {
    if (existsSync(testFile)) {
        await nodeRm(testFile, { force: true });
    }

    if (existsSync(testFile2)) {
        await nodeRm(testFile2, { force: true });
    }
}

describe("ensureFile (async)", () => {
    beforeEach(async () => {
        await cleanup();
    });

    afterEach(async () => {
        await cleanup();
    });

    bench("fs-extra", async () => {
        await fsExtra.ensureFile(testFile);
    });

    bench("@visulima/fs", async () => {
        await visulimaEnsureFile(testFile);
    });
});

describe("ensureFile (sync)", () => {
    beforeEach(() => {
        cleanup();
    });

    afterEach(() => {
        cleanup();
    });

    bench("fs-extra (sync)", () => {
        fsExtra.ensureFileSync(testFile);
    });

    bench("@visulima/fs (sync)", () => {
        visulimaEnsureFileSync(testFile);
    });

    bench("node:fs (sync)", () => {
        nodeWriteFileSync(testFile, "");
    });
});

describe("writeFile (async)", () => {
    beforeEach(async () => {
        await cleanup();
    });

    afterEach(async () => {
        await cleanup();
    });

    bench("node:fs/promises", async () => {
        await nodeWriteFile(testFile, testData);
    });

    bench("fs-extra", async () => {
        await fsExtra.writeFile(testFile, testData);
    });

    bench("@visulima/fs", async () => {
        await visulimaWriteFile(testFile, testData);
    });
});

describe("writeFile (sync)", () => {
    beforeEach(() => {
        cleanup();
    });

    afterEach(() => {
        cleanup();
    });

    bench("fs-extra (sync)", () => {
        fsExtra.writeFileSync(testFile, testData);
    });

    bench("@visulima/fs (sync)", () => {
        visulimaWriteFileSync(testFile, testData);
    });

    bench("node:fs (sync)", () => {
        nodeWriteFileSync(testFile, testData);
    });
});

describe("readFile (async)", () => {
    beforeEach(async () => {
        await nodeWriteFile(testFile, testData);
    });
    afterEach(async () => {
        await cleanup();
    });

    bench("node:fs/promises", async () => {
        await nodeReadFile(testFile);
    });

    bench("fs-extra", async () => {
        await fsExtra.readFile(testFile);
    });

    bench("@visulima/fs", async () => {
        await visulimaReadFile(testFile);
    });
});

describe("readFile (sync)", () => {
    beforeEach(() => {
        nodeWriteFileSync(testFile, testData);
    });

    afterEach(() => {
        cleanup();
    });

    bench("fs-extra (sync)", () => {
        fsExtra.readFileSync(testFile);
    });

    bench("@visulima/fs (sync)", () => {
        visulimaReadFileSync(testFile);
    });

    bench("node:fs (sync)", () => {
        nodeReadFileSync(testFile);
    });
});

describe("move (async)", () => {
    beforeEach(async () => {
        await nodeWriteFile(testFile, testData);
        await nodeRm(testFile2, { force: true });
    });

    afterEach(async () => {
        await cleanup();
    });

    bench("node:fs/promises", async () => {
        await nodeRename(testFile, testFile2);
        await nodeRename(testFile2, testFile);
    });

    bench("fs-extra", async () => {
        await fsExtra.move(testFile, testFile2, { overwrite: true });
        await fsExtra.move(testFile2, testFile, { overwrite: true });
    });

    bench("@visulima/fs", async () => {
        await visulimaMove(testFile, testFile2, { overwrite: true });
        await visulimaMove(testFile2, testFile, { overwrite: true });
    });
});

describe("move (sync)", () => {
    beforeEach(() => {
        nodeWriteFileSync(testFile, testData);
        nodeRmSync(testFile2, { force: true });
    });

    afterEach(() => {
        cleanup();
    });

    bench("fs-extra (sync)", () => {
        fsExtra.moveSync(testFile, testFile2, { overwrite: true });
        fsExtra.moveSync(testFile2, testFile, { overwrite: true });
    });

    bench("@visulima/fs (sync)", () => {
        visulimaMoveSync(testFile, testFile2, { overwrite: true });
        visulimaMoveSync(testFile2, testFile, { overwrite: true });
    });

    bench("node:fs (sync)", () => {
        nodeRenameSync(testFile, testFile2);
        nodeRenameSync(testFile2, testFile);
    });
});

describe("remove (async)", () => {
    beforeEach(async () => {
        if (existsSync(testFile)) {
            await nodeWriteFile(testFile, testData);
        }
    });

    afterEach(async () => {
        await cleanup();
    });

    bench("fs-extra", async () => {
        await fsExtra.remove(testFile);
    });

    bench("@visulima/fs", async () => {
        await visulimaRemove(testFile);
    });

    bench("node:fs", async () => {
        await nodeRm(testFile, { force: true });
    });
});

describe("remove (sync)", () => {
    beforeEach(() => {
        if (existsSync(testFile)) {
            nodeWriteFileSync(testFile, testData);
        }
    });

    afterEach(() => {
        cleanup();
    });

    bench("fs-extra (sync)", () => {
        fsExtra.removeSync(testFile);
    });

    bench("@visulima/fs (sync)", () => {
        visulimaRemoveSync(testFile);
    });

    bench("node:fs (sync)", () => {
        nodeRmSync(testFile, { force: true });
    });
});
