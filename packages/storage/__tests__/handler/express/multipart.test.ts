import { rm } from "node:fs/promises";

import supertest from "supertest";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Multipart from "../../../src/handler/multipart";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { storageOptions, testfile } from "../../__helpers__/config";
import app from "../../__helpers__/express-app";
import { waitForStorageReady } from "../../__helpers__/utils";

describe("express Multipart", () => {
    let response: supertest.Response;
    let directory: string;

    const basePath = "/multipart";
    let multipart: Multipart;

    const create = (): supertest.Test => supertest(app).post(basePath).attach("file", testfile.asBuffer, testfile.name);

    beforeAll(async () => {
        directory = temporaryDirectory();
        const storage = new DiskStorage({ ...storageOptions, allowMIME: ["video/mp4", "image/*"], directory });

        multipart = new Multipart({ storage });

        await waitForStorageReady(multipart);

        app.use(basePath, multipart.handle);
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
            expect.assertions(3);

            response = await supertest(app).post(basePath).field("custom", "customField").attach("file", testfile.asBuffer, {
                contentType: testfile.contentType,
                filename: testfile.filename,
            });

            expect(response.status).toBe(200);
            expect(response.body.size).toBeDefined();
            expect(response.header.location).toBeDefined();
        });

        it("should support JSON metadata in multipart upload", async () => {
            expect.assertions(3);

            const simpleMetadata = { custom: "value", number: "123" };

            response = await supertest(app).post(basePath).field("metadata", JSON.stringify(simpleMetadata)).attach("file", testfile.asBuffer, {
                contentType: testfile.contentType,
                filename: testfile.filename,
            });

            expect(response.status).toBe(200);
            expect(response.body.size).toBeDefined();
            expect(response.header.location).toBeDefined();
        });

        it("should return 415 for unsupported file types", async () => {
            expect.assertions(2);

            response = await supertest(app).post(basePath).attach("file", Buffer.from("test\u0000binary\u0000data"), {
                contentType: "application/json",
                filename: "testfile.json",
            });

            expect(response.status).toBe(415);
            expect(response.body.error).toBeDefined();
        });

        it("should return 400 when no file is provided", async () => {
            expect.assertions(2);

            response = await supertest(app).post(basePath);

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });
    });

    describe("options", () => {
        it("should return 204 for OPTIONS request", async () => {
            expect.assertions(1);

            response = await supertest(app).options(basePath);

            expect(response.status).toBe(204);
        });
    });

    describe("delete", () => {
        it("should successfully delete uploaded file", async () => {
            expect.assertions(1);

            const test = await create();

            const { location } = test.header;
            const fileUri = location.replace(/^\/\/[^/]+\//, "/"); // Remove //host:port/ and keep /path/

            response = await supertest(app).delete(fileUri);

            expect(response.status).toBe(204);
        });

        it("should return 404 for non-existent file deletion", async () => {
            expect.assertions(1);

            response = await supertest(app).delete(`${basePath}/1d2a1da2s-1d5as45d5a-4d5asd`);

            expect(response.status).toBe(404);
        });
    });
});
