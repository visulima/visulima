import type { stringify } from "safe-stable-stringify";
// eslint-disable-next-line import/no-extraneous-dependencies
import { configure as stringifyConfigure } from "safe-stable-stringify";
import type { LiteralUnion, Primitive } from "type-fest";

import { EMPTY_SYMBOL, EXTENDED_RFC_5424_LOG_LEVELS, LOG_TYPES } from "./constants";
import RawReporter from "./reporter/raw/raw-reporter.browser";
import type {
    ConstructorOptions,
    DefaultLoggerTypes,
    DefaultLogTypes,
    ExtendedRfc5424LogLevels,
    LoggerConfiguration,
    LoggerFunction,
    LoggerTypesAwareReporter,
    LoggerTypesConfig,
    Message,
    Meta,
    Processor,
    Reporter,
    StringifyAwareProcessor,
    StringifyAwareReporter,
} from "./types";
import arrayify from "./utils/arrayify";
import getLongestLabel from "./utils/get-longest-label";
import mergeTypes from "./utils/merge-types";

const preventLoop = <T extends (this: ThisType<T>, ...args: Parameters<T>) => ReturnType<T>>(function_: T): (...args: Parameters<T>) => ReturnType<T> => {
    let doing = false;

    // eslint-disable-next-line func-names
    return function (...args: Parameters<T>): ReturnType<T> {
        if (doing) {
            return undefined as ReturnType<T>;
        }

        doing = true;

        try {
            // @ts-expect-error - this is the correct type
            const result = function_.apply(this, args);

            doing = false;

            return result as ReturnType<T>;
        } catch (error) {
            doing = false;
            throw error;
        }
    };
};

/**
 * Pail Browser Implementation.
 *
 * A comprehensive logging library for browser environments with support for
 * multiple log levels, custom types, processors, reporters, and advanced features
 * like throttling, scoping, timers, and counters.
 * @template T - Custom logger types (string union)
 * @template L - Log level types (string union)
 * @example
 * ```typescript
 * const logger = new PailBrowserImpl({
 *   logLevel: "debug",
 *   types: {
 *     http: { color: "blue", label: "HTTP", logLevel: "info" }
 *   },
 *   reporters: [new JsonReporter()]
 * });
 *
 * logger.info("Application started");
 * logger.http("GET /api/users 200");
 * logger.error("Something went wrong", error);
 * ```
 */
export class PailBrowserImpl<T extends string = string, L extends string = string> {
    protected timersMap: Map<string, number>;

    protected countMap: Map<string, number>;

    protected seqTimers: Set<string>;

    protected readonly lastLog: {
        count?: number;
        object?: Meta<L>;
        time?: Date;
        timeout?: ReturnType<typeof setTimeout>;
    };

    protected readonly logLevels: Record<string, number>;

    protected disabled: boolean;

    protected paused: boolean;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected messageQueue: { messageObject: any[]; raw: boolean; type: LiteralUnion<DefaultLogTypes, T> }[];

    protected scopeName: string[];

    protected readonly types: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;

    protected readonly longestLabel: string;

    protected readonly processors: Set<Processor<L>>;

    protected readonly generalLogLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>;

    protected reporters: Set<Reporter<L>>;

    protected readonly throttle: number;

    protected readonly throttleMin: number;

    protected readonly stringify: typeof stringify;

    protected groups: string[];

    protected readonly startTimerMessage: string;

    protected readonly endTimerMessage: string;

    protected rawReporter: Reporter<L>;

