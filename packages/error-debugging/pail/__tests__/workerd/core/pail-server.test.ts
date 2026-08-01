import { stderr, stdout } from "node:process";
import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { PailServer } from "../../../src/pail.server";
import writeStream from "../../../src/utils/write-stream";
import { createMemoryStream, MetaCaptureReporter, StreamCaptureReporter } from "./helpers";

describe("pailServer in workerd", () => {
    it("resolves node:process std streams to writable objects", () => {
        expect.assertions(4);

        // workerd's `nodejs_compat` shim exposes stdout/stderr as real Writables that
        // forward to the console. They are never TTYs, so anything gated on `isTTY`
        // has to degrade instead of assuming a terminal.
        expect(stdout.write).toBeTypeOf("function");
        expect(stderr.write).toBeTypeOf("function");
        expect(stdout instanceof Writable).toBe(true);
        expect(stdout.isTTY).toBeUndefined();
    });

    it("routes informational output to stdout and high-severity output to stderr", () => {
        expect.assertions(2);

        const out = createMemoryStream();
        const error = createMemoryStream();

        const logger = new PailServer({
            reporters: [new StreamCaptureReporter()],
            stderr: error.stream,
            stdout: out.stream,
        });

        logger.info("info message");
        logger.warn("warning message");
        logger.error("error message");

        expect(out.chunks).toStrictEqual(["info message"]);
        expect(error.chunks).toStrictEqual(["warning message", "error message"]);
    });

    it("writes through the node:process stdout stream", () => {
        expect.assertions(1);

        const spy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        try {
            const logger = new PailServer({ reporters: [new StreamCaptureReporter()], stderr, stdout });

            logger.info("straight to workerd stdout");

            expect(spy.mock.calls.map((call) => String(call[0]))).toStrictEqual(["straight to workerd stdout"]);
        } finally {
            spy.mockRestore();
        }
    });

    it("clear() writes the terminal reset sequence to both streams", () => {
        expect.assertions(3);

        const out = createMemoryStream();
        const error = createMemoryStream();

        const logger = new PailServer({ stderr: error.stream, stdout: out.stream });

        logger.clear();

        expect(out.chunks).toHaveLength(1);
        expect(error.chunks).toHaveLength(1);
        // The reset sequence is a plain ANSI escape string — nothing terminal-specific
        // is probed, so it stays writable on a non-TTY workerd stream.
        expect(out.chunks[0]).toContain("\u001B");
    });

    it("wrapStd() redirects raw stream writes through the logger and restoreStd() undoes it", () => {
        expect.assertions(3);

        const out = createMemoryStream();
        const error = createMemoryStream();

        const logger = new PailServer({ reporters: [new StreamCaptureReporter()], stderr: error.stream, stdout: out.stream });

        logger.wrapStd();
        out.stream.write("through the logger");

        expect(out.chunks).toStrictEqual(["through the logger"]);

        logger.restoreStd();
        out.stream.write("direct write");

        expect(out.chunks).toStrictEqual(["through the logger", "direct write"]);
        expect((out.stream as unknown as Record<string, unknown>).__write).toBeUndefined();
    });

    it("creates an interactive manager even though workerd streams are not TTYs", () => {
        expect.assertions(2);

        const out = createMemoryStream();
        const error = createMemoryStream();

        const logger = new PailServer({
            interactive: true,
            reporters: [new StreamCaptureReporter()],
            stderr: error.stream,
            stdout: out.stream,
        });

        expect(logger.getInteractiveManager()).toBeDefined();

        // Interactive rendering must fall back to a plain write when there is no TTY.
        logger.info("interactive fallback");

        expect(out.chunks).toStrictEqual(["interactive fallback"]);
    });

    it("child() inherits the parent streams", () => {
        expect.assertions(2);

        const out = createMemoryStream();
        const error = createMemoryStream();

        const parent = new PailServer({ reporters: [new StreamCaptureReporter()], stderr: error.stream, stdout: out.stream });
        const child = parent.child({ scope: ["child"] });

        child.info("from the child");

        expect(out.chunks).toStrictEqual(["from the child"]);

        const other = createMemoryStream();
        const overridden = parent.child({ stdout: other.stream });

        overridden.info("overridden stream");

        expect(other.chunks).toStrictEqual(["overridden stream"]);
    });

    describe("when the runtime provides no std streams", () => {
        // `node:process` does not expose `stdout`/`stderr` on every edge runtime — older
        // workerd compatibility dates and `nodejs_compat`-less deployments hand
        // `createPail()` a pair of `undefined` streams. The logger has to degrade instead
        // of throwing on the first write.
        const missing = undefined as unknown as NodeJS.WriteStream;

        it("keeps the processing pipeline alive and drops stream writes", () => {
            expect.assertions(2);

            const reporter = new MetaCaptureReporter();
            const logger = new PailServer({ reporters: [reporter, new StreamCaptureReporter()], stderr: missing, stdout: missing });

            logger.info("still processed");
            logger.error("still processed too");

            expect(reporter.messages).toStrictEqual(["still processed", "still processed too"]);
            expect(writeStream("dropped", missing)).toBe(false);
        });

        it("degrades clear(), wrapStd() and raw() to no-ops", () => {
            expect.assertions(3);

            const logger = new PailServer({ reporters: [], stderr: missing, stdout: missing });

            expect(() => {
                logger.clear();
            }).not.toThrow();
            expect(() => {
                logger.wrapStd();
                logger.restoreStd();
            }).not.toThrow();
            expect(() => {
                logger.raw("raw payload");
            }).not.toThrow();
        });

        it("stays non-interactive because the interactive hooks need real streams", () => {
            expect.assertions(1);

            const logger = new PailServer({ interactive: true, reporters: [], stderr: missing, stdout: missing });

            expect(logger.getInteractiveManager()).toBeUndefined();
        });
    });

    it("scope() nests scopes without mutating the receiver", () => {
        expect.assertions(2);

        const out = createMemoryStream();
        const error = createMemoryStream();
        const scopes: (string[] | undefined)[] = [];

        const parent = new PailServer({
            reporters: [{ log: (meta) => scopes.push(meta.scope) }],
            stderr: error.stream,
            stdout: out.stream,
        });

        const outer = parent.scope("outer");
        const inner = outer.scope("inner");

        outer.info("a");
        inner.info("b");
        parent.info("c");

        expect(scopes).toStrictEqual([["outer"], ["outer", "inner"], []]);
        expect(out.chunks).toStrictEqual([]);
    });
});
