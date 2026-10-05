import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, vi } from "vitest";

import S3Storage from "../../src/storage/aws/s3-storage";
import AwsLightStorage from "../../src/storage/aws-light/aws-light-storage";
import { createAwsLightFake } from "../__helpers__/fakes/aws-light";
import { createS3SdkFake } from "../__helpers__/fakes/s3-sdk";
import { describeMatrix } from "../__helpers__/matrix";

vi.mock(import("aws-crt"));

// S3 takes multipart chunks of at least 5 MiB but the last.
const MIN_PART_SIZE = 5 * 1024 * 1024;

describe("s3 storage matrix (SDK fake)", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describeMatrix({
        customNamePurgeGap: "S3MetaStorage can't list its records; purge looks uploads up by object key",
        minChunkSize: MIN_PART_SIZE,
        resumable: true,
        setup: () => {
            const s3 = createS3SdkFake();

            vi.spyOn(S3Client.prototype, "send").mockImplementation(s3.send as never);

            return {
                createStorage: (options) =>
                    new S3Storage({ bucket: "bucket", credentials: { accessKeyId: "id", secretAccessKey: "secret" }, region: "us-east-1", ...options }),
                hasObject: (key) => s3.objects.has(key),
                putObject: (key, content) => {
                    s3.put(key, Buffer.from(content));
                },
            };
        },
    });
});

describe("aws-light storage matrix (HTTP fake)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describeMatrix({
        customNamePurgeGap: "AwsLightMetaStorage can't list its records; purge looks uploads up by object key",
        minChunkSize: MIN_PART_SIZE,
        resumable: true,
        setup: () => {
            const s3 = createAwsLightFake();
            const realFetch = globalThis.fetch;

            // Only the bucket host is faked: the node runtime reaches its server over real fetch.
            vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = new URL(input instanceof Request ? input.url : input);

                return url.host === "s3.test" ? s3.fetch(input, init) : realFetch(input, init);
            });

            return {
                createStorage: (options) =>
                    new AwsLightStorage({
                        accessKeyId: "id",
                        bucket: "uploads",
                        endpoint: "https://s3.test",
                        region: "auto",
                        retryConfig: { maxRetries: 0 },
                        secretAccessKey: "secret",
                        ...options,
                    }),
                hasObject: (key) => s3.objects.has(key),
                putObject: (key, content) => {
                    s3.put(key, Buffer.from(content));
                },
            };
        },
    });
});