    /**
     * Creates a new Pail browser logger instance.
     *
     * Initializes the logger with the provided configuration options,
     * setting up reporters, processors, log levels, and other internal state.
     * @param options Configuration options for the logger
     */
    public constructor(options: ConstructorOptions<T, L>) {
        this.throttle = options.throttle ?? 1000;
        this.throttleMin = options.throttleMin ?? 5;

        this.stringify = stringifyConfigure({
            strict: true,
        });

        this.startTimerMessage = options.messages?.timerStart ?? "Initialized timer...";
        this.endTimerMessage = options.messages?.timerEnd ?? "Timer run for:";
        this.types = mergeTypes<L, T>(LOG_TYPES as DefaultLoggerTypes<L>, (options.types ?? {}) as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>);
        this.longestLabel = getLongestLabel<L, T>(this.types);

        this.logLevels = { ...EXTENDED_RFC_5424_LOG_LEVELS, ...options.logLevels };
        this.generalLogLevel = this.#normalizeLogLevel(options.logLevel);

        this.reporters = new Set();
        this.processors = new Set();

        this.disabled = options.disabled ?? false;
        this.paused = false;
        this.messageQueue = [];

        this.scopeName = arrayify(options.scope).filter(Boolean) as string[];

        this.timersMap = new Map<string, number>();
        this.countMap = new Map<string, number>();

        this.groups = [];

        this.seqTimers = new Set();

        // Track of last log
        this.lastLog = {};

        // Prevent infinite loop on logging
        this.logger = preventLoop(this.logger).bind(this);

        // eslint-disable-next-line no-restricted-syntax,guard-for-in
        for (const type in this.types) {
            // @ts-expect-error - dynamic property

            this[type] = this.logger.bind(this, type as T, false);
        }

        if (Array.isArray(options.reporters)) {
            this.registerReporters(options.reporters);
        }

        this.rawReporter = this.extendReporter(options.rawReporter ?? new RawReporter<L>());

        if (Array.isArray(options.processors)) {
            this.#registerProcessors(options.processors);
        }
    }

    /**
     * Wraps the global console methods to redirect them through the logger.
     *
     * This method replaces console methods (log, info, warn, error, etc.) with
     * calls to the corresponding logger methods. The original console methods
     * are backed up and can be restored using restoreConsole().
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.wrapConsole();
     *
     * console.log("This will go through the logger");
     * console.error("This too!");
     *
     * logger.restoreConsole(); // Restore original console methods
     * ```
     */
    public wrapConsole(): void {
        // eslint-disable-next-line guard-for-in,no-restricted-syntax
        for (const type in this.types) {
            // Backup original value
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!(console as any)[`__${type}`]) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (console as any)[`__${type}`] = (console as any)[type];
            }

