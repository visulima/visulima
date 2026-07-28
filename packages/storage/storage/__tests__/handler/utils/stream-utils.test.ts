import { PassThrough, Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createRangeLimitedStream, createStreamResponse, pipeWithBackpressure } from "../../../src/handler/utils/stream-utils";

const collect = (stream: Readable): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });

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
            const destination = new PassThrough();
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
});
