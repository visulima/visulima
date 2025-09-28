import { rm } from "node:fs/promises";
import {
    describe, expect, it,
} from "vitest";

import Multipart from "../../../src/handler/multipart";
import DiskStorage from "../../../src/storage/local/disk-storage";
import {
    metadata, storageOptions, testfile, testRoot,
} from "../../__helpers__/config";

jest.mock("fs/promises", () => {
    // eslint-disable-next-line unicorn/prefer-module
    const process = require("node:process");
    process.chdir("/");

    // eslint-disable-next-line unicorn/prefer-module
    const { fs } = require("memfs");

    return fs.promises;
});

jest.mock("fs", () => {
    // eslint-disable-next-line unicorn/prefer-module
    const process = require("node:process");
    process.chdir("/");

    // eslint-disable-next-line unicorn/prefer-module
    const { fs } = require("memfs");

    return fs;
});

describe("Fetch Multipart", () => {
    const basePath = "/multipart";
    const directory = `${testRoot}/fetch-multipart`;
    const options = { ...storageOptions, directory };
    const multipart = new Multipart({ storage: new DiskStorage(options) });

    function create(): Request {
        const formData = new FormData();
        formData.append("file", new Blob([testfile.asBuffer]), testfile.name);
        formData.append("custom", "customField");

        return new Request(`${basePath}`, {
            method: "POST",
            body: formData,
        });
    }

    beforeAll(async () => {
        try {
            await rm(directory, { recursive: true, force: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    afterAll(async () => {
        try {
            await rm(directory, { recursive: true, force: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    describe("default options", () => {
        it("should be defined", () => {
            expect(new Multipart({ storage: new DiskStorage({ directory: "/files" }) })).toBeInstanceOf(Multipart);
        });
    });

    describe("POST", () => {
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
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ invalid: "data" }),
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

    describe("OPTIONS", () => {
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
