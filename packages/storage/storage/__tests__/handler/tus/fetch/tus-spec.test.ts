import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { Tus as TusFetch } from "../../../../src/handler/tus/tus-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";

const BASE = "http://localhost/files";
const TUS = { "Tus-Resumable": "1.0.0" };

const b64 = (value: string): string => Buffer.from(value).toString("base64");

const statusOf = async (response: Promise<Response>): Promise<number> => response.then((resolved) => resolved.status);

const headerOf = async (response: Promise<Response>, name: string): Promise<string | null> => response.then((resolved) => resolved.headers.get(name));

const setup = (options: { allowMethodOverride?: boolean; maxChecksumBufferSize?: number; maxUploadSize?: number; onComplete?: () => void } = {}) => {
    const storage = new MemoryStorage({
        maxUploadSize: options.maxUploadSize ?? 1024 * 1024,
        ...(options.onComplete ? { onComplete: options.onComplete } : {}),
    });
    const tus = new TusFetch({ allowMethodOverride: options.allowMethodOverride, maxChecksumBufferSize: options.maxChecksumBufferSize, storage });

    const send = async (method: string, url: string, headers: Record<string, string> = {}, body?: Uint8Array | string): Promise<Response> =>
        tus.fetch(
            new Request(url, {
                body,
                // Real clients send Content-Length; a constructed Request doesn't add it on its own.
                headers: {
                    ...TUS,
                    ...(body === undefined
                        ? {}
                        : { "Content-Length": String(typeof body === "string" ? new TextEncoder().encode(body).byteLength : body.byteLength) }),
                    ...headers,
                },
                method,
            }),
        );

    const create = async (length: number, headers: Record<string, string> = {}): Promise<string> => {
        const response = await send("POST", BASE, { "Upload-Length": String(length), "Upload-Metadata": `name ${b64("spec.bin")}`, ...headers });

        expect(response.status).toBe(201);

        return new URL(response.headers.get("location") as string, BASE).toString();
    };

    const patch = async (url: string, offset: number | string, body: string, headers: Record<string, string> = {}): Promise<Response> =>
        send("PATCH", url, { "Content-Type": "application/offset+octet-stream", "Upload-Offset": String(offset), ...headers }, body);

    const offsetOf = async (url: string): Promise<string | null> => headerOf(send("HEAD", url), "upload-offset");

    return { create, offsetOf, patch, send, storage, tus };
};

