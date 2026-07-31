import { describe, expect, it } from "vitest";

import JsonReporter from "../../../src/reporter/json/json-reporter.server";
import { PrettyReporter } from "../../../src/reporter/pretty/pretty-reporter.server";
import RawReporter from "../../../src/reporter/raw/raw-reporter.server";
import { SimpleReporter } from "../../../src/reporter/simple/simple-reporter.server";
import type { ReadonlyMeta } from "../../../src/types";

const meta = (overrides: Record<string, unknown> = {}): ReadonlyMeta<never> =>
    ({
        badge: undefined,
        context: [],
        date: new Date(0),
        error: undefined,
        file: undefined,
        groups: [],
        label: "info",
        message: "Test message",
        prefix: undefined,
        scope: undefined,
        suffix: undefined,
        traceError: undefined,
        type: { level: "informational", name: "info" },
        ...overrides,
    }) as unknown as ReadonlyMeta<never>;

/** Minimal stand-in for `NodeJS.WriteStream` that records everything written to it. */
const createFakeStream = (): { lines: string[]; stream: NodeJS.WriteStream } => {
    const lines: string[] = [];

    const stream = {
        isTTY: false,
        on: () => stream,
        write: (chunk: string): boolean => {
            lines.push(chunk);

            return true;
        },
    };

    return { lines, stream: stream as unknown as NodeJS.WriteStream };
};

describe("stdout/stderr reporters in workerd", () => {
    describe(JsonReporter, () => {
        it("constructs against the workerd process streams without throwing", () => {
            expect.assertions(1);

            expect(() => new JsonReporter()).not.toThrow();
        });

        it("writes a JSON line to the injected stdout stream", () => {
            expect.assertions(2);

            const out = createFakeStream();
            const error = createFakeStream();
            const reporter = new JsonReporter();

            reporter.setStringify(JSON.stringify as never);
            reporter.setStdout(out.stream);
            reporter.setStderr(error.stream);
            reporter.log(meta());

            expect(error.lines).toHaveLength(0);
            expect(JSON.parse(out.lines[0])).toStrictEqual(expect.objectContaining({ message: "Test message" }));
        });

        it("routes error-level entries to stderr", () => {
            expect.assertions(2);

            const out = createFakeStream();
            const error = createFakeStream();
            const reporter = new JsonReporter();

            reporter.setStringify(JSON.stringify as never);
            reporter.setStdout(out.stream);
            reporter.setStderr(error.stream);
            reporter.log(meta({ type: { level: "error", name: "error" } }));

            expect(out.lines).toHaveLength(0);
            expect(error.lines).toHaveLength(1);
        });

        it("writes to the real workerd process.stdout without throwing", () => {
            expect.assertions(1);

            const reporter = new JsonReporter();

            reporter.setStringify(JSON.stringify as never);

            expect(() => { reporter.log(meta()); }).not.toThrow();
        });
    });

    describe(RawReporter, () => {
        it("writes the raw message to the injected stream", () => {
            expect.assertions(1);

            const out = createFakeStream();
            const reporter = new RawReporter();

            reporter.setStdout(out.stream);
            reporter.setStderr(createFakeStream().stream);
            reporter.log(meta());

            expect(out.lines[0]).toBe("Test message");
        });

        it("writes to the real workerd process.stdout without throwing", () => {
            expect.assertions(1);

            const reporter = new RawReporter();

            expect(() => { reporter.log(meta()); }).not.toThrow();
        });
    });

    describe(SimpleReporter, () => {
        it("constructs and formats without a TTY", () => {
            expect.assertions(2);

            const out = createFakeStream();
            const reporter = new SimpleReporter();

            reporter.setStdout(out.stream);
            reporter.setStderr(createFakeStream().stream);
            reporter.log(meta());

            expect(out.lines).toHaveLength(1);
            expect(out.lines[0]).toContain("Test message");
        });

        it("writes to the real workerd process.stdout without throwing", () => {
            expect.assertions(1);

            const reporter = new SimpleReporter();

            expect(() => { reporter.log(meta()); }).not.toThrow();
        });
    });

    describe(PrettyReporter, () => {
        it("constructs and formats without a TTY", () => {
            expect.assertions(2);

            const out = createFakeStream();
            const reporter = new PrettyReporter();

            reporter.setStdout(out.stream);
            reporter.setStderr(createFakeStream().stream);
            reporter.log(meta());

            expect(out.lines).toHaveLength(1);
            expect(out.lines[0]).toContain("Test message");
        });

        it("routes error-level entries to stderr", () => {
            expect.assertions(2);

            const out = createFakeStream();
            const error = createFakeStream();
            const reporter = new PrettyReporter();

            reporter.setStdout(out.stream);
            reporter.setStderr(error.stream);
            reporter.log(meta({ type: { level: "error", name: "error" } }));

            expect(out.lines).toHaveLength(0);
            expect(error.lines).toHaveLength(1);
        });

        it("writes to the real workerd process.stdout without throwing", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();

            expect(() => { reporter.log(meta()); }).not.toThrow();
        });
    });
});
