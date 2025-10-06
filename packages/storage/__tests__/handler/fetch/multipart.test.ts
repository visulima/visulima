import { rm } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import Multipart from "../../../src/handler/multipart";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { storageOptions, testfile, testRoot } from "../../__helpers__/config";

vi.mock(import("node:fs/promises"), () => {
    const { fs } = require("memfs");

    return fs.promises;
});

vi.mock(import("node:fs"), () => {
    const { fs } = require("memfs");

    return fs;
});

describe("fetch Multipart", () => {
    const basePath = "http://localhost/multipart/";
    const directory = `${testRoot}/fetch-multipart`;
    const options = { ...storageOptions, directory };

    function create(): Request {
        const formData = new FormData();

        formData.append("file", new Blob([testfile.asBuffer]), testfile.name);
        formData.append("custom", "customField");

        return new Request(`${basePath}`, {
            body: formData,
            method: "POST",
        });
    }

    beforeAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
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

            const storage = new DiskStorage(options);
            const multipartHandler = new Multipart({ storage });

            // Wait for storage to be ready
            await new Promise((resolve) => {
                const checkReady = () => {
                    if (storage.isReady) {
                        resolve(undefined);
                    } else {
                        setTimeout(checkReady, 10);
                    }
                };

                checkReady();
            });

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

            const storage = new DiskStorage(options);
            const multipartHandler = new Multipart({ storage });

            // Wait for storage to be ready
            await new Promise((resolve) => {
                const checkReady = () => {
                    if (storage.isReady) {
                        resolve(undefined);
                    } else {
                        setTimeout(checkReady, 10);
                    }
                };

                checkReady();
            });

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

            const storage = new DiskStorage(options);
            const multipartHandler = new Multipart({ storage });

            // Wait for storage to be ready
            await new Promise((resolve) => {
                const checkReady = () => {
                    if (storage.isReady) {
                        resolve(undefined);
                    } else {
                        setTimeout(checkReady, 10);
                    }
                };

                checkReady();
            });

            const response = await multipartHandler.fetch(request);

            expect(response.status).toBe(204);
            expect(response.headers.get("access-control-allow-methods")).toBe("DELETE, GET, OPTIONS, POST");
        });
    });
});
