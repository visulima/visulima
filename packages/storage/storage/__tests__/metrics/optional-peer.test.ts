import type { Meter } from "@opentelemetry/api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenTelemetryMetrics } from "../../src/metrics";

describe("metrics entry points", () => {
    afterEach(() => {
        vi.doUnmock("@opentelemetry/api");
        vi.resetModules();
    });

    it("imports the package root without the optional @opentelemetry/api peer", async () => {
        expect.assertions(2);

        vi.resetModules();
        vi.doMock(import("@opentelemetry/api"), () => {
            throw new Error("Cannot find package '@opentelemetry/api'");
        });

        const root = await import("../../src/index");

        expect(root.NoOpMetrics).toBeDefined();
        expect("OpenTelemetryMetrics" in root).toBe(false);
    });

    it("records gauges as absolute values instead of accumulating them", () => {
        expect.assertions(2);

        const record = vi.fn();
        const meter = {
            createGauge: vi.fn(() => {
                return { record };
            }),
        } as unknown as Meter;
        const metrics = new OpenTelemetryMetrics(meter);

        metrics.gauge("queue.depth", 5);
        metrics.gauge("queue.depth", 3, { queue: "a" });

        expect(record).toHaveBeenNthCalledWith(1, 5, undefined);
        expect(record).toHaveBeenNthCalledWith(2, 3, { queue: "a" });
    });
});
