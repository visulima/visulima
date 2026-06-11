// eslint-disable-next-line import/no-extraneous-dependencies
import { resetTerminal } from "@visulima/ansi/clear";
import { InteractiveManager, InteractiveStreamHook } from "@visulima/interactive-manager";
import type { LiteralUnion } from "type-fest";

import { PailBrowserImpl } from "./pail.browser";
import RawReporter from "./reporter/raw/raw-reporter.server";
import type {
    ConstructorOptions,
    DefaultLoggerTypes,
    DefaultLogTypes,
    ExtendedRfc5424LogLevels,
    InteractiveStreamReporter,
    LoggerFunction,
    LoggerTypesAwareReporter,
    LoggerTypesConfig,
    ParentLoggerOptimization,
    Processor,
    Reporter,
    ServerConstructorOptions,
    StreamAwareReporter,
    StringifyAwareReporter,
} from "./types";
import arrayify from "./utils/arrayify";
import getLongestLabel from "./utils/get-longest-label";
import mergeTypes from "./utils/merge-types";

/**
 * Internal interface for server-specific parent logger optimization properties.
 *
 * Extends the base optimization interface with server-specific stream properties.
 * @internal
 */
interface ServerParentLoggerOptimization<T extends string = string, L extends string = string> extends ParentLoggerOptimization<T, L> {
    parentStderr?: NodeJS.WriteStream;
    parentStdout?: NodeJS.WriteStream;
}

class PailServerImpl<T extends string = string, L extends string = string> extends PailBrowserImpl<T, L> {
    protected readonly stdout: NodeJS.WriteStream;

    protected readonly stderr: NodeJS.WriteStream;

    protected interactiveManager: InteractiveManager | undefined;

    protected readonly interactive: boolean;

    /**
     * Creates a new Pail server logger instance.
     *
     * Initializes the server-compatible logger with streams, interactive support,
     * and server-specific configuration options.
     * @param options Server-specific configuration options
     */
    public constructor(public readonly options: ServerConstructorOptions<T, L>) {
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-redundant-type-constituents, sonarjs/no-useless-intersection -- parent optimization uses dynamic property access on options */
        // Optimize: reuse streams from parent when not overridden
        const parentStderr = (options as any).parentStderr as NodeJS.WriteStream | undefined;
        const parentStdout = (options as any).parentStdout as NodeJS.WriteStream | undefined;

        const { interactive, processors, rawReporter, reporters, stderr: optionsStderr, stdout: optionsStdout } = options;
        const stderr = parentStderr ?? optionsStderr;
        const stdout = parentStdout ?? optionsStdout;

        // Optimize: reuse types, longestLabel, stringify, logLevels, and messages from parent if provided
        const parentLongestLabel = (options as any).parentLongestLabel as string | undefined;
        const parentTypes = (options as any).parentTypes as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L> | undefined;
        const { parentLogLevels, parentMessages, parentStringify } = options as any;

        // Extract reporters before super() so parent constructor doesn't register them
        // We'll register them ourselves after streams are set
        // Optimize: only create parentOptions if we need to modify it, otherwise pass options directly
        const parentOptions: any & ConstructorOptions<T, L> = {
            disabled: options.disabled,
            logLevel: options.logLevel,
            logLevels: options.logLevels,
            messages: options.messages,
            processors: [],
            rawReporter: options.rawReporter,
            reporters: [],
            scope: options.scope,
            throttle: options.throttle,
            throttleMin: options.throttleMin,
        };

        // Batch parent value assignments for optimization
        // When reusing parent types, options.types is not in the object (not set in childOptions)
        // Check if types property exists in options object
        const hasTypesProperty = "types" in options;

        if (parentTypes && parentLongestLabel && !hasTypesProperty) {
            // Don't set types when reusing parent types - let constructor handle it
            parentOptions.parentTypes = parentTypes;
            parentOptions.parentLongestLabel = parentLongestLabel;
        } else if (hasTypesProperty && options.types !== undefined) {
            // Only set types when they're provided and not reusing parent types
            parentOptions.types = options.types;
        }

        if (parentStringify) {
            parentOptions.parentStringify = parentStringify;
        }

        if (parentLogLevels && !options.logLevels) {
            parentOptions.parentLogLevels = parentLogLevels;
        }

        if (parentMessages && !options.messages) {
            parentOptions.parentMessages = parentMessages;
        }

        super(parentOptions);
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-redundant-type-constituents, sonarjs/no-useless-intersection */

        this.interactive = interactive ?? false;

        // Set streams after super() is called
        this.stdout = stdout;
        this.stderr = stderr;

        if (this.interactive) {
            this.interactiveManager = new InteractiveManager(new InteractiveStreamHook(this.stdout), new InteractiveStreamHook(this.stderr));
        }

        // Register reporters now that streams are set
        if (Array.isArray(reporters)) {
            this.registerReporters(reporters);
        }

        this.rawReporter = this.extendReporter(rawReporter ?? new RawReporter<L>());

        if (Array.isArray(processors)) {
            this.registerProcessors(processors);
        }
    }

