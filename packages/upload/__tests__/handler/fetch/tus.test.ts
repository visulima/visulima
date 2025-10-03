import { rm } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import Tus from "../../../src/handler/tus";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { metadata, storageOptions, testRoot } from "../../__helpers__/config";

vi.mock("node:fs/promises", () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return fs.promises;
});

vi.mock("node:fs", () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return fs;
});

const exposedHeaders = (response: Response): string[] =>
    response.headers
        .get("Access-Control-Expose-Headers")
        ?.split(",")
        .map((s) => s.toLowerCase()) || [];

describe("fetch Tus", () => {
    const basePath = "/tus";
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
        it("should be defined", () => {
            expect(new Tus({ storage: new DiskStorage({ directory: "/files" }) })).toBeInstanceOf(Tus);
        });
    });

    describe("pOST", () => {
        it("should 201", async () => {
            const request = create();
            const handler = await import("../../../src/fetch/tus");
            const fetchTusHandler = handler.default;

            const tusHandler = fetchTusHandler({ storage: new DiskStorage(options) });
            const response = await tusHandler(request);

            expect(response.status).toBe(201);
            expect(response.headers.get("location")).toBeDefined();
            expect(exposedHeaders(response)).toEqual(expect.arrayContaining(["location", "upload-expires"]));
        });

        it("should handle errors", async () => {
            const request = new Request(`${basePath}`, {
                headers: {
                    "Tus-Resumable": "1.0.0",
                    "Upload-Length": "invalid",
                },
                method: "POST",
            });

            const handler = await import("../../../src/fetch/tus");
            const fetchTusHandler = handler.default;

            const tusHandler = fetchTusHandler({ storage: new DiskStorage(options) });
            const response = await tusHandler(request);

            expect(response.status).toBe(400);

            const body = await response.json();

            expect(body.error).toBeDefined();
        });
    });

    describe("oPTIONS", () => {
        it("should 204", async () => {
            const request = new Request(`${basePath}`, {
                headers: {
                    "Tus-Resumable": "1.0.0",
                },
                method: "OPTIONS",
            });

            const handler = await import("../../../src/fetch/tus");
            const fetchTusHandler = handler.default;

            const tusHandler = fetchTusHandler({ storage: new DiskStorage(options) });
            const response = await tusHandler(request);

            expect(response.status).toBe(204);
            expect(response.headers.get("tus-version")).toBe("1.0.0");
            expect(response.headers.get("tus-extension")).toBe("creation,creation-with-upload,termination,checksum,creation-defer-length,expiration");
            expect(response.headers.get("tus-max-size")).toBe("6442450944");
            expect(response.headers.get("tus-checksum-algorithm")).toBe("md5,sha1");
        });
    });
});
