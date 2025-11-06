import type { LiteralUnion } from "type-fest";

import InteractiveManager from "./interactive/interactive-manager";
import InteractiveStreamHook from "./interactive/interactive-stream-hook";
import { PailBrowserImpl } from "./pail.browser";
import type { MultiBarOptions, SingleBarOptions } from "./progress-bar";
import { applyStyleToOptions, MultiProgressBar, ProgressBar } from "./progress-bar";
import RawReporter from "./reporter/raw/raw-reporter.server";
import type { SpinnerOptions } from "./spinner";
import { MultiSpinner, Spinner } from "./spinner";
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
import { clearTerminal } from "./utils/ansi-escapes";
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
        // Optimize: reuse streams from parent when not overridden
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parentStderr = (options as any).parentStderr as NodeJS.WriteStream | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parentStdout = (options as any).parentStdout as NodeJS.WriteStream | undefined;

        const { interactive, processors, rawReporter, reporters, stderr: optionsStderr, stdout: optionsStdout } = options;
        const stderr = parentStderr ?? optionsStderr;
        const stdout = parentStdout ?? optionsStdout;

        // Optimize: reuse types, longestLabel, stringify, logLevels, and messages from parent if provided
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parentLongestLabel = (options as any).parentLongestLabel as string | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parentTypes = (options as any).parentTypes as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L> | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { parentLogLevels, parentMessages, parentStringify } = options as any;

        // Extract reporters before super() so parent constructor doesn't register them
        // We'll register them ourselves after streams are set
        // Optimize: only create parentOptions if we need to modify it, otherwise pass options directly
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        this.scopeName = name.flat();

        return this as unknown as PailServerType<N, L>;
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
        const typesChanged = options?.types !== undefined && options.types !== null;
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
    public wrapStd() {
        this.#wrapStream(this.stdout, "log");
        this.#wrapStream(this.stderr, "log");
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
    public restoreStd() {
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
     * Creates a single progress bar.
     * @param options Configuration options for the progress bar
     * @returns A new ProgressBar instance
     * @example
     * ```typescript
     * const logger = createPail({ interactive: true });
     * const bar = logger.createProgressBar({
     *   total: 100,
     *   format: 'Downloading [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}'
     * });
     *
     * bar.start();
     * // ... do work and update progress
     * bar.update(50);
     * bar.stop();
     * ```
     */
    public createProgressBar(options: SingleBarOptions): ProgressBar {
        if (!this.interactiveManager) {
            throw new Error("Interactive mode is not enabled. Create Pail with { interactive: true } to use progress bars.");
        }

        const styledOptions = applyStyleToOptions(options);

        return new ProgressBar(styledOptions, this.interactiveManager);
    }

    /**
     * Creates a multi-bar progress manager for displaying multiple progress bars.
     * @param options Configuration options for the multi-bar manager
     * @returns A new MultiProgressBar instance
     * @example
     * ```typescript
     * const logger = createPail({ interactive: true });
     * const multiBar = logger.createMultiProgressBar();
     *
     * const bar1 = multiBar.create(100);
     * const bar2 = multiBar.create(200);
     *
     * bar1.start();
     * bar2.start();
     * // ... update bars as needed
     * multiBar.stop();
     * ```
     */
    public createMultiProgressBar(options: MultiBarOptions = {}): MultiProgressBar {
        if (!this.interactiveManager) {
            throw new Error("Interactive mode is not enabled. Create Pail with { interactive: true } to use progress bars.");
        }

        const styledOptions = applyStyleToOptions(options);

        return new MultiProgressBar(styledOptions, this.interactiveManager);
    }

    /**
     * Creates a single spinner.
     * @param options Configuration options for the spinner
     * @returns A new Spinner instance
     * @example
     * ```typescript
     * const logger = createPail({ interactive: true });
     * const spinner = logger.createSpinner({ name: 'dots' });
     * spinner.start('Loading...');
     * // ... do work
     * spinner.succeed('Done');
     * ```
     */
    public createSpinner(options: SpinnerOptions = {}): Spinner {
        if (!this.interactiveManager) {
            throw new Error("Interactive mode is not enabled. Create Pail with { interactive: true } to use spinners.");
        }

        return new Spinner(options, this.interactiveManager);
    }

    /**
     * Creates a multi-spinner manager for displaying multiple spinners.
     * @param options Configuration options for the multi-spinner manager
     * @returns A new MultiSpinner instance
     * @example
     * ```typescript
     * const logger = createPail({ interactive: true });
     * const multiSpinner = logger.createMultiSpinner();
     *
     * const spinner1 = multiSpinner.create('Loading 1');
     * const spinner2 = multiSpinner.create('Loading 2');
     *
     * spinner1.start();
     * spinner2.start();
     * // ... update spinners as needed
     * multiSpinner.stop();
     * ```
     */
    public createMultiSpinner(options: SpinnerOptions = {}): MultiSpinner {
        if (!this.interactiveManager) {
            throw new Error("Interactive mode is not enabled. Create Pail with { interactive: true } to use spinners.");
        }

        return new MultiSpinner(options, this.interactiveManager);
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
        this.stdout.write(clearTerminal as string);
        this.stderr.write(clearTerminal as string);
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

    #wrapStream(stream: NodeJS.WriteStream | undefined, type: LiteralUnion<DefaultLogTypes, L>) {
        if (!stream) {
            return;
        }

        // Backup original value
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
        if (!(stream as any).__write) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign, no-underscore-dangle
            (stream as any).__write = stream.write;
        }

        // Override
        // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign
        (stream as any).write = (data: any): void => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            (this as unknown as PailServerImpl)[type](String(data).trim());
        };
    }

    // eslint-disable-next-line class-methods-use-this
    #restoreStream(stream?: NodeJS.WriteStream): void {
        if (!stream) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
        if ((stream as any).__write) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign, no-underscore-dangle
            stream.write = (stream as any).__write;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign, no-underscore-dangle
            delete (stream as any).__write;
        }
    }
}

export type PailServerType<T extends string = string, L extends string = string> = Console
    & (new<TC extends string = string, LC extends string = string>(options?: ServerConstructorOptions<TC, LC>) => PailServerType<TC, LC>)
    & PailServerImpl<T, L>
    & Record<DefaultLogTypes, LoggerFunction>
    & Record<T, LoggerFunction> & {
        force: Record<DefaultLogTypes, LoggerFunction> & Record<T, LoggerFunction>;
    };

export type PailConstructor<T extends string = string, L extends string = string> = new (options?: ServerConstructorOptions<T, L>) => PailServerType<T, L>;

export const PailServer = PailServerImpl as unknown as PailServerType;
