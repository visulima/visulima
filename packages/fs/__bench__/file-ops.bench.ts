import { existsSync, readFileSync as nodeReadFileSync, renameSync as nodeRenameSync, rmSync as nodeRmSync, writeFileSync as nodeWriteFileSync } from "node:fs";
import { readFile as nodeReadFile, rename as nodeRename, rm as nodeRm, writeFile as nodeWriteFile } from "node:fs/promises";

import { ensureFile, ensureFileSync, move, moveSync, readFile, readFileSync, remove, removeSync, writeFile, writeFileSync } from "fs-extra";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, bench, describe } from "vitest";

import {
    ensureFile as visulimaEnsureFile,
    ensureFileSync as visulimaEnsureFileSync,
    move as visulimaMove,
    moveSync as visulimaMoveSync,
    readFile as visulimaReadFile,
    readFileSync as visulimaReadFileSync,
    remove as visulimaRemove,
    removeSync as visulimaRemoveSync,
    writeFile as visulimaWriteFile,
    writeFileSync as visulimaWriteFileSync,
} from "../src";

const testFile = "./bench-test.txt";
const testFile2 = "./bench-test2.txt";
const testData = "Hello, world!";

const cleanup = async (): Promise<void> => {
    if (existsSync(testFile)) {
        await nodeRm(testFile, { force: true });
    }

    if (existsSync(testFile2)) {
        await nodeRm(testFile2, { force: true });
    }
};

describe("ensureFile (async)", () => {
    beforeEach(async () => {
        await cleanup();
    });

    afterEach(async () => {
        await cleanup();
    });

    bench("fs-extra", async () => {
        await ensureFile(testFile);
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
        ensureFileSync(testFile);
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
        await writeFile(testFile, testData);
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
        writeFileSync(testFile, testData);
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
        await readFile(testFile);
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
        readFileSync(testFile);
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
        await move(testFile, testFile2, { overwrite: true });
        await move(testFile2, testFile, { overwrite: true });
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
        moveSync(testFile, testFile2, { overwrite: true });
        moveSync(testFile2, testFile, { overwrite: true });
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
        await remove(testFile);
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
        removeSync(testFile);
    });

    bench("@visulima/fs (sync)", () => {
        visulimaRemoveSync(testFile);
    });

    bench("node:fs (sync)", () => {
        nodeRmSync(testFile, { force: true });
    });
});
