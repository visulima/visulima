import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Multipart from "../../../src/handler/multipart";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { storageOptions, testfile } from "../../__helpers__/config";
import { waitForStorageReady } from "../../__helpers__/utils";

describe("fetch Multipart", () => {
    const basePath = "http://localhost/multipart/";
    let directory: string;

    function create(): Request {
        const formData = new FormData();

        formData.append("file", new Blob([testfile.asBuffer], { type: testfile.contentType }), testfile.name);
        formData.append("custom", "customField");

        return new Request(`${basePath}`, {
            body: formData,
            method: "POST",
        });
    }

    beforeAll(async () => {
        directory = temporaryDirectory();
    });

    afterAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    describe("default options", () => {
        it("should create Multipart handler instance", () => {
            expect.assertions(1);

            expect(new Multipart({ storage: new DiskStorage({ directory: "/files" }) })).toBeInstanceOf(Multipart);
        });
    });

    describe("post", () => {
        it("should support custom fields in multipart upload", async () => {
            expect.assertions(2);

            const request = create();

            const storage = new DiskStorage({ ...storageOptions, allowMIME: ["video/mp4", "image/*"], directory });
            const multipartHandler = new Multipart({ storage });

            await waitForStorageReady(storage);

            const response = await multipartHandler.fetch(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("location")).toBeDefined();
        });

        it("should handle invalid request data with error response", async () => {
            expect.assertions(2);

            const request = new Request(`${basePath}`, {
                body: JSON.stringify({ invalid: "data" }),
                headers: {
                    "content-type": "application/json",
                },
                method: "POST",
            });

            const storage = new DiskStorage({ ...storageOptions, directory });
            const multipartHandler = new Multipart({ storage });

            await waitForStorageReady(storage);

            const response = await multipartHandler.fetch(request);

            expect(response.status).toBe(400);

            const body = await response.json();

            expect(body.error).toBeDefined();
        });
    });

    describe("options", () => {
        it("should return 204 with proper CORS headers for OPTIONS request", async () => {
            expect.assertions(2);

            const request = new Request(`${basePath}`, {
                method: "OPTIONS",
            });

            const storage = new DiskStorage({ ...storageOptions, directory });
            const multipartHandler = new Multipart({ storage });

            await waitForStorageReady(storage);

            const response = await multipartHandler.fetch(request);

            expect(response.status).toBe(204);
            expect(response.headers.get("access-control-allow-methods")).toBe("DELETE, DOWNLOAD, GET, OPTIONS, POST");
        });
    });
});
