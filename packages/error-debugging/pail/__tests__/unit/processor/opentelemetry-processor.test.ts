import { isSpanContextValid, trace } from "@opentelemetry/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpenTelemetryProcessor } from "../../../src/processor/opentelemetry-processor";
import type { Meta } from "../../../src/types";

// Mock OpenTelemetry API
vi.mock(import("@opentelemetry/api"), () => {
    return {
        context: {
            active: vi.fn(() => {
                return {};
            }),
        },
        isSpanContextValid: vi.fn(() => true),
        trace: {
            getSpan: vi.fn(),
        },
    };
});

describe(OpenTelemetryProcessor, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should add trace context to meta.context when span is available", () => {
        expect.assertions(1);

        // Setup mock to return valid span
        const mockSpan = {
            spanContext: () => {
                return {
                    spanId: "00f067aa0ba902b7",
                    traceFlags: 1,
                    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
                };
            },
        };

        vi.mocked(trace.getSpan).mockReturnValue(mockSpan as any);
        vi.mocked(isSpanContextValid).mockReturnValue(true);

        const processor = new OpenTelemetryProcessor();
        const meta = { context: [] } as Meta<string>;
        const result = processor.process(meta);

        expect(result.context).toStrictEqual([
            {
                span_id: "00f067aa0ba902b7",
                trace_flags: "01",
                trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
            },
        ]);
    });

    it("should use custom field names when provided", () => {
        expect.assertions(1);

        const mockSpan = {
            spanContext: () => {
                return {
                    spanId: "00f067aa0ba902b7",
                    traceFlags: 1,
                    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
                };
            },
        };

        vi.mocked(trace.getSpan).mockReturnValue(mockSpan as any);
        vi.mocked(isSpanContextValid).mockReturnValue(true);

        const processor = new OpenTelemetryProcessor({
            spanIdFieldName: "spanId",
            traceFlagsFieldName: "flags",
            traceIdFieldName: "traceId",
        });
        const meta = { context: [] } as Meta<string>;
        const result = processor.process(meta);

        expect(result.context).toStrictEqual([
            {
                flags: "01",
                spanId: "00f067aa0ba902b7",
                traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
            },
        ]);
    });

    it("should nest trace fields under traceFieldName when provided", () => {
        expect.assertions(1);

        const mockSpan = {
            spanContext: () => {
                return {
                    spanId: "00f067aa0ba902b7",
                    traceFlags: 1,
                    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
                };
            },
        };

        vi.mocked(trace.getSpan).mockReturnValue(mockSpan as any);
        vi.mocked(isSpanContextValid).mockReturnValue(true);

        const processor = new OpenTelemetryProcessor({
            traceFieldName: "trace",
        });
        const meta = { context: [] } as Meta<string>;
        const result = processor.process(meta);

        expect(result.context).toStrictEqual([
            {
                trace: {
                    span_id: "00f067aa0ba902b7",
                    trace_flags: "01",
                    trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
                },
            },
        ]);
    });

    it("should preserve existing context when adding trace context", () => {
        expect.assertions(1);

        const mockSpan = {
            spanContext: () => {
                return {
                    spanId: "00f067aa0ba902b7",
                    traceFlags: 1,
                    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
                };
            },
        };

        vi.mocked(trace.getSpan).mockReturnValue(mockSpan as any);
        vi.mocked(isSpanContextValid).mockReturnValue(true);

        const processor = new OpenTelemetryProcessor();
        const meta = { context: [{ userId: "123" }] } as Meta<string>;
        const result = processor.process(meta);

        expect(result.context).toStrictEqual([
            { userId: "123" },
            {
                span_id: "00f067aa0ba902b7",
                trace_flags: "01",
                trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
            },
        ]);
    });

    it("should return meta unchanged when no span is available", () => {
        expect.assertions(1);

        vi.mocked(trace.getSpan).mockReturnValue(undefined);

        const processor = new OpenTelemetryProcessor();
        const meta = { context: [] } as Meta<string>;
        const result = processor.process(meta);

        expect(result).toBe(meta);
    });

    it("should return meta unchanged when span context is invalid", () => {
        expect.assertions(1);

        const mockSpan = {
            spanContext: () => {
                return {
                    spanId: "invalid",
                    traceFlags: 0,
                    traceId: "invalid",
                };
            },
        };

        vi.mocked(trace.getSpan).mockReturnValue(mockSpan as any);
        vi.mocked(isSpanContextValid).mockReturnValue(false);

        const processor = new OpenTelemetryProcessor();
        const meta = { context: [] } as Meta<string>;
        const result = processor.process(meta);

        expect(result).toBe(meta);
    });

    it("should handle undefined context", () => {
        expect.assertions(1);

        const mockSpan = {
            spanContext: () => {
                return {
                    spanId: "00f067aa0ba902b7",
                    traceFlags: 1,
                    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
                };
            },
        };

        vi.mocked(trace.getSpan).mockReturnValue(mockSpan as any);
        vi.mocked(isSpanContextValid).mockReturnValue(true);

        const processor = new OpenTelemetryProcessor();
        const meta = { context: undefined } as Meta<string>;
        const result = processor.process(meta);

        expect(result.context).toStrictEqual([
            {
                span_id: "00f067aa0ba902b7",
                trace_flags: "01",
                trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
            },
        ]);
    });
});
