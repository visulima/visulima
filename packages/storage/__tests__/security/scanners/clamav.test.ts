import { EventEmitter } from "node:events";
import { connect, type Socket } from "node:net";
import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { ClamAVScanner } from "../../../src/security/scanners/clamav";
import type { File } from "../../../src/utils/file";

// Mock net.connect
const mockSocket = new EventEmitter() as Socket & { destroy: any; setTimeout: any; write: any };
mockSocket.write = vi.fn();
mockSocket.destroy = vi.fn();
mockSocket.setTimeout = vi.fn();

vi.mock("node:net", () => ({
    connect: vi.fn(() => {
        setTimeout(() => mockSocket.emit("connect"), 0);
        return mockSocket;
    }),
    isIP: vi.fn(),
}));

const createFile = (overrides: Partial<File> = {}): File =>
    ({
        contentType: "application/octet-stream",
        id: "test-file",
        name: "test-file.txt",
        size: 100,
        ...overrides,
    }) as File;

describe("ClamAVScanner", () => {
    it("should report no threat when ClamAV returns OK", async () => {
        const scanner = new ClamAVScanner();
        const file = createFile();
        const content = Buffer.from("safe content");

        const scanPromise = scanner.scan(file, content);

        // Simulate ClamAV protocol
        // 1. Client connects (handled by mock)
        // 2. Client writes zINSTREAM
        // 3. Client streams data
        // 4. Socket closes with response
        setTimeout(() => {
            mockSocket.emit("data", Buffer.from("stream: OK\0"));
            mockSocket.emit("close");
        }, 10);

        const result = await scanPromise;

        expect(result.detected).toBe(false);
        expect(mockSocket.write).toHaveBeenCalledWith("zINSTREAM\0");
    });

    it("should report threat when ClamAV returns FOUND", async () => {
        const scanner = new ClamAVScanner();
        const file = createFile();
        const content = Buffer.from("malicious content");

        const scanPromise = scanner.scan(file, content);

        setTimeout(() => {
            mockSocket.emit("data", Buffer.from("stream: EICAR-Test-File FOUND\0"));
            mockSocket.emit("close");
        }, 10);

        const result = await scanPromise;

        expect(result.detected).toBe(true);
        expect(result.metadata?.virusName).toBe("EICAR-Test-File");
        expect(result.reason).toContain("Virus found");
    });

    it("should handle socket errors", async () => {
        const scanner = new ClamAVScanner();
        const file = createFile();
        const content = Buffer.from("content");

        const scanPromise = scanner.scan(file, content);

        setTimeout(() => {
            mockSocket.emit("error", new Error("Connection refused"));
        }, 10);

        await expect(scanPromise).rejects.toThrow("ClamAV socket error: Connection refused");
    });

    it("should handle connection failures", async () => {
        // Reset mock to fail connection
        vi.mocked(connect).mockImplementationOnce((): any => {
            const socket = new EventEmitter();
            setTimeout(() => socket.emit("error", new Error("Connection failed")), 0);
            return socket;
        });

        const scanner = new ClamAVScanner();
        const file = createFile();

        await expect(scanner.scan(file, Buffer.from("content"))).rejects.toThrow("Could not connect to ClamAV");
    });

    it("should handle streams correctly", async () => {
        const scanner = new ClamAVScanner();
        const file = createFile();
        const stream = new PassThrough();
        stream.end("stream content");

        const scanPromise = scanner.scan(file, stream);

        setTimeout(() => {
            mockSocket.emit("data", Buffer.from("stream: OK\0"));
            mockSocket.emit("close");
        }, 10);

        const result = await scanPromise;

        expect(result.detected).toBe(false);
        // Verify stream was piped
        expect(mockSocket.write).toHaveBeenCalledWith(expect.any(Buffer));
    });
});