            // Override
            // @TODO: Fix typings
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (console as any)[type] = (this as unknown as PailBrowserImpl<T, L>)[type as keyof PailBrowserImpl<T, L>];
        }
    }

    /**
     * Restores the original global console methods.
     *
     * This method restores the console methods that were backed up by wrapConsole().
     * After calling this, console methods will work as they did before wrapping.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.wrapConsole();
     *
     * // Console methods are now wrapped
     * logger.restoreConsole();
     * // Console methods are restored to original behavior
     * ```
     */
    public restoreConsole(): void {
        // eslint-disable-next-line no-restricted-syntax
        for (const type in this.types) {
            // Restore if backup is available
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((console as any)[`__${type}`]) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (console as any)[type] = (console as any)[`__${type}`];

                // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-dynamic-delete
                delete (console as any)[`__${type}`];
            }
        }
    }

    /**
     * Wraps uncaught exception and unhandled rejection handlers.
     *
     * This method sets up global error handlers that will log uncaught exceptions
     * and unhandled promise rejections through the logger. This is useful for
     * capturing and logging application crashes.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.wrapException();
     *
     * // Now uncaught errors will be logged
     * throw new Error("This will be logged");
     * ```
     */
    public wrapException(): void {
        if (typeof process !== "undefined") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            process.on("uncaughtException", (error: any) => {
                // @TODO: Fix typings
                // @ts-expect-error - dynamic property
                (this as unknown as PailBrowserImpl<T, L>).error(error);
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            process.on("unhandledRejection", (error: any) => {
                // @TODO: Fix typings
                // @ts-expect-error - dynamic property
                (this as unknown as PailBrowserImpl<T, L>).error(error);
            });
        }
    }

    /**
     * Disables all logging output.
     *
     * When disabled, all log calls will be silently ignored and no output
     * will be produced by any reporters. This can be useful for temporarily
     * suppressing log output in production or during testing.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.disable();
     * logger.info("This won't be logged"); // Silent
     * logger.enable();
     * logger.info("This will be logged"); // Output produced
     * ```
     */
    public disable(): void {
        this.disabled = true;
    }

    /**
     * Enables logging output.
     *
     * Re-enables logging after it has been disabled. All subsequent log calls
     * will produce output according to the configured reporters.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.disable();
     * logger.info("This won't be logged");
     * logger.enable(); // Re-enable logging
     * logger.info("This will be logged");
     * ```
     */
    public enable(): void {
        this.disabled = false;
    }

    /**
     * Checks if logging is currently enabled.
     *
     * Returns true if logging is enabled and false if it has been disabled.
     * @returns True if logging is enabled, false if disabled
     * @example
     * ```typescript
     * const logger = createPail();
     * console.log(logger.isEnabled()); // true
     * logger.disable();
     * console.log(logger.isEnabled()); // false
     * ```
     */
    public isEnabled(): boolean {
        return !this.disabled;
    }

    /**
     * Pauses logging and starts queuing messages.
     *
     * When paused, all log calls will be queued instead of being output immediately.
     * The queued messages will be processed when resume() is called. This is useful
     * for temporarily buffering log output during critical operations.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.pause();
     * logger.info("This will be queued"); // Queued, not output yet
     * logger.warn("This too"); // Also queued
     * logger.resume(); // Now both messages are output
     * ```
     */
    public pause(): void {
        this.paused = true;
    }

    /**
     * Resumes logging and flushes all queued messages.
     *
     * Processes all messages that were queued during the pause period and
     * resumes normal logging behavior. Messages are output in the order
     * they were originally called.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.pause();
     * logger.info("Message 1"); // Queued
     * logger.info("Message 2"); // Queued
     * logger.resume(); // Both messages are now output in order
     * logger.info("Message 3"); // Output immediately
     * ```
     */
    public resume(): void {
        this.paused = false;

        // Flush all queued messages
        const queue = this.messageQueue.splice(0);

        for (const { messageObject, raw, type } of queue) {
            this.logger(type, raw, ...messageObject);
        }
    }

    /**
     * Creates a scoped logger instance.
     *
     * Returns a new logger instance that inherits all configuration but adds
     * the specified scope names to all log messages. This is useful for
     * categorizing logs by component, module, or feature.
     * @template N - The new custom logger type names
     * @param name Scope names to apply to all log messages
     * @returns A new scoped logger instance
     * @throws {Error} If no scope name is provided
     * @example
     * ```typescript
     * const logger = createPail();
     * const scopedLogger = logger.scope("auth", "login");
     * scopedLogger.info("User logged in"); // Will include scope: ["auth", "login"]
     * ```
     */
    public scope<N extends string = T>(...name: string[]): PailBrowserType<N, L> {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        this.scopeName = name.flat();

        return this as unknown as PailBrowserType<N, L>;
    }

    /**
     * Removes the current scope from the logger.
     *
     * Clears all scope names that were set by previous scope() calls.
     * After calling this, log messages will no longer include scope information.
     * @example
     * ```typescript
     * const logger = createPail();
     * const scopedLogger = logger.scope("auth");
     * scopedLogger.info("Scoped message"); // Has scope
     * scopedLogger.unscope();
     * scopedLogger.info("Unscoped message"); // No scope
     * ```
     */
    public unscope(): void {
        this.scopeName = [];
    }

    /**
     * Starts a timer with the specified label.
     *
     * Records the current timestamp and associates it with the given label.
     * Multiple timers can be active simultaneously with different labels.
     * @param label The timer label (defaults to "default")
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.time("operation");
     * // ... some operation ...
     * logger.timeEnd("operation"); // Logs: "Timer run for: X ms"
     * ```
     */
    public time(label = "default"): void {
        if (this.seqTimers.has(label)) {
            this.logger("warn", false, {
                message: `Timer '${label}' already exists`,
                prefix: label,
            });
        } else {
            this.seqTimers.add(label);
            this.timersMap.set(label, Date.now());

            this.logger("start", false, {
                message: this.startTimerMessage,
                prefix: label,
            });
        }
    }

    /**
     * Logs the current elapsed time for a timer without stopping it.
     *
     * Calculates and logs the time elapsed since the timer was started,
     * but keeps the timer running. If no label is provided, uses the
     * most recently started timer.
     * @param label The timer label (uses last timer if not specified)
     * @param data Additional data to include in the log message
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.time("task");
     * // ... some work ...
     * logger.timeLog("task"); // Logs current elapsed time
     * // ... more work ...
     * logger.timeEnd("task"); // Logs final time and stops timer
     * ```
     */
    public timeLog(label?: string, ...data: unknown[]): void {
        if (!label && this.seqTimers.size > 0) {
            // eslint-disable-next-line no-param-reassign
            label = [...this.seqTimers].pop();
        }

        if (label && this.timersMap.has(label)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const span = Date.now() - this.timersMap.get(label)!;

            this.logger("info", false, {
                context: data,
                message: span < 1000 ? `${span} ms` : `${(span / 1000).toFixed(2)} s`,
                prefix: label,
            });
        } else {
            this.logger("warn", false, {
                context: data,
                message: "Timer not found",
                prefix: label,
            });
        }
    }

    /**
     * Stops a timer and logs the final elapsed time.
     *
     * Calculates the total time elapsed since the timer was started,
     * logs the result, and removes the timer. If no label is provided,
     * uses the most recently started timer.
     * @param label The timer label (uses last timer if not specified)
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.time("operation");
     * // ... perform operation ...
     * logger.timeEnd("operation"); // Logs: "Timer run for: X ms"
     * ```
     */
    public timeEnd(label?: string): void {
        if (!label && this.seqTimers.size > 0) {
            // eslint-disable-next-line no-param-reassign
            label = [...this.seqTimers].pop();
        }

        if (label && this.timersMap.has(label)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const span = Date.now() - this.timersMap.get(label)!;

            this.timersMap.delete(label);

            this.logger("stop", false, {
                message: `${this.endTimerMessage} ${span < 1000 ? `${span} ms` : `${(span / 1000).toFixed(2)} s`}`,
                prefix: label,
            });
        } else {
            this.logger("warn", false, {
                message: "Timer not found",
                prefix: label,
            });
        }
    }

    /**
     * Starts a log group with the specified label.
     *
     * Groups related log messages together. In browser environments,
     * this uses the native console.group() functionality. In other
     * environments, it tracks group nesting internally.
     * @param label The group label (defaults to "console.group")
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.group("Database Operations");
     * logger.info("Connecting to database");
     * logger.info("Running migration");
     * logger.groupEnd(); // End the group
     * ```
     */
    public group(label = "console.group"): void {
        if (globalThis.window === undefined) {
            this.groups.push(label);
        } else {
            // eslint-disable-next-line no-console
            console.group(label);
        }
    }

    /**
     * Ends the current log group.
     *
     * Closes the most recently opened log group. In browser environments,
     * this uses the native console.groupEnd() functionality.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.group("Processing");
     * logger.info("Step 1");
     * logger.info("Step 2");
     * logger.groupEnd(); // Closes the "Processing" group
     * ```
     */
    public groupEnd(): void {
        if (globalThis.window === undefined) {
            this.groups.pop();
        } else {
            // eslint-disable-next-line no-console
            console.groupEnd();
        }
    }

    /**
     * Increments and logs a counter with the specified label.
     *
     * Maintains an internal counter for each label and logs the current count
     * each time it's called. Useful for tracking how many times certain
     * code paths are executed.
     * @param label The counter label (defaults to "default")
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.count("requests"); // Logs: "requests: 1"
     * logger.count("requests"); // Logs: "requests: 2"
     * logger.count("errors");   // Logs: "errors: 1"
     * ```
     */
    public count(label = "default"): void {
        const current = this.countMap.get(label) ?? 0;

        this.countMap.set(label, current + 1);

        this.logger("log", false, {
            message: `${label}: ${current + 1}`,
            prefix: label,
        });
    }

    /**
     * Resets a counter to zero.
     *
     * Removes the counter with the specified label, effectively resetting
     * it to zero. If the counter doesn't exist, logs a warning.
     * @param label The counter label to reset (defaults to "default")
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.count("requests"); // Logs: "requests: 1"
     * logger.countReset("requests"); // Resets counter
     * logger.count("requests"); // Logs: "requests: 1" (starts over)
     * ```
     */
    public countReset(label = "default"): void {
        if (this.countMap.has(label)) {
            this.countMap.delete(label);
        } else {
            this.logger("warn", false, {
                message: `Count for ${label} does not exist`,
                prefix: label,
            });
        }
    }

    /**
     * Clears the console output.
     *
     * Calls the native console.clear() method to clear all output from
     * the console. This is a convenience method that wraps the native
     * console.clear() functionality.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.info("Some message");
     * logger.clear(); // Clears the console
     * ```
     */
    // eslint-disable-next-line class-methods-use-this
    public clear(): void {
        // eslint-disable-next-line no-console
        console.clear();
    }

    /**
     * Logs a raw message bypassing normal processing.
     *
     * Sends a message directly to the raw reporter without going through
     * the normal logging pipeline (processors, throttling, etc.). This is
     * useful for logging that needs to bypass all formatting and processing.
     * @param message The raw message to log
     * @param arguments_ Additional arguments to include
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.raw("Direct message", { data: "value" });
     * ```
     */
    public raw(message: string, ...arguments_: unknown[]): void {
        if (this.disabled) {
            return;
        }

        this.logger("log", true, {
            context: arguments_,
            message,
        });
    }

    protected extendReporter(reporter: Reporter<L>): Reporter<L> {
        if (typeof (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes === "function") {
            (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes(this.types);
        }

        if (typeof (reporter as StringifyAwareReporter<L>).setStringify === "function") {
            (reporter as StringifyAwareReporter<L>).setStringify(this.stringify);
        }

        return reporter;
    }

    protected registerReporters(reporters: Reporter<L>[]): void {
        for (const reporter of reporters) {
            this.reporters.add(this.extendReporter(reporter));
        }
    }

    #report(meta: Meta<L>, raw: boolean): void {
        if (raw) {
            this.rawReporter.log(Object.freeze(meta));
        } else {
            for (const reporter of this.reporters) {
                reporter.log(Object.freeze(meta));
            }
        }
    }

    #registerProcessors(processors: Processor<L>[]): void {
        for (const processor of processors) {
            if (typeof (processor as StringifyAwareProcessor<L>).setStringify === "function") {
                (processor as StringifyAwareProcessor<L>).setStringify(this.stringify);
            }

            this.processors.add(processor as Processor<L>);
        }
    }

    #normalizeLogLevel(level: LiteralUnion<ExtendedRfc5424LogLevels, L> | undefined): LiteralUnion<ExtendedRfc5424LogLevels, L> {
        return level && this.logLevels[level] ? level : "debug";
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    #buildMeta(typeName: string, type: Partial<LoggerConfiguration<L>>, ...arguments_: any[]): Meta<L> {
        const meta = {
            badge: undefined,
            context: undefined,
            error: undefined,
            label: undefined,
            message: EMPTY_SYMBOL,
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
        } as Meta<L>;

        meta.type = {
            level: type.logLevel as LiteralUnion<ExtendedRfc5424LogLevels, L>,
            name: typeName,
        };

        meta.groups = this.groups;
        meta.scope = this.scopeName;
        meta.date = new Date();

        // Handle different argument patterns to mimic console method behavior

        // Check if first argument is an Error object (highest priority for error handling)
        if (arguments_.length > 0 && arguments_[0] instanceof Error) {
            // First argument is an Error - set as error
            // eslint-disable-next-line prefer-destructuring
            meta.error = arguments_[0];

            // If there are additional arguments, add them to context
            if (arguments_.length > 1) {
                meta.context = arguments_.slice(1);
            }
            // Check if first argument is a structured Message object (has "message" property)
        } else if (arguments_.length > 0 && typeof arguments_[0] === "object" && arguments_[0] !== null && "message" in arguments_[0]) {
            // First argument is a Message object - destructure it for structured logging
            const { context, message, prefix, suffix } = arguments_[0] as Message;

            if (context) {
                meta.context = context;
            }

            if (prefix) {
                meta.prefix = prefix;
            }

            if (suffix) {
                meta.suffix = suffix;
            }

            meta.message = message;

            // If there are additional arguments beyond the Message object, add them to context
            if (arguments_.length > 1) {
                const additionalContext = arguments_.slice(1);

                if (meta.context) {
                    // If context already exists, combine it with additional arguments
                    meta.context = Array.isArray(meta.context) ? [...meta.context, ...additionalContext] : [meta.context, ...additionalContext];
                } else {
                    meta.context = additionalContext;
                }
            }
            // Handle multiple arguments where first is not Error or Message object
        } else if (arguments_.length > 1) {
            // Multiple arguments: treat first as primary message, rest as additional context
            meta.message = arguments_[0] as Primitive | ReadonlyArray<unknown> | Record<PropertyKey, unknown>;
            meta.context = arguments_.slice(1);
            // Handle single arguments
        } else if (arguments_.length === 1) {
            // Single argument - set as message (not wrapped in array)
            // eslint-disable-next-line prefer-destructuring
            meta.message = arguments_[0];
            // Handle empty arguments (edge case)
        } else {
            // No arguments provided
            meta.message = undefined;
        }

        if (type.logLevel === "trace") {
            meta.traceError = new Error("Trace");
        }

        if (type.badge) {
            meta.badge = type.badge;
        }

        if (type.label) {
            meta.label = type.label;
        }

        return meta;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    protected logger(type: LiteralUnion<DefaultLogTypes, T>, raw: boolean, ...messageObject: any[]): void {
        if (this.disabled) {
            return;
        }

        // Queue messages when paused
        if (this.paused) {
            this.messageQueue.push({ messageObject, raw, type });

            return;
        }

        const logLevel = this.#normalizeLogLevel(this.types[type].logLevel);

        if ((this.logLevels[logLevel] as number) >= (this.logLevels[this.generalLogLevel] as number)) {
            let meta = this.#buildMeta(type, this.types[type], ...messageObject);

            /**
             * @param newLog false if the throttle expired and we don't want to log a duplicate
             */
            const resolveLog = (newLog = false) => {
                const repeated = (this.lastLog.count || 0) - this.throttleMin;

                if (this.lastLog.object && repeated > 0) {
                    const lastMeta = { ...this.lastLog.object };

                    if (repeated > 1) {
                        lastMeta.repeated = repeated;
                    }

                    this.#report(lastMeta, raw);

                    this.lastLog.count = 1;
                }

                if (newLog) {
                    // Apply global processors

                    for (const processor of this.processors) {
                        meta = { ...processor.process(meta) };
                    }

                    this.lastLog.object = meta;

                    this.#report(meta, raw);
                }
            };

            clearTimeout(this.lastLog.timeout);

            const diffTime = this.lastLog.time && meta.date ? new Date(meta.date as Date | string).getTime() - this.lastLog.time.getTime() : 0;

            this.lastLog.time = new Date(meta.date as Date | string);

            if (diffTime < this.throttle) {
                try {
                    const isSameLog
                        = this.lastLog.object
                            && JSON.stringify([meta.label, meta.scope, meta.type, meta.message, meta.prefix, meta.suffix, meta.context])
                            === JSON.stringify([
                                this.lastLog.object.label,
                                this.lastLog.object.scope,
                                this.lastLog.object.type,
                                this.lastLog.object.message,
                                this.lastLog.object.prefix,
                                this.lastLog.object.suffix,
                                this.lastLog.object.context,
                            ]);

                    if (isSameLog) {
                        this.lastLog.count = (this.lastLog.count || 0) + 1;

                        if (this.lastLog.count > this.throttleMin) {
                            // Auto-resolve when throttle is timed out
                            this.lastLog.timeout = setTimeout(resolveLog, this.throttle);

                            return; // SPAM!
                        }
                    }
                } catch {
                    // Circular References
                }
            }

            resolveLog(true);
        }
    }
}

export type PailBrowserType<T extends string = string, L extends string = string> = (new<TC extends string = string, LC extends string = string>(
    options?: ConstructorOptions<TC, LC>,
) => PailBrowserType<TC, LC>)
& PailBrowserImpl<T, L>
& Record<DefaultLogTypes, LoggerFunction>
& Record<T, LoggerFunction>;

export type PailConstructor<T extends string = string, L extends string = string> = new (options?: ConstructorOptions<T, L>) => PailBrowserType<T, L>;

export const PailBrowser = PailBrowserImpl as unknown as PailBrowserType;
