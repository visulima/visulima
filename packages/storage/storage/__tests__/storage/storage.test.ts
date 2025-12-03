import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import DiskStorage from "../../src/storage/local/disk-storage";
import type { Logger } from "../../src/utils";
import { metafile, storageOptions } from "../__helpers__/config";
import MockLogger from "../__helpers__/mock-logger";

describe("baseStorage", () => {
    let storage: DiskStorage;
    let directory: string;

    beforeAll(async () => {
        directory = temporaryDirectory();
        storage = new DiskStorage({ ...storageOptions, directory });

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
    });

    afterAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    it("should set correct default max upload size", () => {
        expect.assertions(1);

        expect(storage.maxUploadSize).toBe(6_442_450_944); // 6GB
    });

    it("should successfully validate valid files", async () => {
        expect.assertions(1);

        await expect(storage.validate(metafile)).resolves.toBeUndefined();
    });

    it("should reject files with invalid names during validation", async () => {
        expect.assertions(1);

        await expect(storage.validate({ ...metafile, name: "../file.ext" })).rejects.toHaveProperty("statusCode");
    });

    // Test video/* pattern

    it("should reject files with invalid MIME types during validation", async () => {
        expect.assertions(2);

        await expect(storage.validate({ ...metafile, contentType: "text/plain" })).rejects.toHaveProperty("statusCode", 415);
        await expect(storage.validate({ ...metafile, contentType: "application/javascript" })).rejects.toHaveProperty("statusCode", 415);
    });

    it("should accept files with valid MIME types during validation", async () => {
        expect.assertions(3);

        await expect(storage.validate({ ...metafile, contentType: "image/png" })).resolves.toBeUndefined();
        await expect(storage.validate({ ...metafile, contentType: "video/mp4" })).resolves.toBeUndefined();
        await expect(storage.validate({ ...metafile, contentType: "application/octet-stream" })).resolves.toBeUndefined();
    });

    it("should throw error for expired files", async () => {
        expect.assertions(1);

        await expect(storage.checkIfExpired({ ...metafile, expiredAt: Date.now() - 100 })).rejects.toHaveProperty("UploadErrorCode", "Gone");
    });

    it("should initialize with logger and log configuration", () => {
        expect.assertions(2);

        vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

        const logger = new MockLogger();

        const consoleDebugMock = vi.spyOn(logger, "debug");

        storage = new DiskStorage({ ...storageOptions, directory, logger });

        expect(consoleDebugMock).toHaveBeenCalledTimes(1);
        expect(consoleDebugMock).toHaveBeenCalledWith(expect.stringContaining("disk config:"));

        consoleDebugMock.mockRestore();

        vi.useRealTimers();
    });

    it("should support custom logger implementations", () => {
        expect.assertions(3);

        const consoleDebugMock = vi.spyOn(console, "debug").mockImplementation(() => {});

        storage = new DiskStorage({ ...storageOptions, directory, logger: console });
        (storage.logger as Logger).debug("some", "value");

        expect(consoleDebugMock).toHaveBeenCalledTimes(2);
        expect(consoleDebugMock).toHaveBeenCalledWith(expect.stringContaining("disk config:"));
        expect(consoleDebugMock).toHaveBeenCalledWith("some", "value");

        consoleDebugMock.mockRestore();
    });
});
