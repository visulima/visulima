import { rm } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import Tus from "../../../src/handler/tus";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { metadata, storageOptions, testRoot } from "../../__helpers__/config";

vi.mock(import("node:fs/promises"), () => {
    const { fs } = require("memfs");

    return fs.promises;
});

vi.mock(import("node:fs"), () => {
    const { fs } = require("memfs");

    return fs;
});

const exposedHeaders = (response: Response): string[] =>
    response.headers
        .get("Access-Control-Expose-Headers")
        ?.split(",")
        .map((s) => s.toLowerCase()) || [];

describe("fetch Tus", () => {
    const basePath = "http://localhost/tus/";
    const directory = `${testRoot}/fetch-tus`;
    const options = { ...storageOptions, directory };
    const tus = new Tus({ storage: new DiskStorage(options) });

    function create(): Request {
        return new Request(`${basePath}`, {
            headers: {
                "Tus-Resumable": "1.0.0",
                "Upload-Length": metadata.size.toString(),
                "Upload-Metadata": `name ${Buffer.from(metadata.name).toString("base64")},size ${Buffer.from(metadata.size.toString()).toString("base64")},mimeType ${Buffer.from(metadata.mimeType).toString("base64")}`,
            },
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
        it("should create Tus handler instance", () => {
            expect.assertions(1);

            expect(new Tus({ storage: new DiskStorage({ directory: "/files" }) })).toBeInstanceOf(Tus);
        });
    });

    describe("post", () => {
        it("should create upload resource and return 201 with location header", async () => {
            expect.assertions(3);

            const request = create();
            const { default: Tus } = await import("../../../src/handler/tus");

            const storage = new DiskStorage(options);
            const tusHandler = new Tus({ storage });

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

            const response = await tusHandler.fetch(request);

            expect(response.status).toBe(201);
            expect(response.headers.get("location")).toBeDefined();
            expect(exposedHeaders(response)).toStrictEqual(expect.arrayContaining(["location", "upload-expires"]));
        });

        it("should handle invalid upload length with error response", async () => {
            expect.assertions(2);

            const request = new Request(`${basePath}`, {
                headers: {
                    "Tus-Resumable": "1.0.0",
                    "Upload-Length": "invalid",
                },
                method: "POST",
            });

            const { default: Tus } = await import("../../../src/handler/tus");

            const storage = new DiskStorage(options);
            const tusHandler = new Tus({ storage });

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

            const response = await tusHandler.fetch(request);

            expect(response.status).toBe(400);

            const body = await response.json();

            expect(body.error).toBeDefined();
        });
    });

    describe("options", () => {
        it("should return 204 with Tus protocol headers for OPTIONS request", async () => {
            expect.assertions(5);

            const request = new Request(`${basePath}`, {
                headers: {
                    "Tus-Resumable": "1.0.0",
                },
                method: "OPTIONS",
            });

            const { default: Tus } = await import("../../../src/handler/tus");

            const storage = new DiskStorage(options);
            const tusHandler = new Tus({ storage });

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

            const response = await tusHandler.fetch(request);

            expect(response.status).toBe(204);
            expect(response.headers.get("tus-version")).toBe("1.0.0");
            expect(response.headers.get("tus-extension")).toBe("creation,creation-with-upload,termination,checksum,creation-defer-length,expiration");
            expect(response.headers.get("tus-max-size")).toBe("6442450944");
            expect(response.headers.get("tus-checksum-algorithm")).toBe("md5,sha1");
        });
    });
});
