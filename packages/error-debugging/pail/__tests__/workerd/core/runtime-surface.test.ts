import { Buffer } from "node:buffer";
import process from "node:process";

import { describe, expect, it } from "vitest";

import { createPailError, PailError } from "../../../src/error";
import { renderObjectTree } from "../../../src/object-tree";
import { PailBrowser } from "../../../src/pail.browser";
import MessageFormatterProcessor from "../../../src/processor/message-formatter-processor";
import { MetaCaptureReporter } from "./helpers";

const NODE_VERSION_REGEX = /^\d+\./;

describe("runtime surface in workerd", () => {
    it("loads pail as ESM without any CommonJS interop", () => {
        expect.assertions(2);

        // workerd modules are ESM-only: a stray `require(` on a core code path would
        // have thrown at import time rather than reaching this assertion.
        expect((globalThis as { require?: unknown }).require).toBeTypeOf("undefined");
        expect(PailBrowser).toBeTypeOf("function");
    });

    it("reports a Node-compatible version string without a real Node runtime", () => {
        expect.assertions(2);

        // Feature detection based on `process.versions.node` cannot be used to tell
        // workerd from Node — `nodejs_compat` reports a Node version, and every other
        // key is blank.
        expect(process.versions.node).toMatch(NODE_VERSION_REGEX);
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- `navigator` is always present in workerd
        expect(navigator.userAgent).toBe("Cloudflare-Workers");
    });

    it("logs Buffer values through the default stringify implementation", () => {
        expect.assertions(2);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ processors: [new MessageFormatterProcessor()], reporters: [reporter], throttle: 0 });

        logger.info(Buffer.from("payload"));
        logger.info("bytes %j", Buffer.from([1, 2]));

        expect(String(reporter.messages[0])).toBe("payload");
        expect(String(reporter.messages[1])).toContain("\"data\"");
    });

    it("renders object trees with no runtime-specific dependencies", () => {
        expect.assertions(1);

        expect(renderObjectTree({ age: 30, name: "John" })).toBe("├─ name: John\n└─ age: 30");
    });

    it("supports Error `cause` and structured PailError serialization", () => {
        expect.assertions(4);

        const error = createPailError({
            cause: new Error("issuer down"),
            fix: "retry with another card",
            message: "payment failed",
            status: 402,
            why: "card declined",
        });

        expect(error).toBeInstanceOf(PailError);
        expect(error.toJSON()).toMatchObject({ fix: "retry with another card", name: "PailError", status: 402, why: "card declined" });
        expect(error.toString()).toContain("Cause: issuer down");
        expect(error.stack).toBeTypeOf("string");
    });

    it("routes an Error argument onto meta.error", () => {
        expect.assertions(2);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ reporters: [reporter], throttle: 0 });
        const error = new PailError("boom");

        logger.error(error, { requestId: "abc" });

        expect(reporter.metas[0].error).toBe(error);
        expect(reporter.metas[0].context).toStrictEqual([{ requestId: "abc" }]);
    });
});
