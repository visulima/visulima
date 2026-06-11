import type { stringify } from "safe-stable-stringify";
// eslint-disable-next-line import/no-extraneous-dependencies
import { configure as stringifyConfigure } from "safe-stable-stringify";
import type { LiteralUnion, Primitive } from "type-fest";

import { EMPTY_SYMBOL, EXTENDED_RFC_5424_LOG_LEVELS, LOG_TYPES } from "./constants";
import { CounterManager } from "./counter-manager";
import RawReporter from "./reporter/raw/raw-reporter.browser";
import { TimerManager } from "./timer-manager";
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
    ParentLoggerOptimization,
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- generic function apply
            const result = function_.apply(this, args);

            doing = false;

            return result;
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
    /**
     * Timer state delegated to TimerManager.
     * @internal
     */
    protected readonly timerManager: TimerManager;

    /**
     * Counter state delegated to CounterManager.
     * @internal
     */
    protected readonly counterManager: CounterManager;

    protected readonly lastLog: {
        count?: number;
        object?: Meta<L>;
        signature?: string;
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

    protected force: Record<string, LoggerFunction> = {} as Record<string, LoggerFunction>;

    // Tracks unknown log-level names already warned about, so #normalizeLogLevel emits the
    // misconfiguration warning at most once per level instead of on every log call.
    readonly #warnedLogLevels = new Set<string>();

    // References to the handlers installed by wrapException(), so restoreException() can remove
    // them and a repeated wrapException() does not stack duplicate listeners.
    #uncaughtExceptionHandler: ((error: Error) => void) | undefined;

    #unhandledRejectionHandler: ((error: unknown) => void) | undefined;

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

        // Optimize: reuse types, longestLabel, stringify, and logLevels from parent if provided (for child loggers)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const parentLongestLabel = (options as any).parentLongestLabel as string | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const parentTypes = (options as any).parentTypes as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L> | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const parentStringify = (options as any).parentStringify as typeof stringify | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const parentLogLevels = (options as any).parentLogLevels as Record<string, number> | undefined;

        // Reuse stringify from parent if available (same configuration)
        this.stringify
            = parentStringify
                ?? stringifyConfigure({
                    strict: true,
                });

        this.startTimerMessage = options.messages?.timerStart ?? "Initialized timer...";
        this.endTimerMessage = options.messages?.timerEnd ?? "Timer run for:";

        // Optimize: reuse parent types and longestLabel when provided (for child loggers with unchanged types)
        // When parentTypes is provided, it means we're creating a child logger - reuse parent's types
        // Only merge types if parentTypes is not available or if types are explicitly provided in options
        if (parentTypes && parentLongestLabel) {
            // Reuse parent types and longestLabel when provided (for child loggers)
            // This happens when child() is called without types parameter
            this.types = parentTypes;
            this.longestLabel = parentLongestLabel;
        } else {
            // Always merge with LOG_TYPES to ensure default types are included
            // When options.types is provided from child() with merged types, merging again is safe (idempotent)
            // When options.types is provided for a new logger, it needs to be merged with defaults
            this.types = mergeTypes<L, T>(LOG_TYPES as DefaultLoggerTypes<L>, (options.types ?? {}) as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>);
            this.longestLabel = getLongestLabel<L, T>(this.types);
        }

        // Optimize: reuse logLevels from parent if no new logLevels provided
        this.logLevels = parentLogLevels && !options.logLevels ? parentLogLevels : { ...EXTENDED_RFC_5424_LOG_LEVELS, ...options.logLevels };

        this.generalLogLevel = this.#normalizeLogLevel(options.logLevel);

        this.reporters = new Set();
        this.processors = new Set();

        this.disabled = options.disabled ?? false;
        this.paused = false;
        this.messageQueue = [];

        this.scopeName = arrayify(options.scope).filter(Boolean);

        // TimerManager and CounterManager are initialized before the logger is preventLoop-wrapped;
        // they receive arrow functions that call `this.logger` so they always pick up the final
        // (wrapped) implementation via the instance slot set a few lines below.
        this.timerManager = new TimerManager(
            (type: string, raw: boolean, force: boolean, ...args: unknown[]) => {
                this.logger(type as never, raw, force, ...args);
            },
            this.startTimerMessage,
            this.endTimerMessage,
        );
        this.counterManager = new CounterManager((type: string, raw: boolean, force: boolean, ...args: unknown[]) => {
            this.logger(type as never, raw, force, ...args);
        });

        this.groups = [];

        // Track of last log
        this.lastLog = {};

        // Prevent infinite loop on logging
        this.logger = preventLoop(this.logger.bind(this));

        this.#initializeBoundMethods();

        if (Array.isArray(options.reporters)) {
            this.registerReporters(options.reporters);
        }

        this.rawReporter = this.extendReporter(options.rawReporter ?? new RawReporter<L>());

        if (Array.isArray(options.processors)) {
            this.registerProcessors(options.processors);
        }
    }

    /**
     * Initializes bound methods for all logger types.
     *
     * Creates bound methods for both regular and force logging methods.
     * This is separated to allow reuse when types haven't changed.
     */
    #initializeBoundMethods(): void {
        // eslint-disable-next-line no-restricted-syntax,guard-for-in
        for (const type in this.types) {
            // @ts-expect-error - dynamic property
            this[type] = this.logger.bind(this, type as T, false, false);
        }

        // Create force methods that bypass log level filtering
        // Force is already initialized in class property

        // eslint-disable-next-line no-restricted-syntax,guard-for-in
        for (const type in this.types) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            (this.force as any)[type] = this.logger.bind(this, type as T, false, true);
        }

        // `raw` is a prototype method that reads `this.disabled`. Callers like
        // `(logger.raw ?? logger.log)(...)` extract it as a value, which would
        // strip the receiver — bind it on the instance to keep parity with the
        // type-keyed methods above.
        this.raw = this.raw.bind(this);
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
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- console wrapping requires dynamic property access */
        // eslint-disable-next-line guard-for-in,no-restricted-syntax
        for (const type in this.types) {
            // Backup original value
            if (!(console as any)[`__${type}`]) {
                (console as any)[`__${type}`] = (console as any)[type];
            }

            // Override
            // @TODO: Fix typings
            (console as any)[type] = (this as unknown as PailBrowserImpl<T, L>)[type as keyof PailBrowserImpl<T, L>];
        }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
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
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- console restore requires dynamic property access */
        // eslint-disable-next-line no-restricted-syntax
        for (const type in this.types) {
            // Restore if backup is available
            if ((console as any)[`__${type}`]) {
                (console as any)[type] = (console as any)[`__${type}`];

                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete (console as any)[`__${type}`];
            }
        }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
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
        if (typeof process === "undefined") {
            return;
        }

        // Idempotent: a second call without restoreException() would otherwise stack a new
        // pair of listeners that can never be removed (the previous implementation kept no
        // references). Bail out if handlers are already installed.
        if (this.#uncaughtExceptionHandler || this.#unhandledRejectionHandler) {
            return;
        }

        this.#uncaughtExceptionHandler = (error: Error): void => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            (this as unknown as PailBrowserImpl<T, L>).error(error);
        };

        this.#unhandledRejectionHandler = (error: unknown): void => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            (this as unknown as PailBrowserImpl<T, L>).error(error);
        };

        process.on("uncaughtException", this.#uncaughtExceptionHandler);
        process.on("unhandledRejection", this.#unhandledRejectionHandler);
    }

    /**
     * Removes the global exception/rejection handlers installed by {@link wrapException}.
     *
     * Counterpart to `wrapException()` (mirrors `wrapConsole()`/`restoreConsole()`).
     * Safe to call when no handlers are installed.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.wrapException();
     * // ... later ...
     * logger.restoreException(); // global handlers removed
     * ```
     */
    public restoreException(): void {
        if (typeof process === "undefined") {
            return;
        }

        if (this.#uncaughtExceptionHandler) {
            process.off("uncaughtException", this.#uncaughtExceptionHandler);
            this.#uncaughtExceptionHandler = undefined;
        }

        if (this.#unhandledRejectionHandler) {
            process.off("unhandledRejection", this.#unhandledRejectionHandler);
            this.#unhandledRejectionHandler = undefined;
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

        for (let i = 0; i < queue.length; i += 1) {
            const { messageObject, raw, type } = queue[i];

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- messageObject comes from queue with any[] type
            this.logger(type, raw, false, ...messageObject);
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

        // Return a *new* logger (as documented) instead of mutating `this`. The new scope
        // extends the parent's scope, so `outer.scope("inner")` nests rather than replacing.
        // (Previously `this.scopeName = name.flat()` re-scoped the receiver in place.)
        return this.child<N>({ scope: name });
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
     * Creates a child logger that inherits settings from the parent.
     *
     * Returns a new logger instance that inherits all configuration from the parent
     * (reporters, processors, types, log levels, throttle settings, etc.) while allowing
     * you to override only what you need. Child loggers are independent instances with
     * their own state (timers, counters, etc.).
     * @template N - The new custom logger type names
     * @template LC - The new log level types
     * @param options Configuration options to override or extend parent settings
     * @returns A new child logger instance
     * @example
     * ```typescript
     * const parent = createPail({
     *   logLevel: "info",
     *   types: { http: { label: "HTTP", logLevel: "info" } },
     *   reporters: [new PrettyReporter()],
     * });
     *
     * // Child inherits parent settings but overrides log level
     * const child = parent.child({ logLevel: "debug" });
     * child.info("This will be logged"); // Uses debug level from child
     * child.http("GET /api 200"); // Inherits http type from parent
     *
     * // Child can add new types
     * const childWithNewType = parent.child({
     *   types: { db: { label: "DB", logLevel: "info" } },
     * });
     * childWithNewType.db("Query executed"); // New type available
     * ```
     */
    public child<N extends string = T, LC extends string = L>(options?: Partial<ConstructorOptions<N, LC>>): PailBrowserType<N, LC> {
        // Check if types have changed - if not, we can reuse bound methods
        const typesChanged = options?.types !== undefined;
        const mergedTypes = typesChanged
            ? mergeTypes<LC, N>(this.types as DefaultLoggerTypes<LC>, options.types as LoggerTypesConfig<N, LC>)
            : (this.types as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, N>, LC>);

        // Combine parent and child reporters - pass Sets directly to avoid array conversion
        const childReporters = options?.reporters ?? [];
        const allReporters
            = childReporters.length > 0
                ? ([...this.reporters, ...childReporters] as unknown as Reporter<LC>[])
                : ([...this.reporters] as unknown as Reporter<LC>[]);

        // Combine parent and child processors - pass Sets directly to avoid array conversion
        const childProcessors = options?.processors ?? [];
        const allProcessors
            = childProcessors.length > 0
                ? ([...this.processors, ...childProcessors] as unknown as Processor<LC>[])
                : ([...this.processors] as unknown as Processor<LC>[]);

        // Merge log levels (child overrides parent)
        const mergedLogLevels = options?.logLevels
            ? ({ ...this.logLevels, ...options.logLevels } as Partial<Record<ExtendedRfc5424LogLevels, number>> & Record<LC, number>)
            : (this.logLevels as Partial<Record<ExtendedRfc5424LogLevels, number>> & Record<LC, number>);

        // Merge scope (child scope extends parent scope)
        // Optimize: avoid array operations when no child scope
        let mergedScope: string[];

        if (options?.scope) {
            const childScope = arrayify(options.scope).filter(Boolean);

            mergedScope = this.scopeName.length > 0 ? [...this.scopeName, ...childScope] : childScope;
        } else {
            mergedScope = this.scopeName.length > 0 ? this.scopeName : [];
        }

        // Merge messages (child overrides parent)
        // Optimize: only create messages object if there are overrides
        const mergedMessages = options?.messages
            ? {
                timerEnd: this.endTimerMessage,
                timerStart: this.startTimerMessage,
                ...options.messages,
            }
            : {
                timerEnd: this.endTimerMessage,
                timerStart: this.startTimerMessage,
            };

        // Create child logger options
        // Pass parent types, longestLabel, stringify, and logLevels for optimization when unchanged
        const childOptions: ConstructorOptions<N, LC> & ParentLoggerOptimization<N, LC> = {
            disabled: options?.disabled ?? this.disabled,
            logLevel: (options?.logLevel ?? this.generalLogLevel) as LiteralUnion<ExtendedRfc5424LogLevels, LC>,
            logLevels: mergedLogLevels,
            messages: mergedMessages,
            processors: allProcessors,
            rawReporter: (options?.rawReporter ?? this.rawReporter) as Reporter<LC>,
            reporters: allReporters,
            scope: mergedScope,
            throttle: options?.throttle ?? this.throttle,
            throttleMin: options?.throttleMin ?? this.throttleMin,
        };

        // Optimize: pass parent values when they haven't changed
        if (typesChanged) {
            // When types have changed, mergedTypes is already fully merged (includes defaults from parent)
            // Pass as parentTypes so constructor uses them directly without merging again
            childOptions.parentTypes = mergedTypes;
            childOptions.parentLongestLabel = getLongestLabel<LC, N>(mergedTypes);
        } else {
            // Don't set types in childOptions when reusing parent types - let constructor handle it
            childOptions.parentTypes = this.types as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, N>, LC>;
            childOptions.parentLongestLabel = this.longestLabel;
        }

        if (!options?.logLevels) {
            childOptions.parentLogLevels = this.logLevels;
        }

        if (!options?.messages) {
            childOptions.parentMessages = {
                timerEnd: this.endTimerMessage,
                timerStart: this.startTimerMessage,
            };
        }

        // Always pass stringify (it's the same configuration)
        childOptions.parentStringify = this.stringify;

        return new PailBrowserImpl<N, LC>(childOptions) as unknown as PailBrowserType<N, LC>;
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
        this.timerManager.time(label);
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
        this.timerManager.timeLog(label, ...data);
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
        this.timerManager.timeEnd(label);
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison -- runtime SSR check
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison -- runtime SSR check
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
        this.counterManager.count(label);
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
        this.counterManager.countReset(label);
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

        this.logger("log", true, false, {
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
        for (let i = 0; i < reporters.length; i += 1) {
            this.reporters.add(this.extendReporter(reporters[i]));
        }
    }

    protected registerProcessors(processors: Processor<L>[]): void {
        for (let i = 0; i < processors.length; i += 1) {
            const processor = processors[i];

            if (typeof (processor as StringifyAwareProcessor<L>).setStringify === "function") {
                (processor as StringifyAwareProcessor<L>).setStringify(this.stringify);
            }

            this.processors.add(processor);
        }
    }

    #report(meta: Meta<L>, raw: boolean): void {
        // eslint-disable-next-line sonarjs/no-selector-parameter -- raw flag is fundamental to the reporting architecture
        if (raw) {
            this.rawReporter.log(Object.freeze(meta));
        } else {
            for (const reporter of this.reporters) {
                reporter.log(Object.freeze(meta));
            }
        }
    }

    #normalizeLogLevel(level: LiteralUnion<ExtendedRfc5424LogLevels, L> | undefined): LiteralUnion<ExtendedRfc5424LogLevels, L> {
        let resolved: LiteralUnion<ExtendedRfc5424LogLevels, L> = "debug";

        // Use an own-property check rather than truthiness so a custom level mapped to
        // priority `0` is still recognised as valid (previously `this.logLevels[level]`
        // was falsy for `0` and the level was rejected).
        if (level !== undefined && Object.hasOwn(this.logLevels, level)) {
            resolved = level;
        } else if (level !== undefined && !this.#warnedLogLevels.has(level)) {
            // An unknown level name (e.g. a typo like `PAIL_LOG_LEVEL=warn`) used to silently
            // fall through to `debug` — the most verbose level — flooding output. Warn the
            // caller so the misconfiguration is visible instead of silently worsening.
            // (`undefined` is the documented "use the default" case and is not warned about.)
            this.#warnedLogLevels.add(level);

            // eslint-disable-next-line no-console
            console.warn(`[pail] Unknown log level "${String(level)}". Valid levels: ${Object.keys(this.logLevels).join(", ")}. Falling back to "debug".`);
        }

        return resolved;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    #buildMeta(typeName: string, type: Partial<LoggerConfiguration<L>>, ...arguments_: unknown[]): Meta<L> {
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Message type uses any for flexibility
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

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Message.message is any by design
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
            meta.message = arguments_[0] as Primitive | ReadonlyArray<unknown> | Record<PropertyKey, unknown>;
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
    protected logger(type: LiteralUnion<DefaultLogTypes, T>, raw: boolean, force: boolean, ...messageObject: unknown[]): void {
        if (this.disabled) {
            return;
        }

        // Queue messages when paused
        if (this.paused) {
            this.messageQueue.push({ messageObject, raw, type });

            return;
        }

        const typeConfig = this.types[type] as LoggerConfiguration<L>;
        const logLevel = this.#normalizeLogLevel(typeConfig.logLevel);

        // Bypass level check if force is true
        if (force || this.logLevels[logLevel] >= this.logLevels[this.generalLogLevel]) {
            let meta = this.#buildMeta(type, typeConfig, ...messageObject);

            // Compute the dedup signature for the pre-processor meta exactly once.
            // It is reused both for the throttle comparison below and (when no processors
            // are registered, so the relevant fields are guaranteed unchanged) for storage
            // in resolveLog — avoiding a second JSON.stringify of the same large tuple.
            let preProcessorSignature: string | undefined;

            try {
                preProcessorSignature = JSON.stringify([meta.label, meta.scope, meta.type, meta.message, meta.prefix, meta.suffix, meta.context]);
            } catch {
                // Circular References - leave undefined so throttle dedup is skipped for this log.
                preProcessorSignature = undefined;
            }

            const hasProcessors = this.processors.size > 0;

            /**
             * @param newLog false if the throttle expired and we don't want to log a duplicate
             */
            const resolveLog = (newLog = false) => {
                const repeated = (this.lastLog.count ?? 0) - this.throttleMin;

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
                        meta = processor.process(meta);
                    }

                    if ((meta as Meta<L> & { dropped?: boolean }).dropped === true) {
                        return;
                    }

                    this.lastLog.object = meta;

                    if (hasProcessors) {
                        // Processors may have mutated the signature-relevant fields, so recompute.
                        try {
                            this.lastLog.signature = JSON.stringify([meta.label, meta.scope, meta.type, meta.message, meta.prefix, meta.suffix, meta.context]);
                        } catch {
                            // Circular References - leave signature unset so throttle dedup is skipped for this log
                            this.lastLog.signature = undefined;
                        }
                    } else {
                        // No processors ran — the precomputed signature still describes this meta.
                        this.lastLog.signature = preProcessorSignature;
                    }

                    this.#report(meta, raw);
                }
            };

            clearTimeout(this.lastLog.timeout);

            const metaDate = meta.date instanceof Date ? meta.date : new Date(meta.date);
            const diffTime = this.lastLog.time ? metaDate.getTime() - this.lastLog.time.getTime() : 0;

            this.lastLog.time = metaDate;

            if (diffTime < this.throttle) {
                try {
                    const currentSignature = preProcessorSignature;
                    const isSameLog = this.lastLog.object && currentSignature !== undefined && currentSignature === this.lastLog.signature;

                    if (isSameLog) {
                        this.lastLog.count = (this.lastLog.count ?? 0) + 1;

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

export type PailBrowserType<T extends string = string, L extends string = string> = Console
    & (new <TC extends string = string, LC extends string = string>(options?: ConstructorOptions<TC, LC>) => PailBrowserType<TC, LC>)
    & PailBrowserImpl<T, L>
    & Record<DefaultLogTypes, LoggerFunction>
    & Record<T, LoggerFunction> & {
        force: Record<DefaultLogTypes, LoggerFunction> & Record<T, LoggerFunction>;
    };

export type PailConstructor<T extends string = string, L extends string = string> = new (options?: ConstructorOptions<T, L>) => PailBrowserType<T, L>;

export const PailBrowser = PailBrowserImpl as unknown as PailBrowserType;
