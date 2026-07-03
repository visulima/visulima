// eslint-disable-next-line import/no-extraneous-dependencies
import { serializeError as serializeErrorBase } from "@visulima/error/error";

import type { PailBrowserImpl } from "./pail.browser";
import type { DefaultLogTypes, LoggerFunction } from "./types";

/**
 * Bounded recursion depth for serializing the cause chain. Wide events are a
 * single bounded log line, so the chain is capped to keep the line small while
 * still covering nested causes. The base serializer's circular guard protects
 * against cyclic chains regardless of this cap.
 */
const SERIALIZE_MAX_DEPTH = 8;

/**
 * A pail instance with dynamically generated log methods.
 * This is the minimal interface WideEvent needs from a pail logger.
 */
type PailLike<T extends string = string> = PailBrowserImpl<T> & Record<DefaultLogTypes | T, LoggerFunction>;

/**
 * Makes all properties in T optional recursively.
 */
type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

/**
 * Log levels ordered by severity (lowest to highest).
 * Used to determine automatic level escalation.
 */
const LEVEL_PRIORITY: Record<string, number> = {
    debug: 0,
    error: 3,
    info: 1,
    warn: 2,
};

/**
 * Maps WideEvent levels to pail's default log types.
 */
const LEVEL_TO_LOG_TYPE: Record<WideEventLevel, DefaultLogTypes> = {
    debug: "debug",
    error: "error",
    info: "info",
    warn: "warn",
};

/**
 * Deep merges source into target, returning a new object.
 * Arrays are replaced, not concatenated.
 */
const deepMerge = <T extends Record<string, unknown>>(target: T, source: DeepPartial<T>): T => {
    const result = { ...target };

    const keys = Object.keys(source) as (keyof T)[];

    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];

        const sourceValue = source[key];

        const targetValue = result[key];

        if (
            sourceValue !== null
            && typeof sourceValue === "object"
            && !Array.isArray(sourceValue)
            && targetValue !== null
            && typeof targetValue === "object"
            && !Array.isArray(targetValue)
        ) {
            result[key] = deepMerge(targetValue as Record<string, unknown>, sourceValue as DeepPartial<Record<string, unknown>>) as T[keyof T];
        } else {
            result[key] = sourceValue as T[keyof T];
        }
    }

    return result;
};

/**
 * Format a duration in milliseconds to a human-readable string.
 * Durations under 1000ms are shown as "Xms", otherwise as "X.XXs".
 */