    // @ts-expect-error - this returns a different type
    public override scope<N extends string = T>(...name: string[]): PailServerType<N, L> {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        // Return a *new* logger (as documented) instead of mutating `this`. The new scope
        // extends the parent's scope, so nested `scope()` calls nest rather than replace.
        return this.child<N>({ scope: name });
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
    // @ts-expect-error - override signature differs due to server-specific options
    public override child<N extends string = T, LC extends string = L>(
        options?: Partial<ConstructorOptions<N, LC>> & Partial<Pick<ServerConstructorOptions<N, LC>, "interactive" | "stderr" | "stdout">>,
    ): PailServerType<N, LC> {
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
        // Pass parent types, longestLabel, stringify, logLevels, and messages for optimization when unchanged
        const childOptions: ServerConstructorOptions<N, LC> & ServerParentLoggerOptimization<N, LC> = {
            disabled: options?.disabled ?? this.disabled,
            interactive: options?.interactive ?? this.interactive,
            logLevel: (options?.logLevel ?? this.generalLogLevel) as LiteralUnion<ExtendedRfc5424LogLevels, LC>,
            logLevels: mergedLogLevels,
            messages: mergedMessages,
            processors: allProcessors,
            rawReporter: (options?.rawReporter ?? this.rawReporter) as Reporter<LC>,
            reporters: allReporters,
            scope: mergedScope,
            stderr: options?.stderr ?? this.stderr,
            stdout: options?.stdout ?? this.stdout,
            throttle: options?.throttle ?? this.throttle,
            throttleMin: options?.throttleMin ?? this.throttleMin,
        };

        // Optimize: pass parent values when they haven't changed
        this.#assignParentValues(childOptions, options, typesChanged, mergedTypes);

        return new PailServerImpl<N, LC>(childOptions) as unknown as PailServerType<N, LC>;
    }

    /**
     * Assigns parent values to child options for optimization.
     *
     * Reuses parent values when they haven't changed to avoid unnecessary recalculations.
     */
    /* eslint-disable no-param-reassign */
    #assignParentValues<N extends string = T, LC extends string = L>(
        childOptions: ServerConstructorOptions<N, LC> & ServerParentLoggerOptimization<N, LC>,
        options: (Partial<ConstructorOptions<N, LC>> & Partial<Pick<ServerConstructorOptions<N, LC>, "interactive" | "stderr" | "stdout">>) | undefined,
        typesChanged: boolean,
        mergedTypes: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, N>, LC>,
    ): void {
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

        // Optimize: reuse streams from parent when not overridden
        if (!options?.stdout) {
            childOptions.parentStdout = this.stdout;
        }

        if (!options?.stderr) {
            childOptions.parentStderr = this.stderr;
        }
    }
    /* eslint-enable no-param-reassign */

    /**
     * Gets the interactive manager instance if interactive mode is enabled.
     *
     * Returns the InteractiveManager instance that handles interactive terminal
     * features like progress bars and dynamic updates. Only available when
     * interactive mode is enabled in the constructor options.
     * @returns The interactive manager instance, or undefined if not in interactive mode
     * @example
     * ```typescript
     * const logger = createPail({ interactive: true });
     * const manager = logger.getInteractiveManager();
     * if (manager) {
     *   manager.hook();
     *   // Use interactive features
     *   manager.unhook();
     * }
     * ```
     */

    public getInteractiveManager(): InteractiveManager | undefined {
        return this.interactiveManager;
    }

    /**
     * Wraps stdout and stderr streams to redirect them through the logger.
     *
     * Intercepts writes to process.stdout and process.stderr, redirecting them
     * through the logger instead of writing directly to the streams. This allows
     * all output to be processed by the logging pipeline.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.wrapStd();
     *
     * console.log("This goes through logger");
     * process.stdout.write("This too");
     *
     * logger.restoreStd(); // Restore original streams
     * ```
     */
    public wrapStd(): void {
        this.#wrapStream(this.stdout, "log");
        this.#wrapStream(this.stderr, "error");
    }

