import { rm } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";

import express from "express";
import supertest from "supertest";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Rest from "../../../src/handler/rest/rest";
import DiskStorage from "../../../src/storage/local/disk-storage";
import type { DiskStorageOptions } from "../../../src/storage/types";
import type { File } from "../../../src/storage/utils/file";
import { waitForStorageReady } from "../../__helpers__/utils";

const BODY = Buffer.from(Array.from({ length: 1000 }, (_, index) => index % 256));

const collectBinary = (response: NodeJS.ReadableStream, callback: (error: Error | null, body: Buffer) => void): void => {
    const chunks: Buffer[] = [];

    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => callback(null, Buffer.concat(chunks)));
};

const exposed = (response: supertest.Response): string[] => String(response.headers["access-control-expose-headers"] ?? "").split(",");

describe("baseHandlerNode", () => {
    let directory: string;
    let storage: DiskStorage;
    let rest: Rest<File>;
    let server: ReturnType<typeof createServer>;

    const setup = async (options: Partial<DiskStorageOptions<File>> = {}): Promise<void> => {
        storage = new DiskStorage({ directory, ...options });
        await waitForStorageReady(storage);
        rest = new Rest({ storage });
        server = createServer((request, response) => {
            rest.handle(request, response).catch(() => undefined);
        });
    };

    const upload = async (body: Buffer = BODY): Promise<string> => {
        const response = await supertest(server).post("/files").set("Content-Type", "application/octet-stream").send(body);

        return response.body.id as string;
    };

    beforeEach(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await rm(directory, { force: true, recursive: true });
    });

    describe("range requests", () => {
        it("should stream the requested bytes from disk with 206", async () => {
            expect.assertions(4);

            await setup();

            const id = await upload();
            const response = await supertest(server).get(`/files/${id}`).set("Range", "bytes=100-199").buffer(true).parse(collectBinary);

            expect(response.status).toBe(206);
            expect(response.headers["content-range"]).toBe("bytes 100-199/1000");
            expect(response.headers["content-length"]).toBe("100");
            expect(Buffer.compare(response.body as Buffer, BODY.subarray(100, 200))).toBe(0);
        });

        it("should stream a range spanning several read chunks of a larger file", async () => {
            expect.assertions(2);

            await setup();

            const large = Buffer.from(Array.from({ length: 300 * 1024 }, (_, index) => (index * 7) % 256));
            const id = await upload(large);
            const response = await supertest(server).get(`/files/${id}`).set("Range", "bytes=1000-300000").buffer(true).parse(collectBinary);

            expect(response.status).toBe(206);
            expect(Buffer.compare(response.body as Buffer, large.subarray(1000, 300_001))).toBe(0);
        });

        it("should answer 416 with Content-Range for a range past the end", async () => {
            expect.assertions(2);

            await setup();

            const id = await upload();
            const response = await supertest(server).get(`/files/${id}`).set("Range", "bytes=5000-");

            expect(response.status).toBe(416);
            expect(response.headers["content-range"]).toBe("bytes */1000");
        });

        it("should honour If-Range only with the current Last-Modified date", async () => {
            expect.assertions(3);

            await setup();

            const id = await upload();
            const head = await supertest(server).head(`/files/${id}`);
            const lastModified = head.headers["last-modified"] as string;

            expect(lastModified).toMatch(/GMT$/u);

            const current = await supertest(server).get(`/files/${id}`).set("Range", "bytes=0-9").set("If-Range", lastModified);

            expect(current.status).toBe(206);

            const stale = await supertest(server).get(`/files/${id}`).set("Range", "bytes=0-9").set("If-Range", "Thu, 01 Jan 1970 00:00:00 GMT");

            expect(stale.status).toBe(200);
        });
    });

    describe("error responses", () => {
        it("should hide the message of an unexpected error from the client and emit it to listeners", async () => {
            expect.assertions(3);

            const onError = vi.fn();

            await setup({ onError });

            const listener = vi.fn();

            rest.on("error", listener);
            vi.spyOn(storage, "getMeta").mockRejectedValue(new Error("EACCES /srv/secret"));

            const response = await supertest(server).get("/files/a1b2c3d4-e5f6-4789-abcd-1234567890ab");

            expect(response.status).toBe(500);
            expect(response.body).toStrictEqual({ error: { code: "Error", message: "Something went wrong", name: "Error" } });
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({ message: "EACCES /srv/secret", request: expect.objectContaining({ method: "GET" }) }));
        });

        it("should answer an UploadErrorCode without a mapped response as an unknown error", async () => {
            expect.assertions(2);

            await setup();
            vi.spyOn(storage, "getMeta").mockRejectedValue(Object.assign(new Error("custom"), { UploadErrorCode: "SomethingCustom" }));

            const response = await supertest(server).get("/files/a1b2c3d4-e5f6-4789-abcd-1234567890ab");

            expect(response.status).toBe(500);
            expect(response.body.error.message).toBe("Something went wrong");
        });

        it("should answer 405 for a method without a handler", async () => {
            expect.assertions(1);

            await setup();

            const response = await supertest(server).trace("/files");

            expect(response.status).toBe(405);
        });

        it("should answer 503 when the storage access check fails", async () => {
            expect.assertions(1);

            await setup();
            storage.isReady = false;
            vi.spyOn(storage, "ensureReady").mockRejectedValue(new Error("disk gone"));

            const response = await supertest(server).get("/files");

            expect(response.status).toBe(503);
        });

        it("should answer with an error when onComplete throws", async () => {
            expect.assertions(1);

            await setup();

            storage.onComplete = () => {
                throw new Error("hook failed");
            };

            const response = await supertest(server).post("/files").set("Content-Type", "application/octet-stream").send(BODY);

            expect(response.status).toBe(500);
        });
    });

    describe("responses", () => {
        it("should build an absolute Location from the Forwarded header, else from Host and the connection", async () => {
            expect.assertions(2);

            await setup();

            const forwarded = await supertest(server)
                .post("/files")
                .set("Content-Type", "application/octet-stream")
                .set("Forwarded", "host=cdn.example.com;proto=https")
                .send(BODY);

            expect(forwarded.headers.location).toMatch(/^https:\/\/cdn\.example\.com\/files\/[^/]+\.bin$/u);

            const direct = await supertest(server).post("/files").set("Content-Type", "application/octet-stream").set("Host", "uploads.test:8080").send(BODY);

            expect(direct.headers.location).toMatch(/^http:\/\/uploads\.test:8080\/files\/[^/]+\.bin$/u);
        });

        it("should build a relative Location when configured", async () => {
            expect.assertions(1);

            await setup({ useRelativeLocation: true });

            const response = await supertest(server).post("/files").set("Content-Type", "application/octet-stream").send(BODY);

            expect(response.headers.location).toMatch(/^\/files\/[^/]+\.bin$/u);
        });

        it("should keep the response headers when onComplete clears them", async () => {
            expect.assertions(2);

            await setup();

            storage.onComplete = (_file, response) => {
                (response as { headers: Record<string, string> }).headers = {};
            };

            const response = await supertest(server).post("/files").set("Content-Type", "application/octet-stream").send(BODY);

            expect(response.status).toBe(201);
            expect(response.headers.location).toBeDefined();
        });

        it("should merge headers onComplete adds with the original ones", async () => {
            expect.assertions(2);

            await setup();

            storage.onComplete = (_file, response) => {
                (response as { headers: Record<string, string> }).headers["X-Hook"] = "1";
            };

            const response = await supertest(server).post("/files").set("Content-Type", "application/octet-stream").send(BODY);

            expect(response.headers["x-hook"]).toBe("1");
            expect(response.headers.location).toBeDefined();
        });

        it("should answer a partial batch delete with 207 and the deleted items", async () => {
            expect.assertions(4);

            await setup();

            const id = await upload();
            const response = await supertest(server).delete(`/files?ids=${id},missing-one`);

            expect(response.status).toBe(207);
            expect(response.headers["x-delete-failed"]).toBe("1");
            expect(exposed(response)).toStrictEqual(expect.arrayContaining(["X-Delete-Failed"]));
            expect(response.body).toStrictEqual([expect.objectContaining({ id, status: "deleted" })]);
        });
    });

    describe("express middleware", () => {
        it("should hand GET and completed uploads to next() with the body on the request", async () => {
            expect.assertions(4);

            await setup();

            const app = express();
            const seen: unknown[] = [];

            app.use("/files", (request: IncomingMessage, response: ServerResponse, next: () => void) => {
                rest.upload(request, response, next).catch(() => undefined);
            });
            app.use((request: IncomingMessage & { body?: unknown }, response: express.Response) => {
                seen.push(request.body);
                response.json({ handled: true });
            });

            const created = await supertest(app).post("/files").set("Content-Type", "application/octet-stream").send(BODY);

            expect(created.body).toStrictEqual({ handled: true });
            expect(seen[0]).toStrictEqual(expect.objectContaining({ status: "completed" }));

            const { id } = seen[0] as { id: string };

            await supertest(app).get(`/files/${id}`);

            expect(seen[1]).toStrictEqual(expect.objectContaining({ id }));

            // A streamed (ranged) GET is handed on as well
            await supertest(app).get(`/files/${id}`).set("Range", "bytes=0-9");

            expect(seen).toHaveLength(3);
        });
    });
});
