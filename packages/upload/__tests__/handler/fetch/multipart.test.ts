import { rm } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import Multipart from "../../../src/handler/multipart";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { storageOptions, testfile, testRoot } from "../../__helpers__/config";

vi.mock(import("node:fs/promises"), () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return fs.promises;
});

vi.mock(import("node:fs"), () => {
    const process = require("node:process");

    process.chdir("/");

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
        it("should be defined", () => {
            expect(new Multipart({ storage: new DiskStorage({ directory: "/files" }) })).toBeInstanceOf(Multipart);
        });
    });

    describe("pOST", () => {
        it("should support custom fields", async () => {
            const request = create();

            const handler = await import("../../../src/fetch/multipart");
            const fetchMultipartHandler = handler.default;

            const multipartHandler = fetchMultipartHandler({ storage: new DiskStorage(options) });
            const response = await multipartHandler(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("location")).toBeDefined();
        });

        it("should handle errors", async () => {
            const request = new Request(`${basePath}`, {
                body: JSON.stringify({ invalid: "data" }),
                headers: {
                    "content-type": "application/json",
                },
                method: "POST",
            });

            const handler = await import("../../../src/fetch/multipart");
            const fetchMultipartHandler = handler.default;

            const multipartHandler = fetchMultipartHandler({ storage: new DiskStorage(options) });
            const response = await multipartHandler(request);

            expect(response.status).toBe(400);

            const body = await response.json();

            expect(body.error).toBeDefined();
        });
    });

    describe("oPTIONS", () => {
        it("should 204", async () => {
            const request = new Request(`${basePath}`, {
                method: "OPTIONS",
            });

            const handler = await import("../../../src/fetch/multipart");
            const fetchMultipartHandler = handler.default;

            const multipartHandler = fetchMultipartHandler({ storage: new DiskStorage(options) });
            const response = await multipartHandler(request);

            expect(response.status).toBe(204);
            expect(response.headers.get("access-control-allow-methods")).toBe("DELETE, GET, OPTIONS, POST");
        });
    });
});
