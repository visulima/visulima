import type { ChildProcess } from "node:child_process";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { BlobServiceClient } from "@azure/storage-blob";
import { build } from "esbuild";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { Files } from "../../../src/files";
import type MetaStorage from "../../../src/storage/meta-storage";
import type { BaseStorage } from "../../../src/storage/storage";
import type { File } from "../../../src/storage/utils/file";
import { AZURE_CONNECTION_STRING, LIVE, S3, s3Bucket } from "../backends";
import type { LiveTarget } from "./storages";
import { createLiveStorage, PART_SIZE, pattern } from "./storages";
import type { WorkerCommand, WorkerReply } from "./worker";

const HERE = dirname(fileURLToPath(import.meta.url));
// Under the package's node_modules, so the bundle's external imports resolve from there.
const WORKER = join(HERE, "../../../node_modules/.cache/storage-live/worker.mjs");
const TUS = { "Tus-Resumable": "1.0.0" };
const HOUR = 60 * 60 * 1000;

interface Service {
    hasObject: (key: string) => Promise<boolean>;
    putObject: (key: string, content: string) => Promise<void>;
    target: LiveTarget;
}

/** The services the processes share, each over a fresh bucket or container. */
const SERVICES: Record<string, () => Promise<Service>> = {
    "aws-light (MinIO)": async () => {
        const { bucket, hasObject, putObject } = await s3Bucket(S3);

        return {
            hasObject: async (key) => hasObject(key),
            putObject: async (key, content) => putObject(key, content),
            target: { bucket, kind: "aws-light", s3: S3 },
        };
    },
    "azure (Azurite)": async () => {
        const containerName = `live-${randomUUID().slice(0, 8)}`;
        const container = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING).getContainerClient(containerName);

        await container.create();

        return {
            hasObject: async (key) => container.getBlobClient(key).exists(),
            putObject: async (key, content) => {
                await container.getBlockBlobClient(key).upload(content, content.length);
            },
            target: { connectionString: AZURE_CONNECTION_STRING, containerName, kind: "azure" },
        };
    },
    "s3 (MinIO)": async () => {
        const { bucket, hasObject, putObject } = await s3Bucket(S3);

        return { hasObject: async (key) => hasObject(key), putObject: async (key, content) => putObject(key, content), target: { bucket, kind: "s3", s3: S3 } };
    },
};

interface Worker {
    call: (command: WorkerCommand) => Promise<WorkerReply>;
    child: ChildProcess;
}

const spawnWorker = (target: LiveTarget, children: ChildProcess[]): Worker => {
    const child = fork(WORKER, { env: { ...process.env, LIVE_TARGET: JSON.stringify(target) } });

    children.push(child);

    return {
        call: async (command) =>
            new Promise((resolve, reject) => {
                const onExit = (code: number | null): void => {
                    reject(new Error(`worker exited (${String(code)}) before answering ${command.op}`));
                };

                child.once("exit", onExit);
                child.once("message", (reply: WorkerReply) => {
                    child.off("exit", onExit);
                    resolve(reply);
                });
                child.send(command);
            }),
        child,
    };
};

const resultOf = <T>(reply: WorkerReply): T => {
    if (!reply.ok) {
        throw new Error(`worker failed: ${reply.error.message}`);
    }

    return reply.result as T;
};

/** Moves an upload's timestamps `ms` into the past by rewriting its record (a faked clock would be refused as skewed). */
const age = async (storage: BaseStorage, id: string, ms: number): Promise<void> => {
    const { meta } = storage as unknown as { meta: MetaStorage };
    const file = await meta.get(id);
    const back = (date: File["createdAt"]): string | undefined => (date === undefined ? undefined : new Date(Number(new Date(date)) - ms).toISOString());

    await meta.save(id, { ...file, createdAt: back(file.createdAt), expiredAt: back(file.expiredAt), modifiedAt: back(file.modifiedAt) });
};

const upload = async (storage: BaseStorage, content: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: content.length });

    await storage.write({ body: Readable.from([Buffer.from(content)]), contentLength: content.length, id: file.id, start: 0 });

    return file.id;
};

