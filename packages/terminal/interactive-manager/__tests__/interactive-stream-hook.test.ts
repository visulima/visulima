import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import InteractiveStreamHook from "../src/interactive-stream-hook";

const createMockStream = (): { captured: string[]; stream: NodeJS.WriteStream } => {
    const captured: string[] = [];
    const passthrough = new PassThrough();

    passthrough.on("data", (chunk: Buffer | string) => {
        captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    });

    return { captured, stream: passthrough as unknown as NodeJS.WriteStream };
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
});
