import MessageFormatterProcessor from "@visulima/pail/processor/message-formatter";
// eslint-disable-next-line import/no-extraneous-dependencies
import { bench, describe } from "vitest";

/**
 * Benchmarks the cached-formatter optimization in MessageFormatterProcessor.
 *
 * The optimized path builds the formatter once per processor instance and reuses
 * it on every process() call. The "previous" approach effectively rebuilt the
 * formatter for every log line — emulated here by creating a fresh processor per
 * call so its formatter is built on the first (and only) process() invocation.
 */

const formatters = {
    // Custom formatter tokens must be a single character (consumed as `%u`).
    u: (value: unknown) => String((value as { id: number }).id).padStart(4, "0"),
};

const stringify = (value: unknown): string => JSON.stringify(value);

const makeMeta = () =>
    ({
        badge: undefined,
        context: [{ id: 123 }, "session-42"],
        date: new Date(),
        error: undefined,
        groups: [],
        label: undefined,
        message: "User %u logged in with value %s",
        prefix: undefined,
        scope: undefined,
        suffix: undefined,
        traceError: undefined,
        type: { level: "informational", name: "info" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

describe("MessageFormatterProcessor cached formatter vs rebuild-per-call", () => {
    const sharedProcessor = new MessageFormatterProcessor({ formatters });

    sharedProcessor.setStringify(stringify as typeof JSON.stringify);

    bench("optimized: cached formatter (reused processor instance)", () => {
        sharedProcessor.process(makeMeta());
    });

    bench("previous: rebuild formatter on every call (fresh processor)", () => {
        const processor = new MessageFormatterProcessor({ formatters });

        processor.setStringify(stringify as typeof JSON.stringify);
        processor.process(makeMeta());
    });
});
