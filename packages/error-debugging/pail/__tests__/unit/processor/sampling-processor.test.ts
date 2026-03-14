import { describe, expect, it, vi } from "vitest";

import SamplingProcessor from "../../../src/processor/sampling-processor";
import type { Meta } from "../../../src/types";

const createMeta = (level: string, overrides: Partial<Meta<string>> = {}): Meta<string> =>
    ({
        badge: undefined,
        context: undefined,
        date: new Date(),
        error: undefined,
        groups: [],
        label: undefined,
        message: "test message",
        prefix: undefined,
        scope: undefined,
        suffix: undefined,
        traceError: undefined,
        type: { level, name: level },
        ...overrides,
    }) as Meta<string>;

describe("samplingProcessor", () => {
    describe("head sampling", () => {
        it("should keep all logs when no head sampling is configured", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor();
            const meta = createMeta("informational");
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBeUndefined();
        });

        it("should drop all logs when rate is 0", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor({
                head: { debug: 0 },
            });
            const meta = createMeta("debug");
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBe(true);
        });

        it("should keep all logs when rate is 100", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor({
                head: { error: 100 },
            });
            const meta = createMeta("error");
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBeUndefined();
        });

        it("should keep logs for levels not specified in head config", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor({
                head: { debug: 0 },
            });
            const meta = createMeta("error");
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBeUndefined();
        });

        it("should sample logs at specified rate", () => {
            expect.assertions(2);

            const processor = new SamplingProcessor({
                head: { informational: 50 },
            });

            let kept = 0;
            const iterations = 10_000;

            for (let index = 0; index < iterations; index += 1) {
                const meta = createMeta("informational");
                const result = processor.process(meta);

                if (!(result as Meta<string> & { dropped?: boolean }).dropped) {
                    kept += 1;
                }
            }

            // With 50% sampling rate and 10000 iterations, we should be within ~10% tolerance
            const keptRatio = kept / iterations;

            expect(keptRatio).toBeGreaterThan(0.4);
            expect(keptRatio).toBeLessThan(0.6);
        });

        it("should drop all logs when rate is negative", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor({
                head: { debug: -10 },
            });
            const meta = createMeta("debug");
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBe(true);
        });

        it("should keep all logs when rate exceeds 100", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor({
                head: { debug: 200 },
            });
            const meta = createMeta("debug");
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBeUndefined();
        });
    });

    describe("tail sampling", () => {
        it("should force-keep logs when tail condition returns true", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor({
                head: { informational: 0 }, // Drop all info logs
                tail: [(meta) => meta.error !== undefined], // But keep errors
            });

            const meta = createMeta("informational", { error: new Error("test") });
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBeUndefined();
        });

        it("should not force-keep when no tail conditions match", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor({
                head: { informational: 0 },
                tail: [(meta) => meta.error !== undefined],
            });

            const meta = createMeta("informational");
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBe(true);
        });

        it("should support multiple tail conditions", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor({
                head: { informational: 0 },
                tail: [
                    () => false, // First condition doesn't match
                    (meta) => meta.scope?.includes("payment") ?? false, // Second matches
                ],
            });

            const meta = createMeta("informational", { scope: ["payment"] });
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBeUndefined();
        });

        it("should not apply tail sampling when head sampling keeps the log", () => {
            expect.assertions(1);

            const tailCondition = vi.fn(() => true);
            const processor = new SamplingProcessor({
                head: { informational: 100 }, // Keep all
                tail: [tailCondition],
            });

            const meta = createMeta("informational");

            processor.process(meta);

            expect(tailCondition).not.toHaveBeenCalled();
        });
    });

    describe("combined sampling", () => {
        it("should work with different rates per level", () => {
            expect.assertions(2);

            const processor = new SamplingProcessor({
                head: {
                    debug: 0,
                    error: 100,
                },
            });

            const debugMeta = createMeta("debug");
            const debugResult = processor.process(debugMeta);

            expect((debugResult as Meta<string> & { dropped?: boolean }).dropped).toBe(true);

            const errorMeta = createMeta("error");
            const errorResult = processor.process(errorMeta);

            expect((errorResult as Meta<string> & { dropped?: boolean }).dropped).toBeUndefined();
        });

        it("should default to keeping everything with empty options", () => {
            expect.assertions(1);

            const processor = new SamplingProcessor({});
            const meta = createMeta("debug");
            const result = processor.process(meta);

            expect((result as Meta<string> & { dropped?: boolean }).dropped).toBeUndefined();
        });
    });
});
