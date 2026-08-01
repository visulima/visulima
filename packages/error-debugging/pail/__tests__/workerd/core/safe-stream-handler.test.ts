import { stdout } from "node:process";
import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import SafeStreamHandler from "../../../src/utils/stream/safe-stream-handler";

describe("safeStreamHandler on node:stream in workerd", () => {
    it("writes through a node:stream Writable", () => {
        expect.assertions(2);

        const chunks: string[] = [];
        const stream = new Writable({
            write(chunk: unknown, _encoding: unknown, callback: () => void): void {
                chunks.push(String(chunk));
                callback();
            },
        });

        const handler = new SafeStreamHandler(stream, "workerd-stream");

        handler.write("first");
        handler.write("second");

        expect(chunks).toStrictEqual(["first", "second"]);
        expect(handler.isReady).toBe(true);
    });

    it("stops writing and reports non-fatally once the stream errors", () => {
        expect.assertions(3);

        const errors: [Error, string][] = [];
        const stream = new Writable({
            write(_chunk: unknown, _encoding: unknown, callback: (error?: Error) => void): void {
                callback();
            },
        });

        const handler = new SafeStreamHandler(stream, "failing", (error, name) => {
            errors.push([error, name]);
        });

        // `error` events are emitted asynchronously by node:stream; the handler must
        // absorb them instead of letting them escape to the runtime.
        stream.emit("error", new Error("stream exploded"));

        expect(errors).toHaveLength(1);
        expect(handler.isReady).toBe(false);

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        try {
            handler.write("dropped");

            expect(warnSpy).toHaveBeenCalledTimes(1);
        } finally {
            warnSpy.mockRestore();
        }
    });

    it("recovers on a drain event", () => {
        expect.assertions(2);

        const stream = new Writable({
            highWaterMark: 1,
            write(_chunk: unknown, _encoding: unknown, callback: () => void): void {
                callback();
            },
        });

        const handler = new SafeStreamHandler(stream, "draining");

        stream.emit("error", new Error("boom"));

        expect(handler.isReady).toBe(false);

        stream.emit("drain");

        expect(handler.isReady).toBe(true);
    });

    it("forwards end() to the underlying stream", async () => {
        expect.assertions(1);

        const stream = new Writable({
            write(_chunk: unknown, _encoding: unknown, callback: () => void): void {
                callback();
            },
        });

        // `finish` is emitted asynchronously by node:stream in workerd, exactly as in Node.
        const finished = new Promise<boolean>((resolve) => {
            stream.on("finish", () => {
                resolve(true);
            });
        });

        const handler = new SafeStreamHandler(stream, "closing");

        handler.end();

        await expect(finished).resolves.toBe(true);
    });

    it("accepts the node:process stdout stream as a target", () => {
        expect.assertions(1);

        const spy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        try {
            const handler = new SafeStreamHandler(stdout, "process.stdout");

            handler.write("to workerd stdout");

            expect(spy.mock.calls.map((call) => String(call[0]))).toStrictEqual(["to workerd stdout"]);
        } finally {
            spy.mockRestore();
        }
    });
});
