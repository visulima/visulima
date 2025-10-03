import { rm } from "node:fs/promises";
import { join } from "node:path";

import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import Multipart from "../../../src/handler/multipart";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { metadata, storageOptions, testfile, testRoot } from "../../__helpers__/config";
import app from "../../__helpers__/express-app";

vi.mock(import("node:fs/promises"), () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs.promises,
    };
});

vi.mock(import("node:fs"), () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs,
    };
});

// eslint-disable-next-line radar/no-identical-functions
vi.mock(import("node:fs"), () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs,
    };
});

describe("express Multipart", () => {
    let response: supertest.Response;
    let uri = "";

    const basePath = "/multipart";
    const directory = join(testRoot, "multipart");
    const options = { ...storageOptions, directory };
    const multipart = new Multipart({ storage: new DiskStorage(options) });

    app.use(basePath, multipart.handle);

    function create(): supertest.Test {
        return supertest(app).post(basePath).attach("file", testfile.asBuffer, testfile.name);
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
            response = await supertest(app).post(basePath).field("custom", "customField").attach("file", testfile.asBuffer, {
                contentType: testfile.contentType,
                filename: testfile.filename,
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

    describe("oPTIONS", () => {
        it("should 204", async () => {
            response = await supertest(app).options(basePath);

            expect(response.status).toBe(204);
        });
    });

    describe("dELETE", () => {
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
