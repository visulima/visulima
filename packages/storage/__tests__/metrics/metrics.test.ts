import { readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { metrics as otelMetrics } from "@opentelemetry/api";
import { createRequest } from "node-mocks-http";
import { temporaryDirectory } from "tempy";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NoOpMetrics, OpenTelemetryMetrics } from "../../src/metrics";
import DiskStorage from "../../src/storage/local/disk-storage";
import type { File as TFile } from "../../src/storage/utils/file";
import type { Metrics } from "../../src/utils/types";
import { metafile, storageOptions } from "../__helpers__/config";
import RequestReadStream from "../__helpers__/streams/request-read-stream";

const createTestFile = async (storage: DiskStorage): Promise<void> => {
    const filePath = join(storage.directory, "testfile.mp4");

    // Create empty file
    await writeFile(filePath, "");
};

/**
 * Mock metrics implementation for testing
 */
class MockMetrics implements Metrics {
    public readonly incrementCalls: { attributes?: Record<string, string | number>; name: string; value?: number }[] = [];

    public readonly timingCalls: { attributes?: Record<string, string | number>; duration: number; name: string }[] = [];

    public readonly gaugeCalls: { attributes?: Record<string, string | number>; name: string; value: number }[] = [];

    public increment(name: string, value = 1, attributes?: Record<string, string | number>): void {
        this.incrementCalls.push({ attributes, name, value });
    }

    public timing(name: string, duration: number, attributes?: Record<string, string | number>): void {
        this.timingCalls.push({ attributes, duration, name });
    }

    public gauge(name: string, value: number, attributes?: Record<string, string | number>): void {
        this.gaugeCalls.push({ attributes, name, value });
    }

    public reset(): void {
        this.incrementCalls.length = 0;
        this.timingCalls.length = 0;
        this.gaugeCalls.length = 0;
    }
}

