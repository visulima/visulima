import { describe, expect, it } from "vitest";

import { codeFrame } from "../../src/code-frame";
import captureRawStackTrace from "../../src/error/capture-raw-stack-trace";
import { VisulimaError } from "../../src/error/visulima-error";
import parseStacktrace from "../../src/stacktrace/parse-stacktrace";
import process from "../../src/util/process";

describe("runtime capabilities on workerd", () => {
    it("should read `process` through the shim without throwing", () => {
        expect.assertions(3);

        // The package never touches the bare `process` global; it goes through a Proxy shim that
        // yields `undefined` for missing keys instead of a ReferenceError. Under `nodejs_compat`
        // the real values come through; either way, reading must be safe.
        expect(() => process.platform).not.toThrow();
        expect(() => process.env?.DEBUG).not.toThrow();
        expect(process.versions).toBeDefined();
    });

    it("should return undefined for a key that exists on neither `process` nor the shim", () => {
        expect.assertions(1);

        expect((process as unknown as Record<string, unknown>).thisKeyDoesNotExist).toBeUndefined();
    });

    it("should expose `process.cwd()` under nodejs_compat", () => {
        expect.assertions(1);

        expect(process.cwd?.()).toBeTypeOf("string");
    });

    it("should not require `DEBUG` to be set for the parser to run", () => {
        expect.assertions(1);

        // `parseStacktrace` reads `process.env?.DEBUG` on every call; on a runtime where `env` is
        // absent this must be a no-op rather than a TypeError.
        expect(parseStacktrace({ stack: "Error: x\n    at handler (index.js:1:1)" } as Error)).toHaveLength(1);
    });

    it("should capture a raw stack trace via V8's `captureStackTrace`", () => {
        expect.assertions(2);

        // workerd is V8, so the API exists; the helper still guards for runtimes where it does not.
        expect("captureStackTrace" in Error).toBe(true);
        expect(captureRawStackTrace()).toContain("at ");
    });

    it("should build a VisulimaError with a hint and a location", () => {
        expect.assertions(3);

        const error = new VisulimaError({ hint: "try again", message: "edge failure", name: "EdgeError" });

        expect(error.name).toBe("EdgeError");
        expect(error.hint).toBe("try again");
        expect(error.stack).toBeDefined();
    });

    it("should not need `Buffer` for any code-frame work", () => {
        expect.assertions(1);

        // Code framing is pure string work — no `Buffer`, no `TextDecoder`, no filesystem.
        expect(codeFrame("a\r\nb\r\nc", { start: { line: 2 } })).toContain("b");
    });

    it("should offer Web Crypto rather than needing `node:crypto`", async () => {
        expect.assertions(2);

        // Nothing on the root import path hashes anything; the only `node:crypto` use is the
        // opt-in AI solution cache. Web Crypto is what an edge consumer should reach for instead.
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Web Crypto is always present on workerd
        expect(crypto.randomUUID()).toBeTypeOf("string");
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Web Crypto is always present on workerd
        await expect(crypto.subtle.digest("SHA-256", new TextEncoder().encode("x"))).resolves.toBeInstanceOf(ArrayBuffer);
    });
});
