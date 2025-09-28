import { rm } from "node:fs/promises";
import {
    afterAll, beforeAll, describe, expect, it,
} from "vitest";
import { join } from "node:path";
import supertest from "supertest";

import Multipart from "../../../src/handler/multipart";
import DiskStorage from "../../../src/storage/local/disk-storage";
import {
    metadata, storageOptions, testfile, testRoot,
} from "../../__helpers__/config";
import app from "../../__helpers__/express-app";

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

describe("HTTP Multipart", () => {
    let response: supertest.Response;
    let uri = "";

    const basePath = "/http-multipart";
    const directory = join(testRoot, "http-multipart");
    const options = { ...storageOptions, directory };
    const multipart = new Multipart({ storage: new DiskStorage(options) });

    app.use(basePath, async (req, res) => {
        const handler = await import("../../../src/http/multipart");
        const httpMultipartHandler = handler.default;

        const multipartHandler = httpMultipartHandler({ storage: new DiskStorage(options) });
        await multipartHandler(req, res);
    });

    function create(): supertest.Test {
        return supertest(app).post(basePath).attach("file", testfile.asBuffer, testfile.name);
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
            response = await supertest(app).post(basePath).field("custom", "customField").attach("file", testfile.asBuffer, {
                filename: testfile.filename,
                contentType: testfile.contentType,
            });

            expect(response.status).toBe(200);
            expect(response.body.size).toBeDefined();
            expect(response.header.location).toBeDefined();
        });

        it("should support json metadata", async () => {
            response = await supertest(app).post(basePath).field("metadata", JSON.stringify(metadata)).attach("file", testfile.asBuffer, testfile.name);

            expect(response.status).toBe(200);
            expect(response.body.size).toBeDefined();
            expect(response.header.location).toBeDefined();
        });

        it("should 415 (unsupported filetype)", async () => {
            response = await supertest(app).post(basePath).attach("file", testfile.asBuffer, "testfile.txt");

            expect(response.status).toBe(415);
            expect(response.body.error).toBeDefined();
        });

        it("should 400 (missing file)", async () => {
            response = await supertest(app).post(basePath);

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });
    });

    describe("OPTIONS", () => {
        it("should 204", async () => {
            response = await supertest(app).options(basePath);

            expect(response.status).toBe(204);
        });
    });

    describe("DELETE", () => {
        it("should 204", async () => {
            const test = await create();

            uri ||= test.header.location;

            response = await supertest(app).delete(uri);

            expect(response.status).toBe(204);
        });

        it("should 404", async () => {
            response = await supertest(app).delete(`${basePath}/1d2a1da2s-1d5as45d5a-4d5asd`);

            expect(response.status).toBe(404);
        });
    });
});
