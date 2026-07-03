import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import InteractiveStreamHook from "../src/interactive-stream-hook";

const createMockStream = (isTTY = true): { captured: string[]; stream: NodeJS.WriteStream } => {
    const captured: string[] = [];
    const passthrough = new PassThrough();

    passthrough.on("data", (chunk: Buffer | string) => {
        captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    });

    const stream = passthrough as unknown as NodeJS.WriteStream;

    Object.defineProperty(stream, "isTTY", { configurable: true, value: isTTY });

    return { captured, stream };
};

describe("interactiveStreamHook", () => {
    describe("construction", () => {
        it("should be instantiable with a write stream", () => {
            expect.assertions(1);

            const { stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            expect(hook).toBeDefined();
        });

        it("should have a static DRAIN constant equal to true", () => {
            expect.assertions(1);

            expect(InteractiveStreamHook.DRAIN).toBe(true);
        });
    });

    describe("active()", () => {
        it("should intercept stream.write so writes are not flushed immediately", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();
            captured.length = 0; // discard cursorHide

            stream.write("captured-message");

            // Hook stores the message in history rather than flushing.
            expect(captured.join("")).not.toContain("captured-message");
        });

        it("should return DRAIN from the wrapped write", () => {
            expect.assertions(1);

            const { stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();

            expect(stream.write("hi")).toBe(InteractiveStreamHook.DRAIN);
        });

        it("should call the write callback when one is provided", () => {
            expect.assertions(1);

            const { stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();

            let called = false;

            stream.write("data", () => {
                called = true;
            });

            expect(called).toBe(true);
        });

        it("should support a (data, encoding, callback) signature", () => {
            expect.assertions(1);

            const { stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();

            let called = false;

            (stream.write as (data: string, encoding: BufferEncoding, callback: () => void) => boolean)("data", "utf8", () => {
                called = true;
            });

            expect(called).toBe(true);
        });

        it("should accept Uint8Array writes", () => {
            expect.assertions(1);

            const { stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();

            expect(() => stream.write(Buffer.from("buf-data"))).not.toThrow();
        });
    });

    describe("inactive() + write history replay", () => {
        it("should replay captured writes when deactivated", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();
            stream.write("queued-1");
            stream.write("queued-2");
            captured.length = 0;

            hook.inactive();

            const out = captured.join("");

            expect(out).toContain("queued-1");
        });

        it("should prepend a newline separator when separateHistory=true", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();
            stream.write("msg");
            captured.length = 0;

            hook.inactive(true);

            expect(captured[0]).toBe("\n");
        });

        it("should be safe to deactivate with no captured history", () => {
            expect.assertions(1);

            const { stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();

            expect(() => {
                hook.inactive();
            }).not.toThrow();
        });
    });

    describe("renew()", () => {
        it("should restore the original write method", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();
            hook.renew();

            captured.length = 0;
            stream.write("after-renew");

            expect(captured.join("")).toContain("after-renew");
        });
    });

    describe("erase()", () => {
        it("should write ANSI erase sequences when count > 0", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            captured.length = 0;
            hook.erase(2);

            expect(captured.join("").length).toBeGreaterThan(0);
        });

        it("should not write anything when count is 0", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            captured.length = 0;
            hook.erase(0);

            expect(captured.join("")).toBe("");
        });
    });

    describe("write()", () => {
        it("should bypass the hook and flush directly to the underlying stream", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();
            captured.length = 0;

            hook.write("direct-write");

            expect(captured.join("")).toContain("direct-write");
        });
    });

    describe("non-TTY fallback", () => {
        it("should not emit cursor-hide on active() for a non-TTY stream", () => {
            expect.assertions(2);

            const { captured, stream } = createMockStream(false);
            const hook = new InteractiveStreamHook(stream);

            expect(hook.isTTY).toBe(false);

            hook.active();

            expect(captured.join("")).toBe("");
        });

        it("should not emit erase sequences on a non-TTY stream", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream(false);
            const hook = new InteractiveStreamHook(stream);

            captured.length = 0;
            hook.erase(5);

            expect(captured.join("")).toBe("");
        });

        it("should still buffer and replay writes on a non-TTY stream", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream(false);
            const hook = new InteractiveStreamHook(stream);

            hook.active();
            stream.write("piped-output");
            captured.length = 0;

            hook.inactive();

            expect(captured.join("")).toContain("piped-output");
        });

        it("should not emit cursor-show on renew() for a non-TTY stream", () => {
            expect.assertions(1);

            const { captured, stream } = createMockStream(false);
            const hook = new InteractiveStreamHook(stream);

            hook.active();
            captured.length = 0;
            hook.renew();

            expect(captured.join("")).toBe("");
        });
    });

    describe("bounded history buffer", () => {
        it("should flush oldest entries once the maxHistory threshold is exceeded", () => {
            expect.assertions(2);

            const { captured, stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream, { maxHistory: 4 });

            hook.active();
            captured.length = 0;

            // Writing past the threshold (4) triggers an early flush of the oldest half.
            for (let index = 0; index < 6; index += 1) {
                stream.write(`m${String(index)}`);
            }

            // The early flush should have written some of the oldest entries directly.
            expect(captured.join("")).toContain("m0");

            // Remaining buffered entries are replayed on inactive without duplicating flushed ones.
            captured.length = 0;
            hook.inactive();

            expect(captured.join("")).toContain("m5");
        });
    });

    describe("renew() defensive restore", () => {
        it("should not stomp a third-party write patch installed after active()", () => {
            expect.assertions(2);

            const { stream } = createMockStream();
            const hook = new InteractiveStreamHook(stream);

            hook.active();

            // Simulate another tool (a second hook, patch-console, a logger) patching write.
            const thirdParty = ((..._arguments: unknown[]) => true) as unknown as NodeJS.WriteStream["write"];

            stream.write = thirdParty;

            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

            hook.renew();

            // The third-party patch must still be in place.
            // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting identity, not invoking.
            expect(stream.write).toBe(thirdParty);
            expect(warn).toHaveBeenCalledTimes(1);

            warn.mockRestore();
        });
    });
});
