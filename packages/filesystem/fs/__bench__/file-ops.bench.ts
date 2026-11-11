import { existsSync, readFileSync as nodeReadFileSync, renameSync as nodeRenameSync, rmSync as nodeRmSync, writeFileSync as nodeWriteFileSync } from "node:fs";
import { readFile as nodeReadFile, rename as nodeRename, rm as nodeRm, writeFile as nodeWriteFile } from "node:fs/promises";

import { ensureFile, ensureFileSync, move, moveSync, readFile, readFileSync, remove, removeSync, writeFile, writeFileSync } from "fs-extra";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, test } from "vitest";

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

const cleanupSync = (): void => {
    if (existsSync(testFile)) {
        nodeRmSync(testFile, { force: true });
    }

    if (existsSync(testFile2)) {
        nodeRmSync(testFile2, { force: true });
    }
};

describe("ensureFile (async)", () => {
    beforeEach(async () => {
        await cleanup();
    });

    afterEach(async () => {
        await cleanup();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra", async ({ bench }) => {
        await bench("fs-extra", async () => {
            await ensureFile(testFile);
        }).run();
    });

    test("@visulima/fs", async ({ bench }) => {
        await bench("@visulima/fs", async () => {
            await visulimaEnsureFile(testFile);
        }).run();
    });
});

describe("ensureFile (sync)", () => {
    beforeEach(() => {
        cleanupSync();
    });

    afterEach(() => {
        cleanupSync();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra (sync)", async ({ bench }) => {
        await bench("fs-extra (sync)", () => {
            ensureFileSync(testFile);
        }).run();
    });

    test("@visulima/fs (sync)", async ({ bench }) => {
        await bench("@visulima/fs (sync)", () => {
            visulimaEnsureFileSync(testFile);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("node:fs (sync)", async ({ bench }) => {
        await bench("node:fs (sync)", () => {
            nodeWriteFileSync(testFile, "");
        }).run();
    });
});

describe("writeFile (async)", () => {
    beforeEach(async () => {
        await cleanup();
    });

    afterEach(async () => {
        await cleanup();
    });

    test.skipIf(process.env.CODSPEED_ENV)("node:fs/promises", async ({ bench }) => {
        await bench("node:fs/promises", async () => {
            await nodeWriteFile(testFile, testData);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra", async ({ bench }) => {
        await bench("fs-extra", async () => {
            await writeFile(testFile, testData);
        }).run();
    });

    test("@visulima/fs", async ({ bench }) => {
        await bench("@visulima/fs", async () => {
            await visulimaWriteFile(testFile, testData);
        }).run();
    });
});

describe("writeFile (sync)", () => {
    beforeEach(() => {
        cleanupSync();
    });

    afterEach(() => {
        cleanupSync();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra (sync)", async ({ bench }) => {
        await bench("fs-extra (sync)", () => {
            writeFileSync(testFile, testData);
        }).run();
    });

    test("@visulima/fs (sync)", async ({ bench }) => {
        await bench("@visulima/fs (sync)", () => {
            visulimaWriteFileSync(testFile, testData);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("node:fs (sync)", async ({ bench }) => {
        await bench("node:fs (sync)", () => {
            nodeWriteFileSync(testFile, testData);
        }).run();
    });
});

describe("readFile (async)", () => {
    beforeEach(async () => {
        await nodeWriteFile(testFile, testData);
    });
    afterEach(async () => {
        await cleanup();
    });

    test.skipIf(process.env.CODSPEED_ENV)("node:fs/promises", async ({ bench }) => {
        await bench("node:fs/promises", async () => {
            await nodeReadFile(testFile);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra", async ({ bench }) => {
        await bench("fs-extra", async () => {
            await readFile(testFile);
        }).run();
    });

    test("@visulima/fs", async ({ bench }) => {
        await bench("@visulima/fs", async () => {
            await visulimaReadFile(testFile);
        }).run();
    });
});

describe("readFile (sync)", () => {
    beforeEach(() => {
        nodeWriteFileSync(testFile, testData);
    });

    afterEach(() => {
        cleanupSync();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra (sync)", async ({ bench }) => {
        await bench("fs-extra (sync)", () => {
            readFileSync(testFile);
        }).run();
    });

    test("@visulima/fs (sync)", async ({ bench }) => {
        await bench("@visulima/fs (sync)", () => {
            visulimaReadFileSync(testFile);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("node:fs (sync)", async ({ bench }) => {
        await bench("node:fs (sync)", () => {
            nodeReadFileSync(testFile);
        }).run();
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

    test.skipIf(process.env.CODSPEED_ENV)("node:fs/promises", async ({ bench }) => {
        await bench("node:fs/promises", async () => {
            await nodeRename(testFile, testFile2);
            await nodeRename(testFile2, testFile);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra", async ({ bench }) => {
        await bench("fs-extra", async () => {
            await move(testFile, testFile2, { overwrite: true });
            await move(testFile2, testFile, { overwrite: true });
        }).run();
    });

    test("@visulima/fs", async ({ bench }) => {
        await bench("@visulima/fs", async () => {
            await visulimaMove(testFile, testFile2, { overwrite: true });
            await visulimaMove(testFile2, testFile, { overwrite: true });
        }).run();
    });
});

describe("move (sync)", () => {
    beforeEach(() => {
        nodeWriteFileSync(testFile, testData);
        nodeRmSync(testFile2, { force: true });
    });

    afterEach(() => {
        cleanupSync();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra (sync)", async ({ bench }) => {
        await bench("fs-extra (sync)", () => {
            moveSync(testFile, testFile2, { overwrite: true });
            moveSync(testFile2, testFile, { overwrite: true });
        }).run();
    });

    test("@visulima/fs (sync)", async ({ bench }) => {
        await bench("@visulima/fs (sync)", () => {
            visulimaMoveSync(testFile, testFile2, { overwrite: true });
            visulimaMoveSync(testFile2, testFile, { overwrite: true });
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("node:fs (sync)", async ({ bench }) => {
        await bench("node:fs (sync)", () => {
            nodeRenameSync(testFile, testFile2);
            nodeRenameSync(testFile2, testFile);
        }).run();
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

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra", async ({ bench }) => {
        await bench("fs-extra", async () => {
            await remove(testFile);
        }).run();
    });

    test("@visulima/fs", async ({ bench }) => {
        await bench("@visulima/fs", async () => {
            await visulimaRemove(testFile);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("node:fs", async ({ bench }) => {
        await bench("node:fs", async () => {
            await nodeRm(testFile, { force: true });
        }).run();
    });
});

describe("remove (sync)", () => {
    beforeEach(() => {
        if (existsSync(testFile)) {
            nodeWriteFileSync(testFile, testData);
        }
    });

    afterEach(() => {
        cleanupSync();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fs-extra (sync)", async ({ bench }) => {
        await bench("fs-extra (sync)", () => {
            removeSync(testFile);
        }).run();
    });

    test("@visulima/fs (sync)", async ({ bench }) => {
        await bench("@visulima/fs (sync)", () => {
            visulimaRemoveSync(testFile);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("node:fs (sync)", async ({ bench }) => {
        await bench("node:fs (sync)", () => {
            nodeRmSync(testFile, { force: true });
        }).run();
    });
});
