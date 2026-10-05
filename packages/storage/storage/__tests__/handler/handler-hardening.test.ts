import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { Readable } from "node:stream";

import { createResponse } from "node-mocks-http";
import supertest from "supertest";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import Multipart from "../../src/handler/multipart/multipart";
import MultipartFetch from "../../src/handler/multipart/multipart-fetch";
import Rest from "../../src/handler/rest/rest";
import RestFetch from "../../src/handler/rest/rest-fetch";
import { Tus } from "../../src/handler/tus/tus";
import { TUS_RESUMABLE, TUS_VERSION } from "../../src/handler/tus/tus-base";
import { Tus as TusFetch } from "../../src/handler/tus/tus-fetch";
import DiskStorage from "../../src/storage/local/disk-storage";
import { WRITE_CLAIM_KEY } from "../../src/storage/meta-storage";
import { setHeaders } from "../../src/utils/http";
import { storageOptions } from "../__helpers__/config";
import { waitForStorageReady } from "../__helpers__/utils";

const tusHeaders = { "Tus-Resumable": TUS_RESUMABLE };

describe("handler hardening", () => {
    let directory: string;
    let storage: DiskStorage;

    beforeAll(async () => {
        directory = temporaryDirectory();
        storage = new DiskStorage({ ...storageOptions, allowMIME: ["*/*"], directory });

        await waitForStorageReady(storage);
    });

    afterAll(async () => {
        await rm(directory, { force: true, recursive: true });
    });

    describe("multipart parser limits", () => {
        const form = (files: number, fileSize: number, fields: Record<string, string> = {}): FormData => {
            const data = new FormData();

            for (const [name, value] of Object.entries(fields)) {
                data.append(name, value);
            }

            for (let index = 0; index < files; index += 1) {
                data.append(`file${String(index)}`, new Blob([Buffer.alloc(fileSize, 1)], { type: "application/octet-stream" }), `f${String(index)}.bin`);
            }

            return data;
        };

        const postFetch = async (handler: MultipartFetch<never>, body: FormData): Promise<number> => {
            const response = await handler.fetch(new Request("http://localhost/files", { body, method: "POST" }));

            return response.status;
        };

        it("refuses a second file part (fetch and node)", async () => {
            expect.assertions(3);

            const fetchHandler = new MultipartFetch({ maxFileSize: 1000, storage });
            const nodeHandler = new Multipart({ maxFileSize: 1000, storage });

            await expect(postFetch(fetchHandler as never, form(1, 900))).resolves.toBe(200);
            await expect(postFetch(fetchHandler as never, form(15, 900))).resolves.toBe(413);

            const response = await supertest(nodeHandler.handle)
                .post("/files")
                .attach("a", Buffer.alloc(900, 1), "a.bin")
                .attach("b", Buffer.alloc(900, 1), "b.bin");

            expect(response.status).toBe(413);
        });

        it("bounds the total size to one file plus the form fields", async () => {
            expect.assertions(1);

            // Node shares the limits (multipartLimits); its early 413 makes supertest's upload EPIPE.
            const fetchHandler = new MultipartFetch({ maxFileSize: 100_000, storage });
            // Each field is within maxFileSize (the parser's per-part limit); together they are not.
            const fields = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`f${String(index)}`, "x".repeat(90_000)]));

            await expect(postFetch(fetchHandler as never, form(1, 10, fields))).resolves.toBe(413);
        });

        it("answers 413 for too many parts", async () => {
            expect.assertions(1);

            const fetchHandler = new MultipartFetch({ maxFileSize: 1000, storage });
            const fields = Object.fromEntries(Array.from({ length: 150 }, (_, index) => [`f${String(index)}`, "v"]));

            await expect(postFetch(fetchHandler as never, form(1, 10, fields))).resolves.toBe(413);
        });

        it("omits the extension from the Location of an unknown content type", async () => {
            expect.assertions(1);

            const data = new FormData();

            data.append("file", new Blob(["abc"], { type: "application/x-no-such-type" }), "a");

            const response = await new MultipartFetch({ storage }).fetch(new Request("http://localhost/files", { body: data, method: "POST" }));

            expect(response.headers.get("location")).not.toMatch(/\.null$/u);
        });
    });

    describe("tus", () => {
        const create = async (handler: TusFetch<never>, length: number, collection = "http://localhost/files"): Promise<Response> =>
            handler.fetch(new Request(collection, { headers: { ...tusHeaders, "Upload-Length": String(length) }, method: "POST" }));

        it("answers 423 to a DELETE while a PATCH writes, and the upload keeps its data", async () => {
            expect.assertions(3);

            const handler = new TusFetch({ storage }) as TusFetch<never>;
            const created = await create(handler, 10);
            const location = `http://localhost${created.headers.get("location") as string}`;
            let controller!: ReadableStreamDefaultController<Uint8Array>;
            const body = new ReadableStream<Uint8Array>({
                start(streamController) {
                    controller = streamController;
                },
            });
            const patch = handler.fetch(
                new Request(location, {
                    body,
                    duplex: "half",
                    headers: { ...tusHeaders, "Content-Length": "10", "Content-Type": "application/offset+octet-stream", "Upload-Offset": "0" },
                    method: "PATCH",
                } as RequestInit),
            );

            await vi.waitFor(async () => {
                const deleted = await handler.fetch(new Request(location, { headers: tusHeaders, method: "DELETE" }));

                expect(deleted.status).toBe(423);
            });

            controller.enqueue(new Uint8Array(10));
            controller.close();

            await expect(patch.then((response) => response.status)).resolves.toBe(204);

            const head = await handler.fetch(new Request(location, { headers: tusHeaders, method: "HEAD" }));

            expect(head.headers.get("upload-offset")).toBe("10");
        });

        it("sends Tus-Version with the 412 for an unsupported Tus-Resumable", async () => {
            expect.assertions(4);

            const fetchResponse = await new TusFetch({ storage }).fetch(
                new Request("http://localhost/files", { headers: { "Tus-Resumable": "0.2.2", "Upload-Length": "1" }, method: "POST" }),
            );

            expect(fetchResponse.status).toBe(412);
            expect(fetchResponse.headers.get("tus-version")).toBe(TUS_VERSION);

            const nodeResponse = await supertest(new Tus({ storage }).handle).post("/files").set("Tus-Resumable", "0.2.2").set("Upload-Length", "1");

            expect(nodeResponse.status).toBe(412);
            expect(nodeResponse.headers["tus-version"]).toBe(TUS_VERSION);
        });

        it.each(["sha256", "sha1"])("verifies a %s Upload-Checksum on creation-with-upload", async (algorithm) => {
            expect.assertions(2);

            const handler = new TusFetch({ storage });
            const post = async (checksum: string): Promise<Response> =>
                handler.fetch(
                    new Request("http://localhost/files", {
                        body: "abc",
                        headers: {
                            ...tusHeaders,
                            "Content-Length": "3",
                            "Content-Type": "application/offset+octet-stream",
                            "Upload-Checksum": `${algorithm} ${checksum}`,
                            "Upload-Length": "3",
                        },
                        method: "POST",
                    }),
                );

            await expect(post(createHash(algorithm).update("abd").digest("base64")).then((response) => response.status)).resolves.toBe(460);
            await expect(post(createHash(algorithm).update("abc").digest("base64")).then((response) => response.status)).resolves.toBe(201);
        });

        it("builds the Location without a double slash for a collection URL ending in /", async () => {
            expect.assertions(2);

            const fetchResponse = await create(new TusFetch({ storage }) as TusFetch<never>, 1, "http://localhost/files/");

            expect(fetchResponse.headers.get("location")).toMatch(/^\/files\/[^/]+$/u);

            const nodeResponse = await supertest(new Tus({ storage }).handle).post("/files/").set(tusHeaders).set("Upload-Length", "1");

            expect(nodeResponse.headers.location).toMatch(/^\/files\/[^/]+$/u);
        });

        it("reads the upload id from the URL as issued on node and fetch", async () => {
            expect.assertions(2);

            const fetchHandler = new TusFetch({ storage }) as TusFetch<never>;
            const created = await create(fetchHandler, 1);
            const id = (created.headers.get("location") as string).split("/").at(-1) as string;

            const fetchHead = await fetchHandler.fetch(new Request(`http://localhost/files/${id}.bin`, { headers: tusHeaders, method: "HEAD" }));
            const nodeHead = await supertest(new Tus({ storage }).handle).head(`/files/${id}.bin`).set(tusHeaders);

            expect(fetchHead.status).toBe(404);
            expect(nodeHead.status).toBe(404);
        });
    });

    describe("errors", () => {
        it("still answers when the onError hook throws", async () => {
            expect.assertions(2);

            const throwing = new DiskStorage({
                ...storageOptions,
                directory,
                onError: () => {
                    throw new Error("hook failed");
                },
            });

            await waitForStorageReady(throwing);

            const nodeResponse = await supertest(new Rest({ storage: throwing }).handle)
                .copy("/files")
                .timeout(2000);
            const fetchResponse = await new RestFetch({ storage: throwing }).fetch(new Request("http://localhost/files", { method: "COPY" }));

            expect(nodeResponse.status).toBe(405);
            expect(fetchResponse.status).toBe(405);
        });

        it("drops the file's headers when its stream fails before the first byte (node)", async () => {
            expect.assertions(3);

            const file = {
                bytesWritten: 100,
                contentType: "application/octet-stream",
                ETag: "abc",
                id: "broken-stream",
                metadata: {},
                name: "broken-stream",
                size: 100,
                status: "completed" as const,
            };

            vi.spyOn(storage, "getMeta").mockResolvedValueOnce(file as never);
            vi.spyOn(storage, "getStream").mockResolvedValueOnce({
                headers: {},
                size: 100,
                stream: new Readable({
                    read() {
                        this.destroy(new Error("disk gone"));
                    },
                }),
            });

            const response = await supertest(new Rest({ storage }).handle).get("/files/broken-stream").set("Range", "bytes=0-99").timeout(2000);

            expect(response.status).toBe(500);
            expect(response.headers["content-range"]).toBeUndefined();
            expect(response.headers.etag).toBeUndefined();
        });

        it("keeps the write claim out of /:id/metadata", async () => {
            expect.assertions(2);

            vi.spyOn(storage, "getMeta").mockResolvedValueOnce({
                bytesWritten: 0,
                id: "claimed",
                metadata: { title: "t", [WRITE_CLAIM_KEY]: { expiresAt: Date.now() + 1000, token: "secret" } },
                name: "claimed",
                size: 10,
                status: "part",
            } as never);

            const response = await new RestFetch({ storage }).fetch(new Request("http://localhost/files/claimed/metadata"));
            const body = (await response.json()) as { metadata: Record<string, unknown> };

            expect(body.metadata.title).toBe("t");
            expect(body.metadata).not.toHaveProperty(WRITE_CLAIM_KEY);
        });
    });

    describe("location encoding (node)", () => {
        it("keeps the escapes of an encoded path and encodes the rest", () => {
            expect.assertions(2);

            const response = createResponse();

            setHeaders(response, { Location: "/up/%C3%BC/id" });

            expect(response.getHeader("location")).toBe("/up/%C3%BC/id");

            setHeaders(response, { Location: "/up/ü/a#b%zz" });

            expect(response.getHeader("location")).toBe("/up/%C3%BC/a%23b%25zz");
        });
    });
});