describe.runIf(LIVE)("several processes over one service (live)", () => {
    beforeAll(async () => {
        await mkdir(dirname(WORKER), { recursive: true });
        await build({ bundle: true, entryPoints: [join(HERE, "worker.ts")], format: "esm", outfile: WORKER, packages: "external", platform: "node" });
    });

    describe.each(Object.entries(SERVICES))("%s", (_name, setup) => {
        let children: ChildProcess[] = [];

        afterEach(() => {
            for (const child of children) {
                child.kill("SIGKILL");
            }

            children = [];
        });

        it("should record every chunk of a chunked REST upload PATCHed from three processes", async () => {
            expect.assertions(3);

            const { target } = await setup();
            const workers = [0, 1, 2].map(() => spawnWorker(target, children));
            const ports = await Promise.all(workers.map(async (worker) => resultOf<{ rest: number }>(await worker.call({ op: "serve" })).rest));
            const url = (worker: number, path = ""): string => `http://127.0.0.1:${String(ports[worker])}/files${path}`;
            const source = pattern(3 * PART_SIZE + 1000);
            const created = await fetch(url(0), {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": String(source.length) },
                method: "POST",
            });
            const id = String(created.headers.get("x-upload-id"));
            let pending = [0, PART_SIZE, 2 * PART_SIZE, 3 * PART_SIZE];
            const refused = new Set<number>();
            let complete = false;

            // Every chunk goes out at once, each round to another process; an appending service
            // refuses a chunk that doesn't start where the stored bytes end, and the client re-sends it.
            for (let round = 0; pending.length > 0 && round < 20; round += 1) {
                const responses = await Promise.all(
                    pending.map(async (offset, index) =>
                        fetch(url((index + round) % 3, `/${id}`), {
                            body: new Uint8Array(source.subarray(offset, Math.min(offset + PART_SIZE, source.length))),
                            headers: { "content-type": "application/octet-stream", "x-chunk-offset": String(offset) },
                            method: "PATCH",
                        }),
                    ),
                );

                pending = pending.filter((_offset, index) => {
                    const { headers, status } = responses[index] as Response;

                    complete ||= headers.get("x-upload-complete") === "true";

                    if (status === 200 || status === 202) {
                        return false;
                    }

                    refused.add(status);

                    return true;
                });
            }

            expect(complete).toBe(true);
            // A refused chunk is a conflict or a lock, never a server error.
            expect([...refused].filter((status) => status !== 409 && status !== 423)).toStrictEqual([]);

            const stored = Buffer.from(await fetch(url(1, `/${id}`)).then(async (response) => response.bytes()));

            expect(stored.equals(source)).toBe(true);
        });

        it("should let one of two processes PATCHing the same TUS offset win", async () => {
            expect.assertions(4);

            const { target } = await setup();
            const workers = [0, 1].map(() => spawnWorker(target, children));
            const ports = await Promise.all(workers.map(async (worker) => resultOf<{ tus: number }>(await worker.call({ op: "serve" })).tus));
            const url = (worker: number, path = ""): string => `http://127.0.0.1:${String(ports[worker])}/files${path}`;
            const source = pattern(PART_SIZE + 1000);
            const created = await fetch(url(0), { headers: { ...TUS, "Upload-Length": String(source.length) }, method: "POST" });
            const path = new URL(created.headers.get("location") as string, "http://localhost").pathname.slice("/files".length);
            const statuses = await Promise.all(
                [0, 1].map(async (worker) =>
                    fetch(url(worker, path), {
                        body: new Uint8Array(source),
                        headers: { ...TUS, "Content-Type": "application/offset+octet-stream", "Upload-Offset": "0" },
                        method: "PATCH",
                    }).then(({ status }) => status),
                ),
            );

            expect(statuses).toContain(204);
            // The TUS PATCH lock only holds within a process. The loser passes the offset check before
            // the winner stores its bytes, then gets 404 where its write hits the finished S3 multipart
            // upload (NoSuchUpload), or 204 on Azure, which stores the same bytes again; never a 5xx.
            expect(statuses.every((status) => [204, 404, 409, 423].includes(status))).toBe(true);
            await expect(fetch(url(1, path), { headers: TUS, method: "HEAD" }).then(({ headers }) => headers.get("upload-offset"))).resolves.toBe(
                String(source.length),
            );

            const { content } = await createLiveStorage(target).get({ id: path.slice(1) });

            expect(content.equals(source)).toBe(true);
        });

        it("should let exactly one of two processes create the same key", async ({ skip }) => {
            const { target } = await setup();
            const files = new Files({ adapter: createLiveStorage(target) });

            if (!files.capabilities.conditional.create) {
                skip("no conditional create");
            }

            expect.assertions(3);

            const workers = [1, 2].map(() => spawnWorker(target, children));
            const replies = await Promise.all(
                workers.map(async (worker, index) => worker.call({ ifNoneMatch: "*", key: "race.bin", op: "upload", seed: index + 1, size: 1024 * 1024 })),
            );
            const winner = replies.findIndex((reply) => reply.ok);

            expect(replies.filter((reply) => reply.ok)).toHaveLength(1);
            expect(replies.find((reply) => !reply.ok)).toMatchObject({ error: { code: "PreconditionFailed" } });

            const { body } = await files.download("race.bin");

            expect(body.equals(pattern(1024 * 1024, winner + 1))).toBe(true);
        });

        it("should resume in another process an upload whose process died", async () => {
            expect.assertions(2);

            const { target } = await setup();
            const size = 2 * PART_SIZE + 1000;
            const first = spawnWorker(target, children);
            const token = resultOf<string>(await first.call({ key: "big.bin", op: "start-and-die", size }));

            first.child.kill("SIGKILL");

            const second = spawnWorker(target, children);
            const { bytesWritten } = resultOf<{ bytesWritten: number }>(await second.call({ key: "big.bin", op: "resume", size, token }));
            const { body } = await new Files({ adapter: createLiveStorage(target) }).download("big.bin");

            // The second process sends only what the first didn't store.
            expect(bytesWritten).toBe(size - PART_SIZE);
            expect(body.equals(pattern(size))).toBe(true);
        });

        it("should purge from two processes at once without failing or touching what it doesn't track", async () => {
            expect.assertions(6);

            const { hasObject, putObject, target } = await setup();
            const storage = createLiveStorage(target);
            const expired = [await upload(storage, "old 1"), await upload(storage, "old 2")];
            const fresh = await upload(storage, "new");

            await Promise.all(expired.map(async (id) => age(storage, id, 2 * HOUR)));
            await putObject("foreign-object", "app data");

            const replies = await Promise.all([0, 1].map(async () => spawnWorker(target, children).call({ op: "purge" })));

            expect(replies.map((reply) => reply.ok)).toStrictEqual([true, true]);
            expect([...new Set(replies.flatMap((reply) => resultOf<string[]>(reply)))].toSorted()).toStrictEqual(expired.toSorted());
            await expect(hasObject(expired[0] as string)).resolves.toBe(false);
            await expect(hasObject(expired[1] as string)).resolves.toBe(false);
            await expect(hasObject("foreign-object")).resolves.toBe(true);
            await expect(storage.exists({ id: fresh })).resolves.toBe(true);
        });
    });
});
