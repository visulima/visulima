import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Tus } from "../../../src/handler/tus";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { metadata, storageOptions } from "../../__helpers__/config";

const exposedHeaders = (response: Response): string[] =>
    response.headers
        .get("Access-Control-Expose-Headers")
        ?.split(",")
        .map((s) => s.toLowerCase()) || [];

describe("fetch Tus", () => {
    const basePath = "http://localhost/tus/";
    let directory: string;

    const create = (): Request =>
        new Request(`${basePath}`, {
            headers: {
                "Tus-Resumable": "1.0.0",
                "Upload-Length": metadata.size.toString(),
                "Upload-Metadata": `name ${Buffer.from(metadata.name).toString("base64")},size ${Buffer.from(metadata.size.toString()).toString("base64")},mimeType ${Buffer.from(metadata.mimeType).toString("base64")}`,
            },
            method: "POST",
        });

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
        it("should create Tus handler instance", () => {
            expect.assertions(1);

            expect(new Tus({ storage: new DiskStorage({ directory: "/files" }) })).toBeInstanceOf(Tus);
        });
    });

    describe("post", () => {
        it("should create upload resource and return 201 with location header", async () => {
            expect.assertions(3);

            const request = create();

            const storage = new DiskStorage({ ...storageOptions, directory });
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

            const storage = new DiskStorage({ ...storageOptions, directory });
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

            const storage = new DiskStorage({ ...storageOptions, directory });
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

    describe("tus-Resumable header validation", () => {
        it("should return 412 for POST request without Tus-Resumable header", async () => {
            expect.assertions(2);

            const request = new Request(`${basePath}`, {
                headers: {
                    "Upload-Length": metadata.size.toString(),
                    "Upload-Metadata": `name ${Buffer.from(metadata.name).toString("base64")},size ${Buffer.from(metadata.size.toString()).toString("base64")},mimeType ${Buffer.from(metadata.mimeType).toString("base64")}`,
                },
                method: "POST",
            });

            const storage = new DiskStorage({ ...storageOptions, directory });
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

            expect(response.status).toBe(412);

            const text = await response.text();
            const body = JSON.parse(text);

            expect(body.error).toBeDefined();
        });

        it("should return 412 for POST request with invalid Tus-Resumable version", async () => {
            expect.assertions(2);

            const request = new Request(`${basePath}`, {
                headers: {
                    "Tus-Resumable": "0.2.2",
                    "Upload-Length": metadata.size.toString(),
                    "Upload-Metadata": `name ${Buffer.from(metadata.name).toString("base64")},size ${Buffer.from(metadata.size.toString()).toString("base64")},mimeType ${Buffer.from(metadata.mimeType).toString("base64")}`,
                },
                method: "POST",
            });

            const storage = new DiskStorage({ ...storageOptions, directory });
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

            expect(response.status).toBe(412);

            const text = await response.text();
            const body = JSON.parse(text);

            expect(body.error).toBeDefined();
        });

        it("should accept OPTIONS request without Tus-Resumable header", async () => {
            expect.assertions(1);

            const request = new Request(`${basePath}`, {
                method: "OPTIONS",
            });

            const storage = new DiskStorage({ ...storageOptions, directory });
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
        });
    });
});
