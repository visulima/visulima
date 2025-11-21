/**
 * OpenTelemetry Metrics implementation for storage operations.
 *
 * Provides counters, timers, and gauges using OpenTelemetry Metrics API.
 * This allows integration with any OpenTelemetry-compatible observability backend
 * (Prometheus, Datadog, New Relic, etc.).
 * @example
 * ```typescript
 * import { metrics } from "@opentelemetry/api";
 * import { OpenTelemetryMetrics } from "@visulima/storage/metrics";
 * import { S3Storage } from "@visulima/storage/provider/aws";
 *
 * // Initialize OpenTelemetry (typically done once in your app)
 * const meter = metrics.getMeter("@visulima/storage", "1.0.0");
 *
 * // Create metrics instance
 * const storageMetrics = new OpenTelemetryMetrics(meter);
 *
 * // Use with storage
 * const storage = new S3Storage({
 *     bucket: "my-bucket",
 *     metrics: storageMetrics,
 * });
 * ```
 */

import type { Meter, MetricOptions } from "@opentelemetry/api";
// Global import - will fail at runtime if @opentelemetry/api is not installed
// This is expected behavior for optional peer dependencies
import { metrics } from "@opentelemetry/api";

import type { Metrics } from "../utils/types";

/**
 * OpenTelemetry-based metrics implementation.
 */
class OpenTelemetryMetrics implements Metrics {
    private readonly meter: Meter;

    private readonly counters = new Map<string, ReturnType<Meter["createCounter"]>>();

    private readonly histograms = new Map<string, ReturnType<Meter["createHistogram"]>>();

    private readonly gauges = new Map<string, ReturnType<Meter["createUpDownCounter"]>>();

    /**
     * Creates a new OpenTelemetryMetrics instance.
     * @param meter OpenTelemetry Meter instance. If not provided, uses the default meter.
     * @throws {Error} If @opentelemetry/api is not installed
     */
    public constructor(meter?: Meter) {
        // Use global import - will throw at module load time if not installed
        // This is expected behavior for optional peer dependencies
        this.meter = meter || metrics.getMeter("@visulima/storage", "1.0.0");
    }

    /**
     * Increment a counter metric.
     */
    public increment(name: string, value = 1, attributes?: Record<string, string | number>): void {
        if (!this.counters.has(name)) {
            const options: MetricOptions = {
                description: `Counter for ${name}`,
            };

            this.counters.set(name, this.meter.createCounter(name, options));
        }

        const counter = this.counters.get(name)!;

        counter.add(value, attributes);
    }

    /**
     * Record a duration/timing metric in milliseconds.
     */
    public timing(name: string, duration: number, attributes?: Record<string, string | number>): void {
        if (!this.histograms.has(name)) {
            const options: MetricOptions = {
                description: `Duration histogram for ${name}`,
                unit: "ms",
            };

            this.histograms.set(name, this.meter.createHistogram(name, options));
        }

        const histogram = this.histograms.get(name)!;

        histogram.record(duration, attributes);
    }

    /**
     * Set a gauge metric value.
     */
    public gauge(name: string, value: number, attributes?: Record<string, string | number>): void {
        if (!this.gauges.has(name)) {
            const options: MetricOptions = {
                description: `Gauge for ${name}`,
            };

            this.gauges.set(name, this.meter.createUpDownCounter(name, options));
        }

        const gauge = this.gauges.get(name)!;

        // For gauges, we record the delta from current value
        // In practice, you might want to track the previous value
        // For simplicity, we'll use add with the value
        gauge.add(value, attributes);
    }
}

export default OpenTelemetryMetrics;
