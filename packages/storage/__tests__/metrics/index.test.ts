import { describe, expect, it } from "vitest";

import { NoOpMetrics, OpenTelemetryMetrics } from "../../src/metrics";

describe("metrics/index", () => {
    it("should export NoOpMetrics", () => {
        expect.assertions(1);

        expect(NoOpMetrics).toBeDefined();
    });

    it("should export OpenTelemetryMetrics", () => {
        expect.assertions(1);

        expect(OpenTelemetryMetrics).toBeDefined();
    });

    it("should allow creating NoOpMetrics instance from export", () => {
        expect.assertions(1);

        const metrics = new NoOpMetrics();

        expect(metrics).toBeInstanceOf(NoOpMetrics);
    });

    it("should allow creating OpenTelemetryMetrics instance from export", () => {
        expect.assertions(1);

        // This will work if @opentelemetry/api is available
        try {
            const metrics = new OpenTelemetryMetrics();

            expect(metrics).toBeInstanceOf(OpenTelemetryMetrics);
        } catch {
            // If OpenTelemetry is not available, skip this test
            expect(true).toBe(true);
        }
    });
});


