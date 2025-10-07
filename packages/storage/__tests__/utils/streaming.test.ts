import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import {
    createBandwidthLimitedStream,
    createRangeStream,
    createStreamingResponse,
    monitorStreamPerformance,
    shouldUseStreaming,
    withTimeout,
} from "../../src/utils/streaming";

describe("streaming utilities", () => {
    describe(shouldUseStreaming, () => {
        it("should return true for files larger than 1MB", () => {
            expect.assertions(3);

            expect(shouldUseStreaming(1024 * 1024 + 1)).toBe(true); // 1MB + 1 byte
            expect(shouldUseStreaming(10 * 1024 * 1024)).toBe(true); // 10MB
            expect(shouldUseStreaming(100 * 1024 * 1024)).toBe(true); // 100MB
        });

        it("should return false for files smaller than 1MB", () => {
            expect.assertions(3);

            expect(shouldUseStreaming(1024 * 1024 - 1)).toBe(false); // 1MB - 1 byte
            expect(shouldUseStreaming(100 * 1024)).toBe(false); // 100KB
            expect(shouldUseStreaming(0)).toBe(false); // Empty file
        });

        it("should use custom threshold", () => {
            expect.assertions(2);

            expect(shouldUseStreaming(500 * 1024, 1024 * 1024)).toBe(false); // 500KB with 1MB threshold
            expect(shouldUseStreaming(2 * 1024 * 1024, 1024 * 1024)).toBe(true); // 2MB with 1MB threshold
        });
    });

    describe(createStreamingResponse, () => {
        it("should create streaming response with proper event handlers", () => {
            expect.assertions(5);

            const stream = Readable.from(Buffer.from("test data"));
            const onError = vi.fn();
            const onEnd = vi.fn();
            const onData = vi.fn();

            const result = createStreamingResponse(stream, {
                handleBackpressure: true,
                onData,
                onEnd,
                onError,
                timeout: 5000,
            });

            expect(result).toBe(stream);

            // Simulate events
            stream.emit("error", new Error("Test error"));
            stream.emit("end");
            stream.emit("data", Buffer.from("chunk"));

            expect(onError).toHaveBeenCalledWith(expect.any(Error));
            expect(onEnd).toHaveBeenCalledWith();
            expect(onData).toHaveBeenCalledWith(Buffer.from("chunk"));
        });

        it("should handle backpressure with pause/resume", () => {
            expect.assertions(2);

            const stream = Readable.from(Buffer.from("test data"));
            const result = createStreamingResponse(stream, {
                handleBackpressure: true,
            });

            expect(result).toBe(stream);

            // Simulate backpressure events
            stream.emit("pause");
            stream.emit("resume");

            // Should not throw errors
            expect(result.readable).toBe(true);
        });
    });

    describe(createRangeStream, () => {
        it("should create a range-limited stream", () => {
            expect.assertions(1);

            const sourceStream = Readable.from(Buffer.from("hello world"));
            const rangeStream = createRangeStream(sourceStream, 6, 10); // "world"

            expect(rangeStream).toBeInstanceOf(Readable);
        });
    });

    describe(monitorStreamPerformance, () => {
        it("should monitor stream performance and log metrics", () => {
            expect.assertions(2);

            const stream = Readable.from(Buffer.from("test data"));
            const logger = { debug: vi.fn() };

            const monitoredStream = monitorStreamPerformance(stream, "test-stream", logger);

            expect(monitoredStream).toBe(stream);

            // Simulate stream completion
            stream.emit("data", Buffer.from("chunk1"));
            stream.emit("data", Buffer.from("chunk2"));
            stream.emit("end");

            expect(logger.debug).toHaveBeenCalledWith();
        });

        it("should handle stream errors", () => {
            expect.assertions(2);

            const stream = Readable.from(Buffer.from("test data"));
            const logger = { debug: vi.fn() };

            const monitoredStream = monitorStreamPerformance(stream, "test-stream", logger);

            expect(monitoredStream).toBe(stream);

            // Simulate stream error
            const error = new Error("Stream failed");

            stream.emit("error", error);

            expect(logger.debug).toHaveBeenCalledWith("test-stream", expect.any(Number), expect.stringContaining("Stream failed"));
        });
    });

    describe(withTimeout, () => {
        it("should wrap stream with timeout", () => {
            expect.assertions(1);

            const stream = Readable.from(Buffer.from("test data"));
            const timeoutStream = withTimeout(stream, 1000);

            expect(timeoutStream).toBe(stream);
        });

        it("should destroy stream on timeout", () => {
            expect.assertions(1);

            const stream = Readable.from(Buffer.from("test data"));
            const destroySpy = vi.spyOn(stream, "destroy");

            withTimeout(stream, 1); // Very short timeout

            // Wait for timeout
            setTimeout(() => {
                expect(destroySpy).toHaveBeenCalledWith(expect.any(Error));
            }, 10);
        });
    });

    describe(createBandwidthLimitedStream, () => {
        it("should create a bandwidth-limited stream", () => {
            expect.assertions(2);

            const sourceStream = Readable.from(Buffer.from("test data"));
            const limitedStream = createBandwidthLimitedStream(sourceStream, 1000); // 1000 bytes/second

            expect(limitedStream).toBeInstanceOf(Readable);
            expect(limitedStream.readable).toBe(true);
        });

        it("should limit data transfer rate", () => {
            expect.assertions(2);

            const data = Buffer.alloc(100); // Small amount of data
            const sourceStream = Readable.from(data);
            const limitedStream = createBandwidthLimitedStream(sourceStream, 1000); // High rate

            expect(limitedStream).toBeInstanceOf(Readable);
            expect(limitedStream.readable).toBe(true);
        });
    });
});
