import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeActionEntry } from "../../../src/cas/action-cache";
import { digestBuffer, digestFile } from "../../../src/cas/digest";
import { acEntryPath, casBlobPath, taskHashIndexPath } from "../../../src/cas/paths";
import { containsBlob, fetchBlobToFile, putBlobFromBytes, putBlobFromFile, verifyBlob } from "../../../src/cas/store";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `task-runner-cas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe("cas/digest", () => {
    let casRoot: string;

    beforeEach(async () => {
        casRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(casRoot, { force: true, recursive: true });
    });

    it("digestBuffer returns lowercase hex sha256 + size", () => {
        expect.assertions(2);

        const result = digestBuffer(Buffer.from("hello"));

        expect(result.hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
        expect(result.sizeBytes).toBe(5);
    });

    it("digestFile streams a file and returns its digest", async () => {
        expect.assertions(2);

        const filePath = join(casRoot, "sample.txt");

        await writeFile(filePath, "hello");

        const result = await digestFile(filePath);

        expect(result?.hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
        expect(result?.sizeBytes).toBe(5);
    });

    it("digestFile returns undefined for missing files", async () => {
        expect.assertions(1);

        const result = await digestFile(join(casRoot, "missing"));

        expect(result).toBeUndefined();
    });
});

describe("cas/store", () => {
    let casRoot: string;

    beforeEach(async () => {
        casRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(casRoot, { force: true, recursive: true });
    });

    it("putBlobFromBytes lands the blob at the sharded path and is idempotent", async () => {
        expect.assertions(2);

        const bytes = Buffer.from("payload");
        const digest = digestBuffer(bytes);

        await putBlobFromBytes(casRoot, digest, bytes);

        const finalPath = casBlobPath(casRoot, digest.hash);
        const stats = await stat(finalPath);

        expect(stats.size).toBe(digest.sizeBytes);
        expect(finalPath).toContain(`/v2/cas/${digest.hash.slice(0, 2)}/${digest.hash}`);

        // Second write must not throw — race idempotency contract.
        await putBlobFromBytes(casRoot, digest, bytes);
    });

    it("putBlobFromFile streams a file into the CAS", async () => {
        expect.assertions(1);

        const sourcePath = join(casRoot, "source.bin");
        const bytes = Buffer.from("binary blob");

        await writeFile(sourcePath, bytes);

        const digest = digestBuffer(bytes);

        await putBlobFromFile(casRoot, digest, sourcePath);

        await expect(containsBlob(casRoot, digest)).resolves.toBe(true);
    });

    it("fetchBlobToFile materializes a blob to a destination", async () => {
        expect.assertions(2);

        const bytes = Buffer.from("recover-me");
        const digest = digestBuffer(bytes);

        await putBlobFromBytes(casRoot, digest, bytes);

        const destination = join(casRoot, "out", "nested", "file.bin");

        await expect(fetchBlobToFile(casRoot, digest, destination)).resolves.toBe(true);
        await expect(readFile(destination)).resolves.toStrictEqual(bytes);
    });

    it("fetchBlobToFile returns false on miss", async () => {
        expect.assertions(1);

        const missing = digestBuffer(Buffer.from("not-stored"));

        await expect(fetchBlobToFile(casRoot, missing, join(casRoot, "out"))).resolves.toBe(false);
    });

    it("verifyBlob detects mismatched digests", async () => {
        expect.assertions(2);

        const bytes = Buffer.from("expected");
        const digest = digestBuffer(bytes);
        const filePath = join(casRoot, "f.bin");

        await writeFile(filePath, bytes);

        await expect(verifyBlob(filePath, digest)).resolves.toBe(true);
        await expect(verifyBlob(filePath, { hash: "deadbeef".repeat(8), sizeBytes: digest.sizeBytes })).resolves.toBe(false);
    });

    it("containsBlob returns false when size doesn't match expected", async () => {
        expect.assertions(1);

        const bytes = Buffer.from("aaaa");
        const digest = digestBuffer(bytes);

        await putBlobFromBytes(casRoot, digest, bytes);

        const fakeDigest = { hash: digest.hash, sizeBytes: digest.sizeBytes + 1 };

        await expect(containsBlob(casRoot, fakeDigest)).resolves.toBe(false);
    });
});

describe("cas/action-cache", () => {
    let casRoot: string;

    beforeEach(async () => {
        casRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(casRoot, { force: true, recursive: true });
    });

    it("writeActionEntry round-trips ActionResult JSON", async () => {
        expect.assertions(1);

        const actionHash = "a".repeat(64);
        const result = {
            exitCode: 0,
            outputDirectories: [],
            outputFiles: [{ digest: { hash: "b".repeat(64), sizeBytes: 10 }, isExecutable: false, path: "dist/index.js" }],
        };

        await writeActionEntry(casRoot, actionHash, result);

        const file = await readFile(acEntryPath(casRoot, actionHash), "utf8");

        expect(JSON.parse(file)).toStrictEqual(result);
    });

    it("task-hash index path lives under v2/task-hash-index", () => {
        expect.assertions(1);

        const path = taskHashIndexPath(casRoot, "deadbeef");

        expect(path).toContain("/v2/task-hash-index/de/deadbeef");
    });
});

describe("cache v2 helpers", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("cache.putActionResult + getActionResult round-trip with a blob", async () => {
        expect.assertions(5);

        const { Cache } = await import("../../../src/cache");

        const cache = new Cache({ workspaceRoot });
        const bytes = Buffer.from("artifact");
        const digest = digestBuffer(bytes);
        const taskHash = "tttttttttttttttttttttttttttttttt";
        const actionDigest = { hash: "c".repeat(64), sizeBytes: 0 };
        const actionResult = {
            exitCode: 0,
            outputDirectories: [],
            outputFiles: [{ digest, isExecutable: false, path: "out.txt" }],
        };

        await cache.putActionResult(taskHash, actionDigest, actionResult, [
            {
                digest,
                open: async () => Readable.from(bytes),
            },
        ]);

        // Bridge resolves task hash -> action digest.
        await expect(cache.resolveActionDigestForTaskHash(taskHash)).resolves.toBe(actionDigest.hash);

        // AC entry round-trips.
        const fetched = await cache.getActionResult(actionDigest);

        expect(fetched).toStrictEqual(actionResult);

        // Blob landed in CAS.
        await expect(containsBlob(cache.casRoot, digest)).resolves.toBe(true);

        // Materialize into the workspace.
        const ok = await cache.materializeOutputs(actionResult, workspaceRoot);

        expect(ok).toBe(true);
        await expect(readFile(join(workspaceRoot, "out.txt"))).resolves.toStrictEqual(bytes);
    });
});
