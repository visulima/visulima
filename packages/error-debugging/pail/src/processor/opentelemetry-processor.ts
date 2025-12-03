import { context, isSpanContextValid, trace } from "@opentelemetry/api";

import type { Meta, Processor } from "../types";

/**
 * Configuration options for the OpenTelemetry processor.
 */
export interface OpenTelemetryProcessorOptions {
    /**
     * Field name for the span ID. Defaults to 'span_id'
     */
    spanIdFieldName?: string;

    /**
     * If specified, all trace fields will be nested under this key
     */
    traceFieldName?: string;

    /**
     * Field name for the trace flags. Defaults to 'trace_flags'
     */
    traceFlagsFieldName?: string;

    /**
     * Field name for the trace ID. Defaults to 'trace_id'
     */
    traceIdFieldName?: string;
}

/**
 * OpenTelemetry Processor.
 *
 * A processor that adds OpenTelemetry trace context to log metadata.
 * Extracts trace ID, span ID, and trace flags from the active OpenTelemetry span
 * and adds them to the log context for distributed tracing correlation.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 * import { OpenTelemetryProcessor } from "@visulima/pail/processor/opentelemetry";
 *
 * const logger = createPail({
 *   processors: [new OpenTelemetryProcessor()]
 * });
 *
 * logger.info("Processing request");
 * // Context includes: { trace_id: "...", span_id: "...", trace_flags: "01" }
 * ```
 * @example
 * ```typescript
 * // With custom field names
 * const logger = createPail({
 *   processors: [new OpenTelemetryProcessor({
 *     traceFieldName: "trace",
 *     traceIdFieldName: "traceId",
 *     spanIdFieldName: "spanId"
 *   })]
 * });
 * ```
 */
export class OpenTelemetryProcessor<L extends string = string> implements Processor<L> {
    /** Field name for trace ID */
    readonly #traceIdField: string;

    /** Field name for span ID */
    readonly #spanIdField: string;

    /** Field name for trace flags */
    readonly #traceFlagsField: string;

    /** Optional field name to nest all trace fields under */
    readonly #traceFieldName: string | undefined;

    /**
     * Creates a new OpenTelemetryProcessor instance.
     * @param options Configuration options for field names and nesting
     */
    public constructor(options: OpenTelemetryProcessorOptions = {}) {
        this.#traceIdField = options.traceIdFieldName || "trace_id";
        this.#spanIdField = options.spanIdFieldName || "span_id";
        this.#traceFlagsField = options.traceFlagsFieldName || "trace_flags";
        this.#traceFieldName = options.traceFieldName;
    }

    /**
     * Processes log metadata to add OpenTelemetry trace context.
     *
     * Extracts trace information from the active OpenTelemetry span and adds it
     * to the log context. If no valid span is found, the metadata is returned unchanged.
     * @param meta The log metadata to process
     * @returns The processed metadata with trace context added
     */
    public process(meta: Meta<L>): Meta<L> {
        const span = trace.getSpan(context.active());

        if (!span) {
            return meta;
        }

        const spanContext = span.spanContext();

        if (!isSpanContextValid(spanContext)) {
            return meta;
        }

        const fields = {
            [this.#spanIdField]: spanContext.spanId,
            [this.#traceFlagsField]: `0${spanContext.traceFlags.toString(16)}`,
            [this.#traceIdField]: spanContext.traceId,
        };

        const traceData = this.#traceFieldName
            ? {
                [this.#traceFieldName]: fields,
            }
            : fields;

        // eslint-disable-next-line no-param-reassign
        meta.context = [...meta.context || [], traceData];

        return meta;
    }
}
