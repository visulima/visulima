import { PassThrough, Readable } from "node:stream";
import { buffer as collect } from "node:stream/consumers";

import { describe, expect, it, vi } from "vitest";

import { applyRange, createRangeLimitedStream, createStreamResponse, pipeWithBackpressure, rangeIfCurrent } from "../../../src/handler/utils/stream-utils";

const makeSequentialBuffer = (length: number): Buffer => {
    const buffer = Buffer.alloc(length);

    for (let index = 0; index < length; index += 1) {
        buffer[index] = index % 256;
    }

    return buffer;
};

describe("stream-utils", () => {
    describe(createRangeLimitedStream, () => {
        it("returns only the requested byte range", async () => {
            expect.assertions(1);

            const source = Readable.from([Buffer.from("Hello, World!")]);
            const limited = createRangeLimitedStream(source, 7, 11);

            const buffer = await collect(limited);

            expect(buffer.toString()).toBe("World");
        });

        it("destroys the source when the range stream is destroyed early", async () => {
            expect.assertions(1);

            const source = new PassThrough();
            const limited = createRangeLimitedStream(source, 0, 1_000_000);

            limited.destroy();

            await new Promise<void>((resolve) => {
                setImmediate(resolve);
            });

            expect(source.destroyed).toBe(true);
        });

        it("returns the full content when range covers entire stream", async () => {
            expect.assertions(1);

            const source = Readable.from([Buffer.from("abc"), Buffer.from("def")]);
            const limited = createRangeLimitedStream(source, 0, 5);

            const buffer = await collect(limited);

            expect(buffer.toString()).toBe("abcdef");
        });

        it("skips chunks entirely before the range", async () => {
            expect.assertions(1);

            // Use 2 chunks (3 + 3 bytes) and request bytes 3..5 — first chunk skipped, second sent in full.
            const source = Readable.from([Buffer.from("abc"), Buffer.from("def")]);
            const limited = createRangeLimitedStream(source, 3, 5);

            const buffer = await collect(limited);

            expect(buffer.toString()).toBe("def");
        });

        it("wires the source into the returned stream without an external pipe", async () => {
            expect.assertions(1);

            // Regression: createRangeLimitedStream must connect the source itself.
            // Previously it returned an unfed PassThrough, so 206 responses hung
            // with an empty body.
            const source = Readable.from([Buffer.from("abcdefghij")]);
            const limited = createRangeLimitedStream(source, 2, 5);

            const buffer = await collect(limited);

            expect(buffer.toString()).toBe("cdef");
        });

        it("propagates source errors to the returned stream", async () => {
            expect.assertions(1);

            const source = new Readable({
                read() {
                    this.destroy(new Error("source boom"));
                },
            });
            const limited = createRangeLimitedStream(source, 0, 4);

            await expect(collect(limited)).rejects.toThrow("source boom");
        });
    });

    describe(createStreamResponse, () => {
        it("packages stream + size + headers into a response object", () => {
            expect.assertions(3);

            const source = Readable.from([Buffer.from("x")]);
            const response = createStreamResponse(source, 1, { "X-Foo": "bar" });

            expect(response.stream).toBe(source);
            expect(response.size).toBe(1);
            expect(response.headers).toStrictEqual({ "X-Foo": "bar" });
        });

        it("defaults headers to empty when omitted", () => {
            expect.assertions(1);

            const source = Readable.from([]);
            const response = createStreamResponse(source);

            expect(response.headers).toStrictEqual({});
        });
    });

    describe(pipeWithBackpressure, () => {
        it("pipes data from source to destination and signals end", async () => {
            expect.assertions(1);

            const source = Readable.from([Buffer.from("hello")]);
            const destination = new PassThrough();
            const sendError = async () => undefined;

            pipeWithBackpressure(source, destination as unknown as never, sendError);

            const buffer = await collect(destination);

            expect(buffer.toString()).toBe("hello");
        });

        it("invokes sendError when the source emits an error", async () => {
            expect.assertions(1);

            const source = new PassThrough();
            // A response that has not sent its headers yet.
            const destination = Object.assign(new PassThrough(), { removeHeader: () => undefined });
            let sentError: Error | undefined;
            const sendError = async (_response: unknown, error: Error) => {
                sentError = error;
            };

            pipeWithBackpressure(source, destination as unknown as never, sendError);

            source.emit("error", new Error("boom"));

            // Allow the async error handler to run.
            await new Promise((resolve) => {
                setImmediate(resolve);
            });

            expect(sentError?.message).toBe("boom");
        });

        it("delivers the exact requested byte slice end-to-end through a range-limited stream", async () => {
            expect.assertions(1);

            const full = makeSequentialBuffer(1000);
            const limited = createRangeLimitedStream(Readable.from(full), 100, 299);
            const destination = new PassThrough();
            const sendError = async () => undefined;

            pipeWithBackpressure(limited, destination as unknown as never, sendError);

            const buffer = await collect(destination);

            expect(buffer).toStrictEqual(full.subarray(100, 300));
        });

        it("destroys the response instead of re-sending headers when the source errors after headers are flushed", async () => {
            expect.assertions(2);

            const source = new PassThrough();
            const destination = new PassThrough() as PassThrough & { headersSent?: boolean };
            let sendErrorCalled = false;
            const sendError = async () => {
                sendErrorCalled = true;
            };

            pipeWithBackpressure(source, destination as unknown as never, sendError);

            // Simulate the first body byte having been flushed (headers committed).
            source.write("data");

            await new Promise((resolve) => {
                setImmediate(resolve);
            });

            destination.headersSent = true;

            const destroyed = new Promise<Error>((resolve) => {
                destination.on("error", resolve);
            });

            source.emit("error", new Error("mid-stream"));

            const error = await destroyed;

            expect(error.message).toBe("mid-stream");
            expect(sendErrorCalled).toBe(false);
        });
    });

    describe(rangeIfCurrent, () => {
        const headers = { ETag: "\"abc\"", "Last-Modified": "Thu, 01 Jan 2026 00:00:00 GMT" };

        it("keeps the range without an If-Range validator, and has nothing to keep without a range", () => {
            expect.assertions(2);

            expect(rangeIfCurrent("bytes=0-1", undefined, headers)).toBe("bytes=0-1");
            expect(rangeIfCurrent(undefined, "\"abc\"", headers)).toBeUndefined();
        });

        it("keeps the range for a matching strong ETag, whatever the header name's case", () => {
            expect.assertions(2);

            expect(rangeIfCurrent("bytes=0-1", " \"abc\" ", headers)).toBe("bytes=0-1");
            expect(rangeIfCurrent("bytes=0-1", "\"abc\"", { etag: "\"abc\"" })).toBe("bytes=0-1");
        });

        it("drops the range for a different or weak ETag", () => {
            expect.assertions(2);

            expect(rangeIfCurrent("bytes=0-1", "\"other\"", headers)).toBeUndefined();
            expect(rangeIfCurrent("bytes=0-1", "W/\"abc\"", { ETag: "W/\"abc\"" })).toBeUndefined();
        });

        it("compares a date validator with Last-Modified, and drops the range when the file has none", () => {
            expect.assertions(3);

            expect(rangeIfCurrent("bytes=0-1", "Thu, 01 Jan 2026 00:00:00 GMT", headers)).toBe("bytes=0-1");
            expect(rangeIfCurrent("bytes=0-1", "Fri, 02 Jan 2026 00:00:00 GMT", headers)).toBeUndefined();
            expect(rangeIfCurrent("bytes=0-1", "Thu, 01 Jan 2026 00:00:00 GMT", undefined)).toBeUndefined();
        });

        it("drops the range for a date validator when Last-Modified is less than a second old (RFC 9110 §13.1.5)", () => {
            expect.assertions(2);

            vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00.999Z") });

            try {
                expect(rangeIfCurrent("bytes=0-1", "Thu, 01 Jan 2026 00:00:00 GMT", headers)).toBeUndefined();

                vi.setSystemTime(new Date("2026-01-01T00:00:01Z"));

                expect(rangeIfCurrent("bytes=0-1", "Thu, 01 Jan 2026 00:00:00 GMT", headers)).toBe("bytes=0-1");
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe(applyRange, () => {
        it("answers a full 200 without a range, with Content-Length only for a known size", () => {
            expect.assertions(3);

            const stream = Readable.from([]);

            expect(applyRange(stream, 10, undefined)).toStrictEqual({ headers: { "Accept-Ranges": "bytes", "Content-Length": 10 }, partial: false, stream });
            expect(applyRange(stream, undefined, undefined).headers).toStrictEqual({ "Accept-Ranges": "bytes" });
            // A range on a stream of unknown size cannot be served partially
            expect(applyRange(stream, undefined, { end: 1, start: 0 }).partial).toBe(false);
        });

        it("answers a partial response with Content-Range and the slice", async () => {
            expect.assertions(2);

            const ranged = applyRange(Readable.from(makeSequentialBuffer(10)), 10, { end: 5, start: 2 });

            expect(ranged.headers).toStrictEqual({ "Accept-Ranges": "bytes", "Content-Length": 4, "Content-Range": "bytes 2-5/10" });
            await expect(collect(ranged.stream)).resolves.toStrictEqual(makeSequentialBuffer(10).subarray(2, 6));
        });
    });

    describe("createRangeLimitedStream across chunks", () => {
        it("assembles a range spanning many small chunks and stops at its end", async () => {
            expect.assertions(1);

            const full = makeSequentialBuffer(100);
            const chunks = Array.from({ length: 10 }, (_, index) => full.subarray(index * 10, index * 10 + 10));
            const limited = createRangeLimitedStream(Readable.from(chunks), 15, 34);

            await expect(collect(limited)).resolves.toStrictEqual(full.subarray(15, 35));
        });

        // Timing-sensitive under parallel CI load (coverage + large-buffer suites): allow a margin.
        it("pauses the source while the consumer applies backpressure, and delivers everything once it reads", { timeout: 20_000 }, async () => {
            expect.assertions(1);

            const full = makeSequentialBuffer(256 * 1024);
            const chunks = Array.from({ length: 16 }, (_, index) => full.subarray(index * 16_384, (index + 1) * 16_384));
            const limited = createRangeLimitedStream(Readable.from(chunks), 0, full.length - 1);

            // Nobody reads for a while: the buffer fills up and push() reports backpressure.
            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            await expect(collect(limited)).resolves.toStrictEqual(full);
        });
    });

    describe("pipeWithBackpressure edge cases", () => {
        it("resumes a paused source on drain", async () => {
            expect.assertions(1);

            const source = Readable.from([Buffer.alloc(64 * 1024, 1), Buffer.alloc(64 * 1024, 2), Buffer.alloc(64 * 1024, 3)]);
            const destination = new PassThrough({ highWaterMark: 1024 });

            pipeWithBackpressure(source, destination as unknown as never, async () => undefined);

            const buffer = await collect(destination);

            expect(buffer).toHaveLength(3 * 64 * 1024);
        });

        it("ignores a source error once the destination is closed", async () => {
            expect.assertions(1);

            const source = new PassThrough();
            const destination = new PassThrough();
            let sendErrorCalled = false;

            source.on("error", () => undefined);
            pipeWithBackpressure(source, destination as unknown as never, async () => {
                sendErrorCalled = true;
            });

            destination.emit("close");
            source.emit("error", new Error("late"));

            await new Promise((resolve) => {
                setImmediate(resolve);
            });

            expect(sendErrorCalled).toBe(false);
        });

        it("destroys the destination when sending the error response fails", async () => {
            expect.assertions(1);

            const source = new PassThrough();
            const destination = Object.assign(new PassThrough(), { removeHeader: () => undefined });
            const destroyed = new Promise<Error>((resolve) => {
                destination.on("error", resolve);
            });

            pipeWithBackpressure(source, destination as unknown as never, async () => {
                throw new Error("headers already sent");
            });

            source.emit("error", new Error("read failed"));

            await expect(destroyed).resolves.toStrictEqual(expect.objectContaining({ message: "read failed" }));
        });
    });
});