describe("tus 1.0 spec compliance (fetch handler)", () => {
    describe("core", () => {
        it("should answer every successful PATCH with 204 and no body, including the completing one", async () => {
            expect.assertions(5);

            const { create, patch } = setup();
            const url = await create(10);

            const first = await patch(url, 0, "hello");
            const last = await patch(url, 5, "world");

            expect(first.status).toBe(204);
            expect(last.status).toBe(204);
            expect(last.headers.get("upload-offset")).toBe("10");
            await expect(last.text()).resolves.toBe("");
        });

        it("should answer 409 without modifying the upload when Upload-Offset does not match", async () => {
            expect.assertions(4);

            const { create, offsetOf, patch } = setup();
            const url = await create(10);

            await patch(url, 0, "hello");

            const stale = await patch(url, 0, "HELLO");
            const ahead = await patch(url, 8, "xx");

            expect(stale.status).toBe(409);
            expect(ahead.status).toBe(409);
            await expect(offsetOf(url)).resolves.toBe("5");
        });

        it("should reject a malformed Upload-Offset with 400", async () => {
            expect.assertions(3);

            const { create, patch } = setup();
            const url = await create(10);

            await expect(statusOf(patch(url, "12abc", "hello"))).resolves.toBe(400);
            await expect(statusOf(patch(url, "-1", "hello"))).resolves.toBe(400);
        });

        it("should answer 404 for a PATCH to an unknown upload", async () => {
            expect.assertions(1);

            const { patch } = setup();

            await expect(statusOf(patch(`${BASE}/doesnotexist1234`, 0, "hello"))).resolves.toBe(404);
        });

        it("should send Cache-Control: no-store on HEAD", async () => {
            expect.assertions(2);

            const { create, send } = setup();
            const url = await create(10);

            await expect(headerOf(send("HEAD", url), "cache-control")).resolves.toContain("no-store");
        });
    });

    describe("creation", () => {
        it("should reject malformed Upload-Metadata with 400", async () => {
            expect.assertions(4);

            const { send } = setup();
            const post = async (metadata: string): Promise<number> => statusOf(send("POST", BASE, { "Upload-Length": "1", "Upload-Metadata": metadata }));

            await expect(post(`name ${b64("a")},name ${b64("b")}`)).resolves.toBe(400);
            await expect(post("name not*base64")).resolves.toBe(400);
            await expect(post(`uploadConcat ${b64("partial")}`)).resolves.toBe(400);
            await expect(post(`empty,name ${b64("a")}`)).resolves.toBe(201);
        });

        it("should reject an invalid Upload-Length with 400", async () => {
            expect.assertions(2);

            const { send } = setup();

            await expect(statusOf(send("POST", BASE, { "Upload-Length": "-1" }))).resolves.toBe(400);
            await expect(statusOf(send("POST", BASE, { "Upload-Length": "1.5" }))).resolves.toBe(400);
        });

        it("should answer creation-with-upload with 201 and Upload-Offset", async () => {
            expect.assertions(2);

            const { send } = setup();
            const response = await send(
                "POST",
                BASE,
                { "Content-Type": "application/offset+octet-stream", "Upload-Length": "10", "Upload-Metadata": `name ${b64("cwu.bin")}` },
                "hello",
            );

            expect(response.status).toBe(201);
            expect(response.headers.get("upload-offset")).toBe("5");
        });
    });

    describe("creation-defer-length", () => {
        it("should accept the length on a later PATCH and complete the upload", async () => {
            expect.assertions(3);

            const { offsetOf, patch, send } = setup();
            const deferred = await send("POST", BASE, { "Upload-Defer-Length": "1", "Upload-Metadata": `name ${b64("deferred.bin")}` });
            const url = new URL(deferred.headers.get("location") as string, BASE).toString();

            await expect(headerOf(send("HEAD", url), "upload-defer-length")).resolves.toBe("1");
            await expect(statusOf(patch(url, 0, "hello", { "Upload-Length": "5" }))).resolves.toBe(204);
            await expect(offsetOf(url)).resolves.toBe("5");
        });

        it("should reject a deferred Upload-Length that is too small or too large without writing", async () => {
            expect.assertions(3);

            const { offsetOf, patch, send } = setup({ maxUploadSize: 100 });
            const deferred = await send("POST", BASE, { "Upload-Defer-Length": "1", "Upload-Metadata": `name ${b64("deferred2.bin")}` });
            const url = new URL(deferred.headers.get("location") as string, BASE).toString();

            await expect(statusOf(patch(url, 0, "hello", { "Upload-Length": "3" }))).resolves.toBe(400);
            await expect(statusOf(patch(url, 0, "hello", { "Upload-Length": "1000" }))).resolves.toBe(413);
            await expect(offsetOf(url)).resolves.toBe("0");
        });
    });

    describe("checksum", () => {
        it("should advertise sha1 and verify it even when the storage can't", async () => {
            expect.assertions(1);

            const { send } = setup();
            const response = await send("OPTIONS", BASE);

            expect(response.headers.get("tus-checksum-algorithm")?.split(",")).toContain("sha1");
        });

        it("should accept a matching checksum and answer 460 without writing on a mismatch", async () => {
            expect.assertions(4);

            const { create, offsetOf, patch } = setup();
            const url = await create(10);
            // eslint-disable-next-line sonarjs/hashing -- SHA-1 is the checksum algorithm the tus spec mandates
            const sha1 = (value: string): string => createHash("sha1").update(value).digest("base64");

            await expect(statusOf(patch(url, 0, "hello", { "Upload-Checksum": `sha1 ${sha1("HELLO")}` }))).resolves.toBe(460);
            await expect(offsetOf(url)).resolves.toBe("0");
            await expect(statusOf(patch(url, 0, "hello", { "Upload-Checksum": `sha1 ${sha1("hello")}` }))).resolves.toBe(204);
        });

        it("should answer 400 for an unsupported checksum algorithm", async () => {
            expect.assertions(2);

            const { create, patch } = setup();
            const url = await create(10);

            await expect(statusOf(patch(url, 0, "hello", { "Upload-Checksum": "whirlpool abc=" }))).resolves.toBe(400);
        });
    });

    describe("concatenation", () => {
        it("should concatenate partial uploads referenced by absolute and relative URL", async () => {
            expect.assertions(7);

            const onComplete = vi.fn();
            const { patch, send } = setup({ onComplete });

            const createPartial = async (data: string): Promise<string> => {
                const response = await send("POST", BASE, { "Upload-Concat": "partial", "Upload-Length": String(data.length) });
                const url = new URL(response.headers.get("location") as string, BASE).toString();

                await expect(statusOf(patch(url, 0, data))).resolves.toBe(204);

                return url;
            };

            const first = await createPartial("hello ");
            const second = await createPartial("world");

            // Finishing a partial upload must not be processed as a completed upload.
            expect(onComplete).not.toHaveBeenCalled();

            const final = await send("POST", BASE, { "Upload-Concat": `final;${first} ${new URL(second).pathname}` });

            expect(final.status).toBe(201);

            const head = await send("HEAD", new URL(final.headers.get("location") as string, BASE).toString());

            expect(head.headers.get("upload-length")).toBe("11");
            expect(head.headers.get("upload-concat")).toMatch(/^final;/);
            // Internal bookkeeping keys are not echoed as client metadata.
            expect(head.headers.get("upload-metadata") ?? "").not.toMatch(/partialIds|uploadConcat/);
        });
    });

    describe("x-http-method-override", () => {
        it("should treat the override as the request method", async () => {
            expect.assertions(3);

            const { create, offsetOf, send } = setup();
            const url = await create(5);

            const response = await send(
                "POST",
                url,
                { "Content-Type": "application/offset+octet-stream", "Upload-Offset": "0", "X-HTTP-Method-Override": "PATCH" },
                "hello",
            );

            expect(response.status).toBe(204);
            await expect(offsetOf(url)).resolves.toBe("5");
        });

        it("should reject an unsupported override with 400 and Tus-Resumable", async () => {
            expect.assertions(2);

            const { send } = setup();
            const response = await send("POST", BASE, { "X-HTTP-Method-Override": "TRACE" });

            expect(response.status).toBe(400);
            expect(response.headers.get("tus-resumable")).toBe("1.0.0");
        });
    });

    describe("hardening", () => {
        it("should verify crc32 and crc32c checksums", async () => {
            expect.assertions(4);

            const { create, patch } = setup();
            // Standard check values for "123456789": CRC-32 0xCBF43926, CRC-32C 0xE3069283.
            const crc = (value: number): string => {
                const bytes = Buffer.alloc(4);

                bytes.writeUInt32BE(value);

                return bytes.toString("base64");
            };
            const url32 = await create(9);
            const url32c = await create(9, { "Upload-Metadata": `name ${b64("crc32c.bin")}` });

            await expect(statusOf(patch(url32, 0, "123456789", { "Upload-Checksum": `crc32 ${crc(0xcb_f4_39_26)}` }))).resolves.toBe(204);
            await expect(statusOf(patch(url32c, 0, "123456789", { "Upload-Checksum": `crc32c ${crc(0xe3_06_92_83)}` }))).resolves.toBe(204);
        });

        it("should refuse to buffer a checksummed chunk without Content-Length or over the limit", async () => {
            expect.assertions(4);

            const { create, offsetOf, send, tus } = setup({ maxChecksumBufferSize: 4 });
            const url = await create(10);
            // eslint-disable-next-line sonarjs/hashing -- SHA-1 is the checksum algorithm the tus spec mandates
            const sha1 = createHash("sha1").update("hello").digest("base64");
            const headers = { "Content-Type": "application/offset+octet-stream", "Upload-Checksum": `sha1 ${sha1}`, "Upload-Offset": "0" };

            await expect(statusOf(send("PATCH", url, { ...headers, "Content-Length": "5" }, "hello"))).resolves.toBe(413);
            // A constructed Request carries no Content-Length.
            await expect(statusOf(tus.fetch(new Request(url, { body: "hello", headers: { ...TUS, ...headers }, method: "PATCH" })))).resolves.toBe(411);
            await expect(offsetOf(url)).resolves.toBe("0");
        });

        it("should answer 423 to a PATCH racing another one on the same upload", async () => {
            expect.assertions(3);

            const { create, patch, storage } = setup();
            const url = await create(10);
            const { write } = storage;
            let release: () => void = () => undefined;

            vi.spyOn(storage, "write").mockImplementationOnce(async (part) => {
                await new Promise<void>((resolve) => {
                    release = resolve;
                });

                return write.call(storage, part);
            });

            const first = patch(url, 0, "hello");

            await vi.waitFor(() => {
                if (vi.mocked(storage.write).mock.calls.length === 0) {
                    throw new Error("first PATCH has not reached the storage yet");
                }
            });

            await expect(statusOf(patch(url, 0, "hello"))).resolves.toBe(423);

            release();

            await expect(statusOf(first)).resolves.toBe(204);
        });

        it("should leave a deferred length and metadata untouched when the write fails", async () => {
            expect.assertions(3);

            const { patch, send, storage } = setup();
            const deferred = await send("POST", BASE, { "Upload-Defer-Length": "1", "Upload-Metadata": `name ${b64("rollback.bin")}` });
            const url = new URL(deferred.headers.get("location") as string, BASE).toString();

            vi.spyOn(storage, "write").mockRejectedValueOnce(new Error("backend down"));

            await expect(statusOf(patch(url, 0, "hello", { "Upload-Length": "5", "Upload-Metadata": `name ${b64("changed.bin")}` }))).resolves.toBe(500);

            const head = await send("HEAD", url);

            expect(head.headers.get("upload-defer-length")).toBe("1");
            expect(head.headers.get("upload-metadata")).toBe(`name ${b64("rollback.bin")}`);
        });

        it("should accept a retried PATCH that repeats the Upload-Length already set", async () => {
            expect.assertions(2);

            const { patch, send } = setup();
            const deferred = await send("POST", BASE, { "Upload-Defer-Length": "1", "Upload-Metadata": `name ${b64("repeat.bin")}` });
            const url = new URL(deferred.headers.get("location") as string, BASE).toString();

            await expect(statusOf(patch(url, 0, "hello", { "Upload-Length": "10" }))).resolves.toBe(204);
            await expect(statusOf(patch(url, 5, "world", { "Upload-Length": "10" }))).resolves.toBe(204);
        });

        it("should ignore X-HTTP-Method-Override when disabled", async () => {
            expect.assertions(2);

            const { send } = setup({ allowMethodOverride: false });
            const response = await send("POST", BASE, { "Upload-Length": "5", "X-HTTP-Method-Override": "DELETE" });

            expect(response.status).toBe(201);
            expect(response.headers.has("location")).toBe(true);
        });

        it("should refuse a partial chunk before reading it when the storage can't append", async () => {
            expect.assertions(4);

            const { create, offsetOf, patch, storage } = setup();
            const url = await create(10);

            Object.defineProperty(storage, "supportsResumableWrites", { value: false });

            const write = vi.spyOn(storage, "write");

            await expect(statusOf(patch(url, 0, "hello"))).resolves.toBe(405);
            await expect(offsetOf(url)).resolves.toBe("0");
            expect(write).not.toHaveBeenCalled();
        });
    });
});