const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${String(ms)}ms`;
    }

    return `${(ms / 1000).toFixed(2)}s`;
};

/**
 * Reshape one node of a `@visulima/error` serialized error (which always emits
 * `stack` and fans out every own-prop, `AggregateError.errors`, etc.) into
 * wide-event's deliberately shallow {@link SerializedError} shape: coalesce
 * `status`/`statusCode` into a single `status`, omit `stack` when absent, and
 * keep only `name`/`message`/`stack?`/`status?`/`data?`/`cause?`.
 *
 * The cause chain is driven off the original `Error` (not the serialized
 * output) so wide-event's `instanceof Error` gate is preserved: a non-Error
 * cause is dropped, while a cyclic cause surfaces as the base serializer's
 * "[Circular]" marker instead of overflowing the stack.
 */
const reshapeSerialized = (base: Record<string, unknown>, source: Error): SerializedError => {
    const serialized: SerializedError = {
        message: typeof base.message === "string" ? base.message : "",
        name: typeof base.name === "string" ? base.name : "Error",
    };

    // The base serializer always emits a `stack` key (even when undefined);
    // wide-event omits it entirely when the source error had no stack.
    if (base.stack) {
        serialized.stack = base.stack as string;
    }

    // Coalesce HTTP status: prefer `status`, fall back to `statusCode`. The raw
    // `statusCode` key is never emitted.
    if (base.status !== undefined) {
        serialized.status = base.status as number;
    } else if (base.statusCode !== undefined) {
        serialized.status = base.statusCode as number;
    }

    if (base.data !== undefined) {
        serialized.data = base.data;
    }

    // Only recurse Error causes (the original `instanceof Error` gate). The base
    // serializer already replaced a cyclic cause with "[Circular]"; surface that
    // marker rather than re-walking the cycle.
    if (source.cause instanceof Error) {
        const { cause } = base;

        if (cause === "[Circular]") {
            serialized.cause = "[Circular]" as unknown as SerializedError;
        } else if (cause !== null && typeof cause === "object") {
            serialized.cause = reshapeSerialized(cause as Record<string, unknown>, source.cause);
        }
    }

    return serialized;
};

/**
 * Serialize an Error into a plain object suitable for structured logging.
 * Extracts common HTTP error properties (status, statusCode) and recursively
 * serializes the cause chain.
 *
 * Thin wrapper around `@visulima/error`'s `serializeError` (the same serializer
 * used by pail's JSON reporter) that re-applies wide-event's HTTP-status
 * coalescing and shallow output shape. Routing through the shared serializer
 * also fixes the previous hand-rolled cause recursion's missing circular guard.
 */
const serializeError = (error: Error): SerializedError => reshapeSerialized(serializeErrorBase(error, { maxDepth: SERIALIZE_MAX_DEPTH }), error);

/**
 * Severity levels for wide events.
 */
export type WideEventLevel = "debug" | "error" | "info" | "warn";

/**
 * An entry in the request lifecycle log.
 */
export interface RequestLogEntry {
    /**
     * Additional structured context for this log entry.
     */
    context?: Record<string, unknown>;

    /**
     * Severity level of this entry.
     */
    level: WideEventLevel;

    /**
     * Human-readable message describing what happened.
     */
    message: string;

    /**
     * ISO 8601 timestamp of when this entry was recorded.
     */
    timestamp: string;
}

/**
 * Serialized error information included in the emitted wide event.
 */
export interface SerializedError {
    cause?: SerializedError;
    data?: unknown;
    message: string;
    name: string;
    stack?: string;
    status?: number;
}

/**
 * Options for finishing a wide event with HTTP context.
 */
export interface WideEventFinishOptions {
    /**
     * An error that occurred during the operation.
     * Will be serialized and included in the emitted event.
     */
    error?: Error;

    /**
     * HTTP response status code.
     */
    status?: number;
}

/**
 * Options for creating a WideEvent instance.
 * @template T - Custom logger type names
 */
export interface WideEventOptions<T extends string = string> {
    /**
     * Auto-emit the event when disposed via `Symbol.dispose`.
     * Works with TC39 Explicit Resource Management (`using`).
     * @default true
     */
    autoEmit?: boolean;

    /**
     * Event name identifying this wide event, e.g. "api.checkout", "worker.send-email".
     */
    name: string;

    /**
     * The pail logger instance to use for emission.
     */
    pail: PailLike<T>;

    /**
     * Service name for this event. Overrides any service name from pail's scope.
     */
    service?: string;

    /**
     * Base log type to use when emitting. Defaults to "info".
     * The actual type may be escalated based on logged warnings/errors.
     */
    type?: DefaultLogTypes | T;
}

/**
 * A wide event logger that accumulates context incrementally and emits
 * a single comprehensive log event through pail.
 *
 * Instead of scattering multiple log calls throughout an operation,
 * use `set()` to build up context as information becomes available,
 * then emit once at the end. Lifecycle methods (`info()`, `warn()`, `error()`,
 * `debug()`) record timestamped entries in a `requestLogs` array and
 * automatically escalate the event's severity level.
 *
 * Implements `Disposable` for use with TC39 Explicit Resource Management.
 * @template TData - Shape of the accumulated event data
 * @template T - Custom logger type names from the pail instance
 * @example
 * ```typescript
 * // Manual finish
 * const ev = createWideEvent({ pail: logger, name: "api.checkout" });
 * ev.set({ user: { id: 1 } });
 * ev.info("Validated cart");
 * ev.set({ cart: { items: 3, total: 9999 } });
 * ev.finish({ status: 200 });
 *
 * // Auto-emit with Explicit Resource Management
 * using ev = createWideEvent({ pail: logger, name: "api.checkout" });
 * ev.set({ user: { id: 1 } });
 * // emits automatically when scope exits
 *
 * // Typed data shape
 * interface CheckoutData {
 *   user: { id: number; plan: string };
 *   cart: { items: number; total: number };
 * }
 * const ev = createWideEvent<CheckoutData>({ pail: logger, name: "api.checkout" });
 * ev.set({ user: { id: 1, plan: "pro" } }); // fully typed
 * ```
 */
export class WideEvent<TData extends Record<string, unknown> = Record<string, unknown>, T extends string = string> implements Disposable {
    public readonly name: string;

    private readonly autoEmit: boolean;

    private data: TData;

    private emitted: boolean;

    private attachedError?: Error;

    private level: WideEventLevel;

    private readonly pail: PailLike<T>;

    private readonly requestLogs: RequestLogEntry[];

    private readonly service: string | undefined;

    private readonly startTime: number;

    private status: number | undefined;

    private readonly timestamp: string;

    // @ts-expect-error TS6133 -- preserved for future use (richer event categorization)
    private readonly _type: DefaultLogTypes | T;

    public constructor(options: WideEventOptions<T>) {
        this.name = options.name;
        this.pail = options.pail;
        this.data = {} as TData;
        this.startTime = performance.now();
        this.timestamp = new Date().toISOString();
        this.emitted = false;
        this.autoEmit = options.autoEmit ?? true;
        // eslint-disable-next-line no-underscore-dangle -- underscore marks "reserved, not yet consumed"
        this._type = options.type ?? "info";
        this.level = "info";
        this.requestLogs = [];
        this.service = options.service;
    }

    /**
     * Record a debug-level lifecycle log entry.
     * Does not escalate the event level.
     * @param message Description of what happened
     * @param context Optional structured context
     * @returns `this` for chaining
     */
    public debug(message: string, context?: Record<string, unknown>): this {
        return this.addLogEntry("debug", message, context);
    }

    /**
     * Emit the wide event through the pail logger. Can only be called once;
     * subsequent calls are no-ops.
     *
     * Automatically calculates duration, determines the log type based on
     * the highest severity level reached, and serializes any attached error.
     *
     * Prefer `finish()` for HTTP request contexts where you have a status code.
     * @param typeOverride Override the log type for this emission
     */
    public emit(typeOverride?: DefaultLogTypes | T): void {
        if (this.emitted) {
            return;
        }

        this.emitted = true;

        const durationMs = Math.round(performance.now() - this.startTime);
        const resolvedLevel = this.attachedError ? "error" : this.level;
        const type = typeOverride ?? LEVEL_TO_LOG_TYPE[resolvedLevel];

        const payload: Record<string, unknown> = {
            duration: formatDuration(durationMs),
            duration_ms: durationMs,
            event: this.name,
            timestamp: this.timestamp,
            ...this.data,
        };

        if (this.service) {
            payload.service = this.service;
        }

        if (this.status !== undefined) {
            payload.status = this.status;
        }

        if (this.attachedError) {
            payload.error = serializeError(this.attachedError);
        }

        if (this.requestLogs.length > 0) {
            payload.requestLogs = this.requestLogs;
        }

        const logFunction = this.pail[type] as LoggerFunction;

        logFunction({ message: payload });
    }

    /**
     * Record an error-level lifecycle log entry and attach the error.
     * Escalates the event level to "error".
     * @param message Description of what went wrong
     * @param error The error that occurred
     * @param context Optional structured context
     * @returns `this` for chaining
     */
    public error(message: string, error?: Error, context?: Record<string, unknown>): this {
        if (error) {
            this.attachedError = error;
        }

        return this.addLogEntry("error", message, context);
    }

    /**
     * Finish and emit the wide event with HTTP context.
     * Sets the response status and optional error before emitting.
     * @example
     * ```typescript
     * ev.finish({ status: 200 });
     * ev.finish({ status: 500, error: new Error("DB timeout") });
     * ```
     * @param options Status code and/or error
     */
    public finish(options?: WideEventFinishOptions): void {
        if (options?.status !== undefined) {
            this.status = options.status;
        }

        if (options?.error) {
            this.attachedError = options.error;
        }

        this.emit();
    }

    /**
     * Get a read-only snapshot of the accumulated data.
     */
    public getData(): Readonly<TData> {
        return this.data;
    }

    /**
     * Get the current severity level of the event.
     * The level auto-escalates as `warn()` or `error()` entries are added.
     */
    public getLevel(): WideEventLevel {
        return this.attachedError ? "error" : this.level;
    }

    /**
     * Get a read-only copy of the request lifecycle log entries.
     */
    public getRequestLogs(): ReadonlyArray<RequestLogEntry> {
        return this.requestLogs;
    }

    /**
     * Record an info-level lifecycle log entry.
     * Does not escalate the event level.
     * @param message Description of what happened
     * @param context Optional structured context
     * @returns `this` for chaining
     */
    public info(message: string, context?: Record<string, unknown>): this {
        return this.addLogEntry("info", message, context);
    }

    /**
     * Accumulate context into the wide event via deep merge.
     * Call as many times as needed throughout the operation.
     * @example
     * ```typescript
     * ev.set({ user: { id: 1 } });
     * ev.set({ user: { plan: "pro" } });
     * // data = { user: { id: 1, plan: "pro" } }
     * ```
     * @param data Partial data to merge into the event
     * @returns `this` for chaining
     */
    public set(data: DeepPartial<TData>): this {
        this.data = deepMerge(this.data, data);

        return this;
    }

    /**
     * Attach an error to the event. Automatically escalates the event
     * level to "error".
     * @param error The error to attach
     * @returns `this` for chaining
     */
    public setError(error: Error): this {
        this.attachedError = error;

        return this;
    }

    /**
     * Set the HTTP response status code.
     * @param status HTTP status code
     * @returns `this` for chaining
     */
    public setStatus(status: number): this {
        this.status = status;

        return this;
    }

    /**
     * Record a warn-level lifecycle log entry.
     * Escalates the event level to "warn" (unless already "error").
     * @param message Description of the warning
     * @param context Optional structured context
     * @returns `this` for chaining
     */
    public warn(message: string, context?: Record<string, unknown>): this {
        return this.addLogEntry("warn", message, context);
    }

    /**
     * Disposable implementation. Auto-emits the event if `autoEmit` is true
     * and the event hasn't been manually emitted yet.
     *
     * Enables usage with TC39 Explicit Resource Management:
     * ```typescript
     * using ev = createWideEvent({ pail: logger, name: "api.checkout" });
     * ev.set({ user: { id: 1 } });
     * // auto-emits here when scope exits
     * ```
     */
    public [Symbol.dispose](): void {
        if (this.autoEmit && !this.emitted) {
            this.emit();
        }
    }

    /**
     * Add an entry to the request lifecycle log and escalate level if needed.
     */
    private addLogEntry(level: WideEventLevel, message: string, context?: Record<string, unknown>): this {
        const entry: RequestLogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
        };

        if (context) {
            entry.context = context;
        }

        this.requestLogs.push(entry);
        this.escalateLevel(level);

        return this;
    }

    /**
     * Escalate the event level if the new level has higher severity.
     */
    private escalateLevel(level: WideEventLevel): void {
        if ((LEVEL_PRIORITY[level] ?? 0) > (LEVEL_PRIORITY[this.level] ?? 0)) {
            this.level = level;
        }
    }
}

/**
 * Create a wide event logger that accumulates context and emits a single
 * comprehensive log event through pail.
 * @template TData - Shape of the accumulated event data
 * @template T - Custom logger type names from the pail instance
 * @param options Configuration options
 * @returns A new WideEvent instance
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 * import { createWideEvent } from "@visulima/pail/wide-event";
 *
 * const logger = createPail();
 *
 * // In a request handler:
 * const ev = createWideEvent({ pail: logger, name: "api.checkout" });
 *
 * ev.set({ user: { id: 1, plan: "pro" } });
 * ev.info("Validated cart", { itemCount: 3 });
 * ev.set({ cart: { id: 42, items: 3, total: 9999 } });
 * ev.info("Payment processed");
 * ev.finish({ status: 200 });
 *
 * // Emits a single structured log:
 * // {
 * //   event: "api.checkout",
 * //   timestamp: "2025-01-24T10:23:45.612Z",
 * //   duration: "127ms",
 * //   duration_ms: 127,
 * //   status: 200,
 * //   user: { id: 1, plan: "pro" },
 * //   cart: { id: 42, items: 3, total: 9999 },
 * //   requestLogs: [
 * //     { level: "info", message: "Validated cart", timestamp: "...", context: { itemCount: 3 } },
 * //     { level: "info", message: "Payment processed", timestamp: "..." }
 * //   ]
 * // }
 * ```
 */
export const createWideEvent = <TData extends Record<string, unknown> = Record<string, unknown>, T extends string = string>(
    options: WideEventOptions<T>,
): WideEvent<TData, T> => new WideEvent<TData, T>(options);
