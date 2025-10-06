import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/utils";
import { metafile } from "../__helpers__/config";
import MockLogger from "../__helpers__/mock-logger";
import TestStorage from "../__helpers__/storage/test-storage";

describe("baseStorage", () => {
    let storage;

    it("should set correct default max upload size", () => {
        expect.assertions(1);

        storage = new TestStorage();

        expect(storage.maxUploadSize).toBe(5_497_558_138_880);
    });

    it("should successfully validate valid files", async () => {
        expect.assertions(1);

        storage = new TestStorage();

        await expect(storage.validate(metafile)).resolves.toBeUndefined();
    });

    it("should reject files with invalid names during validation", async () => {
        expect.assertions(1);

        storage = new TestStorage();

        await expect(storage.validate({ ...metafile, name: "../file.ext" })).rejects.toHaveProperty("statusCode");
    });

    it("should throw error for expired files", async () => {
        expect.assertions(1);

        storage = new TestStorage();

        await expect(storage.checkIfExpired({ ...metafile, expiredAt: Date.now() - 100 })).rejects.toHaveProperty("UploadErrorCode", "Gone");
    });

    it("should initialize with logger and log configuration", () => {
        expect.assertions(2);

        vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

        const logger = new MockLogger();

        const consoleDebugMock = vi.spyOn(logger, "debug");

        storage = new TestStorage({ logger });

        expect(consoleDebugMock).toHaveBeenCalledTimes(1);
        expect(consoleDebugMock).toHaveBeenCalledWithExactlyOnceWith("TestStorage config: { logger: [class MockLogger] }");

        consoleDebugMock.mockRestore();

        vi.useRealTimers();
    });

    it("should support custom logger implementations", () => {
        expect.assertions(3);

        const consoleDebugMock = vi.spyOn(console, "debug").mockImplementation(() => {});

        storage = new TestStorage({ logger: console });
        (storage.logger as Logger).debug("some", "value");

        expect(consoleDebugMock).toHaveBeenCalledTimes(2);
        expect(consoleDebugMock).toHaveBeenCalledWithExactlyOnceWith("some", "value");

        consoleDebugMock.mockRestore();
    });
});
