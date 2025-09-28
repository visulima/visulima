import { rm } from "node:fs/promises";
import {
    describe, expect, it,
} from "vitest";

import Tus from "../../../src/handler/tus";
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

const exposedHeaders = (response: Response): string[] => response
    .headers.get("Access-Control-Expose-Headers")
    ?.split(",")
    .map((s) => s.toLowerCase()) || [];

describe("Fetch Tus", () => {
    const basePath = "/tus";
    const directory = `${testRoot}/fetch-tus`;
    const options = { ...storageOptions, directory };
    const tus = new Tus({ storage: new DiskStorage(options) });

    function create(): Request {
        return new Request(`${basePath}`, {
            method: "POST",
            headers: {
                "Upload-Metadata": `name ${Buffer.from(metadata.name).toString("base64")},size ${Buffer.from(metadata.size.toString()).toString("base64")},mimeType ${Buffer.from(metadata.mimeType).toString("base64")}`,
                "Upload-Length": metadata.size.toString(),
                "Tus-Resumable": "1.0.0",
            },
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
            expect(new Tus({ storage: new DiskStorage({ directory: "/files" }) })).toBeInstanceOf(Tus);
        });
    });

    describe("POST", () => {
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
                method: "POST",
                headers: {
                    "Upload-Length": "invalid",
                    "Tus-Resumable": "1.0.0",
                },
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

    describe("OPTIONS", () => {
        it("should 204", async () => {
            const request = new Request(`${basePath}`, {
                method: "OPTIONS",
                headers: {
                    "Tus-Resumable": "1.0.0",
                },
            });

            const handler = await import("../../../src/fetch/tus");
            const fetchTusHandler = handler.default;

            const tusHandler = fetchTusHandler({ storage: new DiskStorage(options) });
            const response = await tusHandler(request);

            expect(response.status).toBe(204);
            expect(response.headers.get("tus-version")).toEqual("1.0.0");
            expect(response.headers.get("tus-extension")).toBe("creation,creation-with-upload,termination,checksum,creation-defer-length,expiration");
            expect(response.headers.get("tus-max-size")).toBe("6442450944");
            expect(response.headers.get("tus-checksum-algorithm")).toBe("md5,sha1");
        });
    });
});
