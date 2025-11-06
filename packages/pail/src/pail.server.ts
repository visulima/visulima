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
    DefaultLogTypes,
    InteractiveStreamReporter,
    LoggerFunction,
    LoggerTypesAwareReporter,
    Reporter,
    ServerConstructorOptions,
    StreamAwareReporter,
    StringifyAwareReporter,
} from "./types";
import { clearTerminal } from "./utils/ansi-escapes";

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
        const { interactive, rawReporter, reporters, stderr, stdout, ...rest } = options;

        super(rest as ConstructorOptions<T, L>);

        this.interactive = interactive ?? false;

        this.stdout = stdout;
        this.stderr = stderr;

        if (this.interactive) {
            this.interactiveManager = new InteractiveManager(new InteractiveStreamHook(this.stdout), new InteractiveStreamHook(this.stderr));
        }

        if (Array.isArray(reporters)) {
            this.registerReporters(reporters);
        }

        this.rawReporter = this.extendReporter(options.rawReporter ?? new RawReporter<L>());
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