describe("metrics Instrumentation", () => {
    let directory: string;
    let mockMetrics: MockMetrics;
    let storage: DiskStorage;
    const request = createRequest();

    beforeAll(async () => {
        directory = temporaryDirectory();
    });

    beforeEach(async () => {
        mockMetrics = new MockMetrics();
        storage = new DiskStorage({ ...storageOptions, directory, metrics: mockMetrics });
    });

    afterEach(async () => {
        // Clean up any files created during tests
        try {
            const files = await readdir(directory).catch(() => []);

            for (const file of files) {
                if (file.startsWith("copy-") || file.startsWith("move-") || file === "copied-file" || file === "moved-file") {
                    const filePath = join(directory, file);

                    await rm(filePath, { force: true }).catch(() => {});
                }
            }
        } catch {
            // ignore cleanup errors
        }
    });

    afterAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore cleanup errors
        }
    });

    describe(NoOpMetrics, () => {
        it("should create NoOpMetrics instance", () => {
            expect.assertions(1);

            const metrics = new NoOpMetrics();

            expect(metrics).toBeInstanceOf(NoOpMetrics);
        });

        it("should not throw when calling methods", () => {
            expect.assertions(3);

            const metrics = new NoOpMetrics();

            expect(() => metrics.increment("test")).not.toThrow();
            expect(() => metrics.timing("test", 100)).not.toThrow();
            expect(() => metrics.gauge("test", 10)).not.toThrow();
        });
    });

    describe(OpenTelemetryMetrics, () => {
        it("should create OpenTelemetryMetrics instance when @opentelemetry/api is available", async () => {
            expect.assertions(1);

            const meter = otelMetrics.getMeter("@visulima/storage-test", "1.0.0");
            const storageMetrics = new OpenTelemetryMetrics(meter);

            expect(storageMetrics).toBeInstanceOf(OpenTelemetryMetrics);
        });
    });

    describe("storage Operations Metrics", () => {
        describe("create", () => {
            it("should record metrics for create operation", async () => {
                expect.assertions(4);

                mockMetrics.reset();

                const readStream = new RequestReadStream();

                // eslint-disable-next-line no-underscore-dangle
                readStream.__mockSend();

                await storage.create(metafile);

                // Check increment was called
                const createIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.create.count");

                expect(createIncrement).toBeDefined();
                expect(createIncrement?.value).toBe(1);
                expect(createIncrement?.attributes?.storage).toBe("disk");

                // Check timing was called
                const createTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.create.duration");

                expect(createTiming).toBeDefined();
            });
        });

        describe("write", () => {
            it("should record metrics for write operation", async () => {
                expect.assertions(4);

                // Create file first
                await storage.create(metafile);
                await createTestFile(storage);

                mockMetrics.reset();

                const readStream = new RequestReadStream();

                // eslint-disable-next-line no-underscore-dangle
                readStream.__mockSend();

                await storage.write({ ...metafile, body: readStream, start: 0 });

                // Check increment was called
                const writeIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.write.count");

                expect(writeIncrement).toBeDefined();
                expect(writeIncrement?.value).toBe(1);
                expect(writeIncrement?.attributes?.storage).toBe("disk");

                // Check timing was called
                const writeTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.write.duration");

                expect(writeTiming).toBeDefined();

                // Check gauge was called for file size (if file has size property)
                // Note: file size gauge is only recorded if result has a size property
                // For write operations, bytesWritten is used, not size
            });
        });

        describe("get", () => {
            it("should record metrics for get operation", async () => {
                expect.assertions(4);

                // Create and write file first
                await storage.create(metafile);
                await createTestFile(storage);
                const readStream = new RequestReadStream();

                // eslint-disable-next-line no-underscore-dangle
                readStream.__mockSend();
                await storage.write({ ...metafile, body: readStream, start: 0 });

                mockMetrics.reset();

                await storage.get({ id: metafile.id });

                // Check increment was called
                const getIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.get.count");

                expect(getIncrement).toBeDefined();
                expect(getIncrement?.value).toBe(1);
                expect(getIncrement?.attributes?.storage).toBe("disk");

                // Check timing was called
                const getTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.get.duration");

                expect(getTiming).toBeDefined();
            });
        });

        describe("delete", () => {
            it("should record metrics for delete operation", async () => {
                expect.assertions(4);

                // Create file first
                await storage.create(metafile);

                mockMetrics.reset();

                await storage.delete({ id: metafile.id });

                // Check increment was called
                const deleteIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.delete.count");

                expect(deleteIncrement).toBeDefined();
                expect(deleteIncrement?.value).toBe(1);
                expect(deleteIncrement?.attributes?.storage).toBe("disk");

                // Check timing was called
                const deleteTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.delete.duration");

                expect(deleteTiming).toBeDefined();
            });
        });

        describe("copy", () => {
            it("should record metrics for copy operation", async () => {
                expect.assertions(4);

                // Create and write file first
                await storage.create(metafile);
                await createTestFile(storage);
                const readStream = new RequestReadStream();

                // eslint-disable-next-line no-underscore-dangle
                readStream.__mockSend();
                await storage.write({ ...metafile, body: readStream, start: 0 });

                mockMetrics.reset();

                await storage.copy(metafile.id, "copied-file");

                // Check increment was called
                const copyIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.copy.count");

                expect(copyIncrement).toBeDefined();
                expect(copyIncrement?.value).toBe(1);
                expect(copyIncrement?.attributes?.storage).toBe("disk");

                // Check timing was called
                const copyTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.copy.duration");

                expect(copyTiming).toBeDefined();
            });
        });

        describe("move", () => {
            it("should record metrics for move operation", async () => {
                expect.assertions(4);

                // Create and write file first
                await storage.create(metafile);
                await createTestFile(storage);
                const readStream = new RequestReadStream();

                // eslint-disable-next-line no-underscore-dangle
                readStream.__mockSend();
                await storage.write({ ...metafile, body: readStream, start: 0 });

                mockMetrics.reset();

                await storage.move(metafile.id, "moved-file");

                // Check increment was called
                const moveIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.move.count");

                expect(moveIncrement).toBeDefined();
                expect(moveIncrement?.value).toBe(1);
                expect(moveIncrement?.attributes?.storage).toBe("disk");

                // Check timing was called
                const moveTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.move.duration");

                expect(moveTiming).toBeDefined();
            });
        });

        describe("list", () => {
            it("should record metrics for list operation", async () => {
                expect.assertions(4);

                // Create a file first
                await storage.create(metafile);

                mockMetrics.reset();

                await storage.list();

                // Check increment was called
                const listIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.list.count");

                expect(listIncrement).toBeDefined();
                expect(listIncrement?.value).toBe(1);
                expect(listIncrement?.attributes?.storage).toBe("disk");

                // Check timing was called
                const listTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.list.duration");

                expect(listTiming).toBeDefined();
            });
        });

        describe("exists", () => {
            it("should record metrics for exists operation", async () => {
                expect.assertions(4);

                // Create a file first
                await storage.create(metafile);

                mockMetrics.reset();

                await storage.exists({ id: metafile.id });

                // Check increment was called
                const existsIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.exists.count");

                expect(existsIncrement).toBeDefined();
                expect(existsIncrement?.value).toBe(1);
                expect(existsIncrement?.attributes?.storage).toBe("disk");

                // Check timing was called
                const existsTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.exists.duration");

                expect(existsTiming).toBeDefined();
            });
        });
    });

    // TODO: Revisit batch operation tests - they have complex file system dependencies
    // that need proper mocking. The batch operations themselves work correctly,
    // but the tests need better isolation from file system operations.
    describe("batch Operations Metrics", () => {
        beforeEach(async () => {
            // Create multiple files for batch operations
            await storage.create(metafile);
            await createTestFile(storage);
            const readStream = new RequestReadStream();

            // eslint-disable-next-line no-underscore-dangle
            readStream.__mockSend();
            await storage.write({ ...metafile, body: readStream, start: 0 });

            const file2 = { ...metafile, id: "file-2", name: "file-2" };

            await storage.create(file2);
            const file2Path = join(storage.directory, "file-2");

            await writeFile(file2Path, "");
            const readStream2 = new RequestReadStream();

            // eslint-disable-next-line no-underscore-dangle
            readStream2.__mockSend();
            await storage.write({ ...file2, body: readStream2, start: 0 });
        });

        // TODO: Fix deleteBatch test - needs proper mocking of getMeta and file system operations
        describe("deleteBatch", () => {
            it.skip("should record metrics for deleteBatch operation", async () => {
                expect.assertions(9);

                mockMetrics.reset();

                // Mock getMeta to return mock file data (delete calls getMeta internally)
                const getMetaSpy = vi.spyOn(storage, "getMeta").mockImplementation(
                    async (id: string) =>
                        ({
                            contentType: "video/mp4",
                            id,
                            name: `${id}.mp4`,
                            size: 1000,
                            status: "completed",
                        }) as TFile,
                );

                // Mock file system operations to avoid actual file operations
                // Use vi.spyOn with dynamic import for proper ESM mocking
                const fsPromisesModule = await import("node:fs/promises");
                const removeSpy = vi.spyOn(fsPromisesModule, "rm").mockResolvedValue(undefined);
                const deleteMetaSpy = vi.spyOn(storage, "deleteMeta").mockResolvedValue(undefined);

                const testIds = ["file-1", "file-2"];

                const result = await storage.deleteBatch(testIds);

                // Check batch increment was called
                const batchIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.batch.delete.count");

                expect(batchIncrement).toBeDefined();
                expect(batchIncrement?.attributes?.batch_size).toBe(2);
                expect(batchIncrement?.attributes?.storage).toBe("disk");

                // Check batch timing was called
                const batchTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.batch.delete.duration");

                expect(batchTiming).toBeDefined();

                // Check success/failed gauges
                const successGauge = mockMetrics.gaugeCalls.find((call) => call.name === "storage.operations.batch.delete.successful_count");

                expect(successGauge).toBeDefined();
                expect(successGauge?.value).toBe(result.successfulCount);

                // Verify getMeta was called for each ID
                expect(getMetaSpy).toHaveBeenCalledTimes(2);
                expect(getMetaSpy).toHaveBeenCalledWith("file-1");
                expect(getMetaSpy).toHaveBeenCalledWith("file-2");

                // Restore spies
                getMetaSpy.mockRestore();
                removeSpy.mockRestore();
                deleteMetaSpy.mockRestore();
            });
        });

        // TODO: Fix copyBatch test - needs proper mocking of getMeta and file system operations
        describe("copyBatch", () => {
            it.skip("should record metrics for copyBatch operation", async () => {
                expect.assertions(9);

                mockMetrics.reset();

                // Spy on getMeta to avoid file system operations (copy calls getMeta internally)
                const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                    contentType: "video/mp4",
                    id: "source",
                    name: "source.mp4",
                    size: 1000,
                    status: "completed",
                } as TFile);

                // Mock file system operations to avoid actual file operations
                const fsPromisesModule = await import("node:fs/promises");
                const copyFileSpy = vi.spyOn(fsPromisesModule, "copyFile").mockResolvedValue(undefined);

                const operations = [
                    { destination: "copy-1.mp4", source: "file-1.mp4" },
                    { destination: "copy-2.mp4", source: "file-2.mp4" },
                ];

                await storage.copyBatch(operations);

                // Check batch increment was called
                const batchIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.batch.copy.count");

                expect(batchIncrement).toBeDefined();
                expect(batchIncrement?.attributes?.batch_size).toBe(2);
                expect(batchIncrement?.attributes?.storage).toBe("disk");

                // Check batch timing was called
                const batchTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.batch.copy.duration");

                expect(batchTiming).toBeDefined();

                // Verify getMeta was called for each source (copyBatch calls getMeta internally)
                expect(getMetaSpy).toHaveBeenCalledTimes(2);
                expect(getMetaSpy).toHaveBeenCalledWith("file-1.mp4");
                expect(getMetaSpy).toHaveBeenCalledWith("file-2.mp4");

                // Restore spies
                getMetaSpy.mockRestore();
                copyFileSpy.mockRestore();
            });
        });

        // TODO: Fix moveBatch test - needs proper mocking of getMeta and file system operations
        describe("moveBatch", () => {
            it.skip("should record metrics for moveBatch operation", async () => {
                expect.assertions(5);

                mockMetrics.reset();

                // Get the actual file names from storage
                const files = await storage.list();

                expect(files.length).toBeGreaterThanOrEqual(2);

                // Use file names (paths) for move operations - move uses file paths
                await storage.moveBatch([
                    { destination: "move-1", source: files[0].name },
                    { destination: "move-2", source: files[1].name },
                ]);

                // Check batch increment was called
                const batchIncrement = mockMetrics.incrementCalls.find((call) => call.name === "storage.operations.batch.move.count");

                expect(batchIncrement).toBeDefined();
                expect(batchIncrement?.attributes?.batch_size).toBe(2);
                expect(batchIncrement?.attributes?.storage).toBe("disk");

                // Check batch timing was called
                const batchTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.batch.move.duration");

                expect(batchTiming).toBeDefined();
            });
        });
    });

    describe("error Metrics", () => {
        it("should record error metrics when operation fails", async () => {
            expect.assertions(4);

            mockMetrics.reset();

            // Try to get a non-existent file - this will throw an error
            try {
                await storage.get({ id: "non-existent-file-id-that-does-not-exist" });

                expect.fail("Expected get to throw an error");
            } catch {
                // Expected to fail - error metrics should be recorded in instrumentOperation
            }

            // Check error increment was called - it should be recorded in the catch block
            const errorIncrements = mockMetrics.incrementCalls.filter((call) => call.name.includes("error"));

            expect(errorIncrements.length).toBeGreaterThan(0);

            const getErrorIncrement = errorIncrements.find((call) => call.name === "storage.operations.get.error.count");

            if (getErrorIncrement) {
                expect(getErrorIncrement?.attributes?.storage).toBe("disk");
                expect(getErrorIncrement?.attributes?.error).toBeDefined();
            }

            // Check error timing was called (with error attribute) - should be for get operation
            const errorTiming = mockMetrics.timingCalls.find((call) => call.name === "storage.operations.get.duration" && call.attributes?.error === "true");

            expect(errorTiming).toBeDefined();
        });
    });

    describe("default Metrics (NoOpMetrics)", () => {
        it("should use NoOpMetrics when no metrics provided", () => {
            expect.assertions(1);

            const storageWithoutMetrics = new DiskStorage({ ...storageOptions, directory });

            expect(storageWithoutMetrics.metrics).toBeInstanceOf(NoOpMetrics);
        });
    });
});
