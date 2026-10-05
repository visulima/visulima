import { Readable } from "node:stream";

import { UploadPartCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";

import S3Storage from "../../../src/storage/aws/s3-storage";

describe("s3 request bodies", () => {
    it("should leave no unhandled error when a streamed part body breaks off", async () => {
        expect.assertions(2);

        let sentBody: Readable | undefined;
        const storage = new S3Storage({
            bucket: "bucket",
            credentials: { accessKeyId: "id", secretAccessKey: "secret" },
            region: "us-east-1",
            requestHandler: {
                handle: async (request: { body?: unknown }) => {
                    // Read the body like the HTTP handler's pipe into the socket does, and answer once it failed.
                    sentBody = request.body as Readable;
                    sentBody.resume();

                    await new Promise((resolve) => {
                        setTimeout(resolve, 20);
                    });

                    return { response: { body: Readable.from([]), headers: { etag: "\"e\"" }, statusCode: 200 } };
                },
            },
        });
        const body = Readable.from(
            (async function* breaking() {
                yield Buffer.from("abc");

                throw new Error("client went away");
            })(),
        );

        await storage.raw.send(new UploadPartCommand({ Body: body, Bucket: "bucket", ContentLength: 5, Key: "k", PartNumber: 1, UploadId: "u" }));

        // The SDK sends its own (aws-chunked) wrapper of the body; it errored with the body.
        expect(sentBody).not.toBe(body);
        expect(sentBody?.errored).toHaveProperty("message", "client went away");
    });
});
