import { S3Client } from "@aws-sdk/client-s3";
import { temporaryDirectory } from "tempy";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tus as TusFetch } from "../../../../src/handler/tus/tus-fetch";
import S3Storage from "../../../../src/storage/aws/s3-storage";
import DiskStorage from "../../../../src/storage/local/disk-storage";
import MemoryMetaStorage from "../../../../src/storage/memory/memory-meta-storage";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import type MetaStorage from "../../../../src/storage/meta-storage";
import { WRITE_CLAIM_KEY } from "../../../../src/storage/meta-storage";
import type { BaseStorage } from "../../../../src/storage/storage";
import type { File } from "../../../../src/storage/utils/file";
import { createS3SdkFake } from "../../../__helpers__/fakes/s3-sdk";

vi.mock(import("aws-crt"));

const BASE = "http://localhost/files";
const TUS = { "Tus-Resumable": "1.0.0" };

/** Two storages over one meta store and one byte store stand in for two server processes. */
const PROCESSES: Record<string, () => [BaseStorage, BaseStorage]> = {
    disk: () => {
        const directory = temporaryDirectory();

        return [new DiskStorage({ directory }), new DiskStorage({ directory })];
    },
    memory: () => {
        const metaStore = new Map<string, File>();
        const [first, second] = [0, 1].map(() => new MemoryStorage({ metaStorage: new MemoryMetaStorage({ store: metaStore }) })) as [MemoryStorage, MemoryStorage];

        // Share the byte store too (private, test-only).
        Object.defineProperty(second, "store", { value: (first as unknown as { store: unknown }).store });

        return [first, second];
    },
    s3: () => {
        const s3 = createS3SdkFake();

        vi.spyOn(S3Client.prototype, "send").mockImplementation(s3.send as never);

        const create = (): S3Storage => new S3Storage({ bucket: "bucket", credentials: { accessKeyId: "id", secretAccessKey: "secret" }, region: "us-east-1" });

        return [create(), create()];
    },
};

const metaOf = (storage: BaseStorage): MetaStorage => (storage as unknown as { meta: MetaStorage }).meta;

describe.each(Object.entries(PROCESSES))("tus PATCH across processes (%s)", (_name, setup) => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const start = async () => {
        const storages = setup();

        await Promise.all(storages.map(async (storage) => storage.ensureReady()));

        const handlers = storages.map((storage) => new TusFetch({ storage }));
        const send = async (process: number, method: string, url: string, headers: Record<string, string> = {}, body?: string): Promise<Response> =>
            (handlers[process] as TusFetch).fetch(
                new Request(url, { body, headers: { ...TUS, ...(body === undefined ? {} : { "Content-Length": String(body.length) }), ...headers }, method }),
            );
        const patch = async (process: number, url: string, offset: number, body: string): Promise<Response> =>
            send(process, "PATCH", url, { "Content-Type": "application/offset+octet-stream", "Upload-Offset": String(offset) }, body);
        const created = await send(0, "POST", BASE, { "Upload-Length": "10", "Upload-Metadata": `name ${Buffer.from("a.txt").toString("base64")}` });
        const url = new URL(created.headers.get("location") as string, BASE).toString();
        const id = url.slice(url.lastIndexOf("/") + 1);

        return { id, patch, send, storages, url };
    };

    it("should answer 423 to a PATCH of the same offset while another process writes it", async () => {
        expect.assertions(7);

        const { id, patch, send, storages, url } = await start();
        const [first] = storages;
        const { write } = first;
        let release: () => void = () => undefined;

        vi.spyOn(first, "write").mockImplementationOnce(async (part) => {
            await new Promise<void>((resolve) => {
                release = resolve;
            });

            return write.call(first, part);
        });

        const winner = patch(0, url, 0, "0123456789");

        await vi.waitFor(() => {
            if (vi.mocked(first.write).mock.calls.length === 0) {
                throw new Error("first PATCH has not reached the storage yet");
            }
        });

        await expect(patch(1, url, 0, "abcdefghij").then(({ status }) => status)).resolves.toBe(423);
        // The claim is server bookkeeping, never shown to clients.
        await expect(send(1, "HEAD", url).then(({ headers }) => headers.get("upload-metadata"))).resolves.toBe(`name ${Buffer.from("a.txt").toString("base64")}`);
        await expect(send(1, "GET", url).then(async (response) => (await response.json()) as File)).resolves.not.toHaveProperty(["metadata", WRITE_CLAIM_KEY]);

        release();

        await expect(winner.then(({ status }) => status)).resolves.toBe(204);
        // Late, the loser's PATCH is a plain offset mismatch.
        await expect(patch(1, url, 0, "abcdefghij").then(({ status }) => status)).resolves.toBe(409);

        const { content } = await (storages[1]).get({ id });

        expect(Buffer.from(content).toString()).toBe("0123456789");
        // Released: the next PATCH is never blocked by it.
        await expect(metaOf(first).get(id)).resolves.not.toHaveProperty(["metadata", WRITE_CLAIM_KEY]);
    });

    it("should let exactly one of two processes claim an upload when both read the same record", async () => {
        expect.assertions(2);

        const { id, storages } = await start();
        const results = await Promise.allSettled(storages.map(async (storage) => storage.claimWrite(id)));

        expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
        expect(results.find(({ status }) => status === "rejected")).toMatchObject({ reason: { UploadErrorCode: "FileLocked" } });
    });

    it("should not be blocked by the expired claim of a crashed process", async () => {
        expect.assertions(2);

        const { id, patch, storages, url } = await start();
        const meta = metaOf(storages[0]);
        const record = await meta.get(id);

        await meta.save(id, { ...record, metadata: { ...record.metadata, [WRITE_CLAIM_KEY]: { expiresAt: Date.now() - 1, token: "crashed" } } });

        await expect(patch(1, url, 0, "0123456789").then(({ status }) => status)).resolves.toBe(204);
        await expect(meta.get(id)).resolves.not.toHaveProperty(["metadata", WRITE_CLAIM_KEY]);
    });
});

describe("tus PATCH over a meta store without conditional saves", () => {
    it("should claim nothing, leaving PATCHes serialized only within one process", async () => {
        expect.assertions(1);

        class PlainMetaStorage extends MemoryMetaStorage {
            public override readonly supportsConditionalSave = false;
        }

        const storage = new MemoryStorage({ metaStorage: new PlainMetaStorage() });
        const { id } = await storage.create({ metadata: {}, size: 10 });
        const release = await storage.claimWrite(id);

        await release();

        await expect(storage.claimWrite(id)).resolves.toBeTypeOf("function");
    });
});
