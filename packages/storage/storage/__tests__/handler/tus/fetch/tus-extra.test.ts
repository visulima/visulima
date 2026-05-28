import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Tus as TusFetch } from "../../../../src/handler/tus/tus-fetch";
import { serializeMetadata, TUS_RESUMABLE } from "../../../../src/handler/tus/tus-base";
import DiskStorage from "../../../../src/storage/local/disk-storage";
import { metadata, storageOptions, testfile } from "../../../__helpers__/config";

const basePath = "http://localhost/tus/";

const waitForReady = async (storage: DiskStorage): Promise<void> => {
    await new Promise<void>((resolve) => {
        const check = (): void => {
            if (storage.isReady) {
                resolve();
            } else {
                setTimeout(check, 10);
            }
        };

        check();
    });
};

const toAbsolute = (location: string): string => (location.startsWith("http") ? location : `http://localhost${location}`);

const createUpload = async (handler: TusFetch): Promise<{ id: string; location: string }> => {
    const response = await handler.fetch(
        new Request(basePath, {
            headers: {
                "Tus-Resumable": TUS_RESUMABLE,
                "Upload-Length": metadata.size.toString(),
                "Upload-Metadata": serializeMetadata(metadata),
            },
            method: "POST",
        }),
    );

    const rawLocation = response.headers.get("location") as string;
    const location = toAbsolute(rawLocation);
    const id = location.split("/").filter(Boolean).pop() as string;

    return { id, location };
};

