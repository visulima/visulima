import { randomUUID } from "node:crypto";

import { BlobServiceClient } from "@azure/storage-blob";
import { describe, expect, it } from "vitest";

import type MetaStorage from "../../../src/storage/meta-storage";
import { getMetaVersion } from "../../../src/storage/meta-storage";
import type { BaseStorage } from "../../../src/storage/storage";
import { AZURE_CONNECTION_STRING, LIVE, S3, s3Bucket, SEAWEEDFS } from "../backends";
import type { LiveTarget } from "./storages";
import { createLiveStorage } from "./storages";

/**
 * Two processes share an upload only through its record, so a writer's compare-and-swap is what
 * keeps a second writer from overwriting the first. The fakes can't show whether a real service
 * changes a record's version on every write: S3, R2 and MinIO gave every header-only record the same
 * empty-body ETag, so both writers' saves succeeded and both claimed the upload.
 */
const TARGETS: Record<string, () => Promise<LiveTarget>> = {
    "aws-light (MinIO)": async () => {
        const { bucket } = await s3Bucket(S3);

        return { bucket, kind: "aws-light", s3: S3 };
    },
    "aws-light (SeaweedFS)": async () => {
        const { bucket } = await s3Bucket(SEAWEEDFS);

        return { bucket, kind: "aws-light", s3: SEAWEEDFS };
    },
    "azure (Azurite)": async () => {
        const containerName = `live-${randomUUID().slice(0, 8)}`;

        await BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING).getContainerClient(containerName).create();

        return { connectionString: AZURE_CONNECTION_STRING, containerName, kind: "azure" };
    },
    "s3 (MinIO)": async () => {
        const { bucket } = await s3Bucket(S3);

        return { bucket, kind: "s3", s3: S3 };
    },
    "s3 (SeaweedFS)": async () => {
        const { bucket } = await s3Bucket(SEAWEEDFS);

        return { bucket, kind: "s3", s3: SEAWEEDFS };
    },
};

const metaOf = (storage: BaseStorage): MetaStorage => (storage as unknown as { meta: MetaStorage }).meta;

/** An upload just created: its record is in the meta store, and nothing completes it. */
const createUpload = async (storage: BaseStorage): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

    return file.id;
};

describe.runIf(LIVE).each(Object.entries(TARGETS))("conditional record saves on %s (live)", (_name, setup) => {
    // Two instances stand in for two processes: no shared lock or cache, only the service.
    it("should refuse the second of two writers that read the same version of a record", async () => {
        expect.assertions(4);

        const target = await setup();
        const first = createLiveStorage(target);
        const second = createLiveStorage(target);
        const id = await createUpload(first);
        const [readByFirst, readBySecond] = await Promise.all([metaOf(first).get(id), metaOf(second).get(id)]);
        const version = getMetaVersion(readByFirst);

        expect(version).toBeDefined();

        await expect(
            metaOf(first).saveIfVersion(id, { ...readByFirst, metadata: { ...readByFirst.metadata, writer: "first" } }, version as string),
        ).resolves.toBeDefined();
        await expect(
            metaOf(second).saveIfVersion(
                id,
                { ...readBySecond, metadata: { ...readBySecond.metadata, writer: "second" } },
                getMetaVersion(readBySecond) as string,
            ),
        ).resolves.toBeUndefined();

        const stored = await metaOf(second).get(id);

        expect(stored.metadata.writer).toBe("first");
    });

    it("should let only one of two processes claim an upload at once", async () => {
        expect.assertions(3);

        const target = await setup();
        const first = createLiveStorage(target);
        const second = createLiveStorage(target);
        const id = await createUpload(first);
        const claims = await Promise.allSettled([first.claimWrite(id), second.claimWrite(id)]);
        const won = claims.filter((claim) => claim.status === "fulfilled");

        expect(won).toHaveLength(1);
        expect(claims.find((claim) => claim.status === "rejected")).toMatchObject({ reason: { UploadErrorCode: "FileLocked" } });

        // Released, the upload can be claimed again.
        await (won[0] as PromiseFulfilledResult<() => Promise<void>>).value();

        const again = await second.claimWrite(id);

        await again();

        expect(again).toBeTypeOf("function");
    });
});
