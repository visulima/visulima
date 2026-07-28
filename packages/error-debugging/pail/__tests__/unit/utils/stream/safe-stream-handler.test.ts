import type { Writable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SafeStreamHandler from "../../../../src/utils/stream/safe-stream-handler";

type MockStream = Writable & {
    emit: (event: string, ...arguments_: unknown[]) => void;
    end: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
};

const createStream = (writeReturn = true): MockStream => {
    const listeners = new Map<string, ((...arguments_: unknown[]) => void)[]>();
    const on = vi.fn((event: string, callback: (...arguments_: unknown[]) => void) => {
        const existing = listeners.get(event) ?? [];

        existing.push(callback);
        listeners.set(event, existing);
    });
    const emit = (event: string, ...arguments_: unknown[]): void => {
        for (const callback of listeners.get(event) ?? []) {
            callback(...arguments_);
        }
    };
    const write = vi.fn((_message: string, callback?: () => void) => {
        callback?.();

        return writeReturn;
    });
    const end = vi.fn();

    return { emit, end, on, write } as unknown as MockStream;
};

describe(SafeStreamHandler, () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should be ready on construction", () => {
        expect.assertions(1);

        const handler = new SafeStreamHandler(createStream(), "test");

        expect(handler.isReady).toBe(true);
    });

    it("should write the message to the underlying stream", () => {
        expect.assertions(1);

        const stream = createStream();
        const handler = new SafeStreamHandler(stream, "test");

        handler.write("hello");

        expect(stream.write).toHaveBeenCalledWith("hello", expect.any(Function));
    });

    it("should stay ready when the stream is not under backpressure", () => {
        expect.assertions(1);

        const handler = new SafeStreamHandler(createStream(true), "test");

        handler.write("hello");

        expect(handler.isReady).toBe(true);
    });

    it("should become not-ready when the stream applies backpressure", () => {
        expect.assertions(1);

        const handler = new SafeStreamHandler(createStream(false), "test");

        handler.write("hello");

        expect(handler.isReady).toBe(false);
    });

    it("should drop writes and warn while the stream is busy", () => {
        expect.assertions(2);

        const stream = createStream(false);
        const handler = new SafeStreamHandler(stream, "busy-stream");

        handler.write("first");
        handler.write("second");

        expect(stream.write).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith("Stream busy: busy-stream. Write will be dropped: \"second\"");
    });

    it("should become ready again on drain", () => {
        expect.assertions(2);

        const stream = createStream(false);
        const handler = new SafeStreamHandler(stream, "test");

        handler.write("hello");

        expect(handler.isReady).toBe(false);

        stream.emit("drain");

        expect(handler.isReady).toBe(true);
    });

    it("should become ready again on finish", () => {
        expect.assertions(2);

        const stream = createStream(false);
        const handler = new SafeStreamHandler(stream, "test");

        handler.write("hello");

        expect(handler.isReady).toBe(false);

        stream.emit("finish");

        expect(handler.isReady).toBe(true);
    });

    it("should forward end to the underlying stream", () => {
        expect.assertions(1);

        const stream = createStream();
        const handler = new SafeStreamHandler(stream, "test");

        handler.end("done");

        expect(stream.end).toHaveBeenCalledWith("done");
    });

    it("should report stream errors non-fatally instead of rethrowing", () => {
        expect.assertions(3);

        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const stream = createStream();
        const handler = new SafeStreamHandler(stream, "test");
        const error = new Error("stream failed");

        expect(() => stream.emit("error", error)).not.toThrow();
        expect(handler.isReady).toBe(false);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("test"), error);
    });

    it("should route stream errors to a provided onError callback", () => {
        expect.assertions(3);

        const onError = vi.fn();
        const stream = createStream();
        const handler = new SafeStreamHandler(stream, "test", onError);
        const error = new Error("stream failed");

        expect(() => stream.emit("error", error)).not.toThrow();
        expect(handler.isReady).toBe(false);
        expect(onError).toHaveBeenCalledWith(error, "test");
    });
});