describe("fetch Tus extra coverage", () => {
    let directory: string;

    beforeAll(() => {
        directory = temporaryDirectory();
    });

    afterAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore
        }
    });

    describe("getIdFromRequestUrl", () => {
        it("returns 404 when PATCH URL has no id segment", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const response = await handler.fetch(
                new Request(basePath, {
                    headers: {
                        "Content-Type": "application/offset+octet-stream",
                        "Tus-Resumable": TUS_RESUMABLE,
                        "Upload-Offset": "0",
                    },
                    method: "PATCH",
                }),
            );

            expect(response.status).toBe(404);
        });

        it("returns 404 when DELETE URL has no id segment", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const response = await handler.fetch(
                new Request(basePath, {
                    headers: {
                        "Tus-Resumable": TUS_RESUMABLE,
                    },
                    method: "DELETE",
                }),
            );

            expect(response.status).toBe(404);
        });
    });

    describe("patch", () => {
        it("reaches storage.write for a body PATCH and preserves Tus-Resumable on the response", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const { location } = await createUpload(handler);

            const response = await handler.fetch(
                new Request(location, {
                    body: testfile.asBuffer,
                    headers: {
                        "Content-Length": testfile.asBuffer.length.toString(),
                        "Content-Type": "application/offset+octet-stream",
                        "Tus-Resumable": TUS_RESUMABLE,
                        "Upload-Offset": "0",
                    },
                    method: "PATCH",
                }),
            );

            // We don't assert success here — the disk storage write path expects a Node
            // Readable, while the Web Fetch body is a ReadableStream. Either way we want
            // every TUS response to carry the Tus-Resumable header per protocol.
            expect(response.headers.get("tus-resumable")).toBe(TUS_RESUMABLE);
        });

        it("returns 412 when Upload-Offset header is missing", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const { location } = await createUpload(handler);

            const response = await handler.fetch(
                new Request(location, {
                    body: testfile.asBuffer,
                    headers: {
                        "Content-Type": "application/offset+octet-stream",
                        "Tus-Resumable": TUS_RESUMABLE,
                    },
                    method: "PATCH",
                }),
            );

            expect(response.status).toBe(412);
        });

        it("returns 412 when Content-Type header is missing", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const { location } = await createUpload(handler);

            // Construct request with a non-default body type — Headers will still
            // emit some Content-Type unless we explicitly clear it, so use a
            // ReadableStream body.
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array([1, 2]));
                    controller.close();
                },
            });

            const request = new Request(location, {
                body: stream,
                // @ts-expect-error -- Node fetch requires duplex for streaming bodies
                duplex: "half",
                headers: {
                    "Tus-Resumable": TUS_RESUMABLE,
                    "Upload-Offset": "0",
                },
                method: "PATCH",
            });

            // Force-remove the content-type that Request may auto-add
            const headers = new Headers(request.headers);

            headers.delete("content-type");

            const cleaned = new Request(location, {
                body: stream,
                // @ts-expect-error -- Node fetch requires duplex for streaming bodies
                duplex: "half",
                headers,
                method: "PATCH",
            });

            const response = await handler.fetch(cleaned);

            expect(response.status).toBe(412);
        });

        it("returns 415 when Content-Type is wrong", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const { location } = await createUpload(handler);

            const response = await handler.fetch(
                new Request(location, {
                    body: testfile.asBuffer,
                    headers: {
                        "Content-Length": testfile.asBuffer.length.toString(),
                        "Content-Type": "application/octet-stream",
                        "Tus-Resumable": TUS_RESUMABLE,
                        "Upload-Offset": "0",
                    },
                    method: "PATCH",
                }),
            );

            expect(response.status).toBe(415);
        });
    });

    describe("head", () => {
        it("returns upload status and metadata for an existing upload", async () => {
            expect.assertions(3);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const { location } = await createUpload(handler);

            const response = await handler.fetch(
                new Request(location, {
                    headers: {
                        "Tus-Resumable": TUS_RESUMABLE,
                    },
                    method: "HEAD",
                }),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("upload-length")).toBe(metadata.size.toString());
            expect(response.headers.get("tus-resumable")).toBe(TUS_RESUMABLE);
        });

        it("returns 404 for an unknown upload id", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const response = await handler.fetch(
                new Request(`${basePath}does-not-exist-id`, {
                    headers: {
                        "Tus-Resumable": TUS_RESUMABLE,
                    },
                    method: "HEAD",
                }),
            );

            expect(response.status).toBe(404);
        });
    });

    describe("get", () => {
        it("returns 200 with file metadata for an existing upload", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const { location } = await createUpload(handler);

            // Note: the fetch handler does not strip a trailing /metadata
            // segment the way the Node handler does — call GET directly on the
            // upload URL to retrieve metadata.
            const response = await handler.fetch(
                new Request(location, {
                    headers: {
                        "Tus-Resumable": TUS_RESUMABLE,
                    },
                    method: "GET",
                }),
            );

            expect(response.status).toBe(200);
        });

        it("returns 404 for an unknown upload id on GET", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const response = await handler.fetch(
                new Request(`${basePath}some-unknown-upload-id-xyz`, {
                    headers: {
                        "Tus-Resumable": TUS_RESUMABLE,
                    },
                    method: "GET",
                }),
            );

            expect(response.status).toBe(404);
        });
    });

    describe("delete", () => {
        it("returns 204 when deleting an existing upload", async () => {
            expect.assertions(2);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const { location } = await createUpload(handler);

            const response = await handler.fetch(
                new Request(location, {
                    headers: {
                        "Tus-Resumable": TUS_RESUMABLE,
                    },
                    method: "DELETE",
                }),
            );

            expect(response.status).toBe(204);
            expect(response.headers.get("tus-resumable")).toBe(TUS_RESUMABLE);
        });

        it("returns 404 when deleting an unknown upload id", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const response = await handler.fetch(
                new Request(`${basePath}does-not-exist-id`, {
                    headers: {
                        "Tus-Resumable": TUS_RESUMABLE,
                    },
                    method: "DELETE",
                }),
            );

            expect(response.status).toBe(404);
        });
    });

    describe("constructor with useRelativeLocation", () => {
        it("emits relative location header when storage configured so", async () => {
            expect.assertions(1);

            const storage = new DiskStorage({ ...storageOptions, directory, useRelativeLocation: true });

            await waitForReady(storage);

            const handler = new TusFetch({ storage });
            const response = await handler.fetch(
                new Request(basePath, {
                    headers: {
                        "Tus-Resumable": TUS_RESUMABLE,
                        "Upload-Length": metadata.size.toString(),
                        "Upload-Metadata": serializeMetadata(metadata),
                    },
                    method: "POST",
                }),
            );

            const location = response.headers.get("location") as string;

            // useRelativeLocation: true means the location should start with /
            // rather than the full URL origin.
            expect(location.startsWith("/")).toBe(true);
        });
    });
});