    /**
     * Restores the original stdout and stderr streams.
     *
     * Removes the stream wrapping that was applied by wrapStd(),
     * restoring the original stream write methods.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.wrapStd();
     * // Streams are wrapped
     * logger.restoreStd();
     * // Streams are restored to original behavior
     * ```
     */
    public restoreStd(): void {
        this.#restoreStream(this.stdout);
        this.#restoreStream(this.stderr);
    }

    /**
     * Wraps all output sources (console and streams).
     *
     * Convenience method that calls both wrapConsole() and wrapStd()
     * to redirect all output through the logger.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.wrapAll(); // Wraps console and streams
     *
     * // All output now goes through logger
     * console.log("Console output");
     * process.stdout.write("Stream output");
     *
     * logger.restoreAll(); // Restore everything
     * ```
     */
    public wrapAll(): void {
        this.wrapConsole();
        this.wrapStd();
    }

    /**
     * Restores all wrapped output sources.
     *
     * Convenience method that calls both restoreConsole() and restoreStd()
     * to restore all original output behavior.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.wrapAll();
     * // All output is wrapped
     * logger.restoreAll();
     * // All output sources are restored
     * ```
     */
    public restoreAll(): void {
        this.restoreConsole();
        this.restoreStd();
    }

    /**
     * Clears the terminal screen.
     *
     * Sends ANSI escape sequences to clear the terminal screen and move
     * the cursor to the top-left position. This overrides the browser
     * implementation to work with terminal streams.
     * @example
     * ```typescript
     * const logger = createPail();
     * logger.info("Some output");
     * logger.clear(); // Clears the terminal screen
     * ```
     */
    public override clear(): void {
        this.stdout.write(resetTerminal);
        this.stderr.write(resetTerminal);
    }

    protected override extendReporter(reporter: Reporter<L>): Reporter<L> {
        if (typeof (reporter as StreamAwareReporter<L>).setStdout === "function") {
            (reporter as StreamAwareReporter<L>).setStdout(this.stdout);
        }

        if (typeof (reporter as StreamAwareReporter<L>).setStderr === "function") {
            (reporter as StreamAwareReporter<L>).setStderr(this.stderr);
        }

        if (typeof (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes === "function") {
            (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes(this.types);
        }

        if (typeof (reporter as StringifyAwareReporter<L>).setStringify === "function") {
            (reporter as StringifyAwareReporter<L>).setStringify(this.stringify);
        }

        if (typeof (reporter as InteractiveStreamReporter<L>).setIsInteractive === "function") {
            (reporter as InteractiveStreamReporter<L>).setIsInteractive(this.interactive);
        }

        if (this.interactive && typeof (reporter as InteractiveStreamReporter<L>).setInteractiveManager === "function") {
            (reporter as InteractiveStreamReporter<L>).setInteractiveManager(this.interactiveManager);
        }

        return reporter;
    }

    #wrapStream(stream: NodeJS.WriteStream | undefined, type: LiteralUnion<DefaultLogTypes, L>): void {
        if (!stream) {
            return;
        }

        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- stream wrapping requires dynamic property access */
        // Backup original value
        // eslint-disable-next-line no-underscore-dangle
        if (!(stream as any).__write) {
            // eslint-disable-next-line no-param-reassign, no-underscore-dangle, @typescript-eslint/unbound-method -- intentionally storing unbound method for backup
            (stream as any).__write = stream.write;
        }

        // Override
        // eslint-disable-next-line no-param-reassign
        (stream as any).write = (data: any): void => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            (this as unknown as PailServerImpl)[type](String(data).trim());
        };
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    }

    // eslint-disable-next-line class-methods-use-this
    #restoreStream(stream?: NodeJS.WriteStream): void {
        if (!stream) {
            return;
        }

        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- stream restore requires dynamic property access */
        // eslint-disable-next-line no-underscore-dangle
        if ((stream as any).__write) {
            // eslint-disable-next-line no-param-reassign, no-underscore-dangle
            stream.write = (stream as any).__write;

            // eslint-disable-next-line no-param-reassign, no-underscore-dangle
            delete (stream as any).__write;
        }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    }
}

export type PailServerType<T extends string = string, L extends string = string> = Console
    & (new <TC extends string = string, LC extends string = string>(options?: ServerConstructorOptions<TC, LC>) => PailServerType<TC, LC>)
    & PailServerImpl<T, L>
    & Record<DefaultLogTypes, LoggerFunction>
    & Record<T, LoggerFunction> & {
        force: Record<DefaultLogTypes, LoggerFunction> & Record<T, LoggerFunction>;
    };

export type PailConstructor<T extends string = string, L extends string = string> = new (options?: ServerConstructorOptions<T, L>) => PailServerType<T, L>;

export const PailServer = PailServerImpl as unknown as PailServerType;
