import type { stringify } from "safe-stable-stringify";
import { configure as stringifyConfigure } from "safe-stable-stringify";
// eslint-disable-next-line import/no-extraneous-dependencies
import stringLength                                    from "string-length";
import type { Primitive, UnknownArray, UnknownRecord } from "type-fest";

import { LOG_TYPES, RFC_5424_LOG_LEVELS } from "./constants";
import { InteractiveManager } from "./interactive/interactive-manager";
import { InteractiveStreamHook } from "./interactive/interactive-stream-hook";
import type {
    ConstructorOptions,
    DefaultLoggerTypes,
    DefaultLogTypes,
    LoggerConfiguration,
    LoggerFunction,
    LoggerTypesAwareReporter,
    LoggerTypesConfig,
    Meta,
    Processor,
    Reporter,
    Rfc5424LogLevels,
    StreamAwareReporter,
    StringifyAwareProcessor,
    StringifyAwareReporter,
    TimeEndResult,
} from "./types";
import { arrayify } from "./util/arrayify";
import { getLongestLabel } from "./util/get-longest-label";
import { getType } from "./util/get-type";
import { mergeTypes } from "./util/merge-types";
import { padEnd } from "./util/pad-end";

const EMPTY_META = {
    badge: undefined,
    context: undefined,
    error: undefined,
    label: undefined,
    message: undefined,
    prefix: undefined,
    repeated: undefined,
    scope: undefined,
    suffix: undefined,
};

class PailImpl<T extends string = never, L extends string = never> {
    protected timers: Map<string, number>;

    protected seqTimers: string[];

    readonly #lastLog: {
        count?: number;
        object?: Meta<L>;
        serialized?: string;
        time?: Date;
        timeout?: ReturnType<typeof setTimeout>;
    };

    readonly #customTypes: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;

    readonly #customLogLevels: Partial<Record<Rfc5424LogLevels, number>> & Record<L, number>;

    readonly #logLevels: Record<string, number>;

    #disabled: boolean;

    #scopeName: string[];

    readonly #types: DefaultLoggerTypes<L> & Record<T, Partial<LoggerConfiguration<L>>>;

    readonly #longestLabel: string;

    readonly #processors: Set<Processor<L>>;

    readonly #generalLogLevel: L | Rfc5424LogLevels;

    readonly #reporters: Set<Reporter<L>>;

    readonly #throttle: number;

    readonly #throttleMin: number;

    readonly #stdout: NodeJS.WriteStream | undefined;

    readonly #stderr: NodeJS.WriteStream | undefined;

    readonly #interactiveStdout: InteractiveStreamHook | undefined;

    readonly #interactiveStderr: InteractiveStreamHook | undefined;

    #interactiveManager: InteractiveManager | undefined;

    readonly #stringify: typeof stringify;

    readonly #interactive: boolean;

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public constructor(options: ConstructorOptions<T, L>) {
        this.#interactive = options.interactive ?? false;

        this.#stdout = options.stdout;
        this.#stderr = options.stderr;

        if (this.#interactive && options.stdout && options.stderr) {
            this.#interactiveStdout = new InteractiveStreamHook(options.stdout);
            this.#interactiveStderr = new InteractiveStreamHook(options.stderr);
        }

        this.#throttle = options.throttle ?? 1000;
        this.#throttleMin = options.throttleMin ?? 5;

        this.#stringify = stringifyConfigure({
            strict: true,
        });

        this.#customTypes = (options.types ?? {}) as LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;
        this.#types = mergeTypes<L, T>(LOG_TYPES, this.#customTypes);
        this.#longestLabel = getLongestLabel<L, T>(this.#types);

        this.#customLogLevels = (options.logLevels ?? {}) as Partial<Record<Rfc5424LogLevels, number>> & Record<L, number>;
        this.#logLevels = { ...RFC_5424_LOG_LEVELS, ...this.#customLogLevels };
        this.#generalLogLevel = this._normalizeLogLevel(options.logLevel);

        this.#reporters = new Set();

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const reporter of options.reporters ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if ((reporter as StreamAwareReporter<L>).setStdout && this.#stdout) {
                (reporter as StreamAwareReporter<L>).setStdout(this.#stdout);
            }

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if ((reporter as StreamAwareReporter<L>).setStderr && this.#stderr) {
                (reporter as StreamAwareReporter<L>).setStderr(this.#stderr);
            }

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if ((reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes) {
                (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes(this.#types);
            }

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if ((reporter as StringifyAwareReporter<L>).setStringify) {
                (reporter as StringifyAwareReporter<L>).setStringify(this.#stringify);
            }

            this.#reporters.add(reporter);
        }

        this.#processors = new Set();

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const processor of options.processors ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if ((processor as StringifyAwareProcessor<L>).setStringify) {
                (processor as StringifyAwareProcessor<L>).setStringify(this.#stringify);
            }

            this.#processors.add(processor as Processor<L>);
        }

        this.#disabled = options.disabled ?? false;

        this.#scopeName = arrayify(options.scope).filter(Boolean) as string[];

        this.timers = new Map();
        this.seqTimers = [];

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,guard-for-in
        for (const type in this.#types) {
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line security/detect-object-injection
            this[type] = this._logger.bind(this, type);
        }

        // Track of last log
        this.#lastLog = {};
    }

    public wrapAll(): void {
        this.wrapConsole();
        this.wrapStd();
    }

    public restoreAll(): void {
        this.restoreConsole();
        this.restoreStd();
    }

    public wrapConsole(): void {
        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const type in this.#types) {
            // Backup original value
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
            if (!(console as any)[`__${type}`]) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,security/detect-object-injection
                (console as any)[`__${type}`] = (console as any)[type];
            }
            // Override
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,security/detect-object-injection
            (console as any)[type] = (this as unknown as PailImpl<T, L>)[type as keyof PailImpl<T, L>].log;
        }
    }

    public restoreConsole(): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const type in this.#types) {
            // Restore if backup is available
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
            if ((console as any)[`__${type}`]) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,security/detect-object-injection
                (console as any)[type] = (console as any)[`__${type}`];

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,@typescript-eslint/no-dynamic-delete
                delete (console as any)[`__${type}`];
            }
        }
    }

    public wrapStd() {
        this._wrapStream(this.#stdout, "log");
        this._wrapStream(this.#stderr, "log");
    }

    public restoreStd() {
        this._restoreStream(this.#stdout);
        this._restoreStream(this.#stderr);
    }

    public wrapException(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.on("uncaughtException", (error: any) => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            (this as unknown as PailImpl<T, L>).error(error);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.on("unhandledRejection", (error: any) => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            (this as unknown as PailImpl<T, L>).error(error);
        });
    }

    /**
     * Disables logging
     */
    public disable(): void {
        this.#disabled = true;
    }

    /**
     * Enables logging
     */
    public enable(): void {
        this.#disabled = false;
    }

    public isEnabled(): boolean {
        return !this.#disabled;
    }

    public clone<N extends string = T, R extends PailType<N> = PailType<N>>(cloneOptions: ConstructorOptions<N, L>): R {
        const PailConstructor = PailImpl as unknown as new (options: ConstructorOptions<N, L>) => R;

        const newInstance = new PailConstructor({
            disabled: this.#disabled,
            interactive: this.#interactive,
            logLevel: this.#generalLogLevel,
            logLevels: this.#customLogLevels,
            processors: [...this.#processors],
            reporters: [...this.#reporters],
            stderr: this.#stderr,
            stdout: this.#stdout,
            throttle: this.#throttle,
            throttleMin: this.#throttleMin,
            types: this.#customTypes as LoggerTypesConfig<N, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>,
            ...cloneOptions,
        });

        newInstance.timers = new Map(this.timers.entries());
        newInstance.seqTimers = [...this.seqTimers];

        return newInstance;
    }

    public scope<R extends PailType<T> = PailType<T>>(...name: string[]): R {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        return this.clone({
            scope: name.flat(),
        });
    }

    public child<R extends PailType<T> = PailType<T>>(name: string): R {
        const newScope = new Set([...this.#scopeName, name]);

        return this.scope<R>(...newScope);
    }

    public unscope(): void {
        this.#scopeName = [];
    }

    public time(label?: string): string {
        if (!label) {
            // eslint-disable-next-line no-param-reassign
            label = `timer_${this.timers.size}`;

            this.seqTimers.push(label);
        }

        this.timers.set(label, Date.now());

        const meta = { ...EMPTY_META } as Meta<L>;

        meta.scope = this.#scopeName;
        meta.date = new Date();

        if (this.#types.start.badge) {
            // green
            meta.badge = padEnd(this.#types.start.badge, 2);
        }

        // green
        meta.label = `${label}${" ".repeat(this.#longestLabel.length - stringLength(label))}`;

        meta.message = "Initialized timer...";

        // @TODO
        // this.#log(messages.join(" "), this.#stream, "timer");

        return label;
    }

    public timeEnd(label?: string): TimeEndResult | undefined {
        if (!label && this.seqTimers.length > 0) {
            // eslint-disable-next-line no-param-reassign
            label = this.seqTimers.pop();
        }

        if (label && this.timers.has(label)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const span = Date.now() - this.timers.get(label)!;

            this.timers.delete(label);

            const meta = { ...EMPTY_META } as Meta<L>;

            meta.scope = this.#scopeName;
            meta.date = new Date();

            if (this.#types.stop.badge) {
                // red
                meta.badge = padEnd(this.#types.stop.badge, 2);
            }

            // red
            meta.label = padEnd(label, this.#longestLabel.length + 1);

            meta.message = "Timer run for:\n";
            // yellow
            meta.message += span < 1000 ? `${span}ms` : `${(span / 1000).toFixed(2)}s`;

            // this.#log(messages.join(" "), this.#stream, "timer");

            return { label, span };
        }

        return undefined;
    }

    public getInteractiveManager() {
        if (this.#interactiveManager) {
            return this.#interactiveManager;
        }

        if (this.#interactive && this.#interactiveStdout && this.#interactiveStderr) {
            this.#interactiveManager = new InteractiveManager(this.#interactiveStdout, this.#interactiveStderr);

            return this.#interactiveManager;
        }

        throw new Error("Interactive mode is disabled because you forgot to provide the interactive, stdout or stderr flag.");
    }

    private _wrapStream(stream: NodeJS.WriteStream | undefined, type: DefaultLogTypes | L) {
        if (!stream) {
            return;
        }

        // Backup original value
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
        if (!(stream as any).__write) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,no-param-reassign,@typescript-eslint/unbound-method
            (stream as any).__write = stream.write;
        }

        // Override
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,no-param-reassign
        (stream as any).write = (data: any): void => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,security/detect-object-injection
            (this as unknown as PailImpl)[type].log(String(data).trim());
        };
    }

    // eslint-disable-next-line class-methods-use-this
    private _restoreStream(stream?: NodeJS.WriteStream): void {
        if (!stream) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
        if ((stream as any).__write) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,no-param-reassign,@typescript-eslint/no-unsafe-assignment
            stream.write = (stream as any).__write;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,no-param-reassign
            delete (stream as any).__write;
        }
    }

    private _normalizeLogLevel(level: L | Rfc5424LogLevels | undefined): L | Rfc5424LogLevels {
        return level && Object.keys(this.#logLevels).includes(level) ? level : "debug";
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/no-explicit-any
    private _buildMeta(typeName: string, type: Partial<LoggerConfiguration<L>>, ...arguments_: any[]): Meta<L> {
        let meta = { ...EMPTY_META } as Meta<L>;

        meta.type = {
            level: type.logLevel as L | Rfc5424LogLevels,
            name: typeName,
        };

        meta.scope = this.#scopeName;
        meta.date = new Date();

        if (arguments_.length === 1 && typeof arguments_[0] === "object" && arguments_[0] !== null) {
            if (getType(arguments_[0]) === "Error") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,prefer-destructuring
                meta.error = arguments_[0];
            } else if ("message" in arguments_[0]) {
                const { context, message, prefix, suffix } = arguments_[0] as {
                    context?: Record<string, unknown>;
                    message: Primitive | unknown[] | undefined;
                    prefix?: string;
                    suffix?: string;
                };

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
            } else {
                meta.message = arguments_[0] as Primitive | UnknownArray | UnknownRecord;
            }
        } else {
            meta.message = arguments_;
        }

        if (type.logLevel === "trace") {
            // eslint-disable-next-line unicorn/error-message
            meta.error = new Error();
        }

        if (type.badge) {
            meta.badge = padEnd(type.badge, type.badge.length + 1);
        }

        if (type.label) {
            meta.label = type.label;
        }

        // Apply global processors
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const processor of this.#processors) {
            meta = { ...processor.process(meta) };
        }

        return meta;
    }

    /**
     * This is a simple, *insecure* hash that's short, fast.
     * For algorithmic use, where security isn't needed, it's way simpler than sha1 (and all its deps)
     * or similar, and with a short, clean (base 36 alphanumeric) result.
     *
     * @param {string} string_
     * @returns {string}
     * @private
     */
    // eslint-disable-next-line class-methods-use-this
    private _simpleHash(string_: string): string {
        let hash = 0;

        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let index = 0; index < string_.length; index++) {
            // eslint-disable-next-line no-bitwise
            hash = Math.trunc((hash << 5) - hash + (string_.codePointAt(index) as number));
        }

        // eslint-disable-next-line no-bitwise
        return (hash >>> 0).toString(36);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/no-explicit-any
    private _logger(type: T, ...messageObject: any[]): void {
        if (this.#disabled) {
            return;
        }

        // eslint-disable-next-line security/detect-object-injection
        const logLevel = this._normalizeLogLevel(this.#types[type].logLevel);

        // eslint-disable-next-line security/detect-object-injection
        if ((this.#logLevels[logLevel] as number) >= (this.#logLevels[this.#generalLogLevel] as number)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,security/detect-object-injection
            const meta = this._buildMeta(type, this.#types[type], ...messageObject);

            /**
             * @param newLog false if the throttle expired and we don't want to log a duplicate
             */
            const resolveLog = (newLog = false) => {
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                const repeated = (this.#lastLog.count || 0) - this.#throttleMin;

                if (this.#lastLog.object && repeated > 0) {
                    const lastMeta = { ...this.#lastLog.object };

                    if (repeated > 1) {
                        lastMeta.repeated = repeated;
                    }

                    this._report(lastMeta);

                    this.#lastLog.count = 1;
                }

                // Log
                if (newLog) {
                    this.#lastLog.object = meta;

                    this._report(meta);
                }
            };

            clearTimeout(this.#lastLog.timeout);

            const diffTime = this.#lastLog.time && meta.date ? new Date(meta.date).getTime() - this.#lastLog.time.getTime() : 0;

            this.#lastLog.time = new Date(meta.date);

            if (diffTime < this.#throttle) {
                try {
                    const serializedLog = this._simpleHash([meta.label, meta.scope, meta.type, meta.message, meta.prefix, meta.suffix].join(""));
                    const isSameLog = this.#lastLog.serialized === serializedLog;

                    this.#lastLog.serialized = serializedLog;

                    if (isSameLog) {
                        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                        this.#lastLog.count = (this.#lastLog.count || 0) + 1;

                        if (this.#lastLog.count > this.#throttleMin) {
                            // Auto-resolve when throttle is timed out
                            this.#lastLog.timeout = setTimeout(resolveLog, this.#throttle);

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

    private _report(meta: Meta<L>): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const reporter of this.#reporters) {
            reporter.log(meta);
        }
    }
}

export type PailType<T extends string = never, L extends string = never> = PailImpl<T, L> &
    Record<DefaultLogTypes, LoggerFunction> &
    Record<T, LoggerFunction> &
    (new<TC extends string = never, LC extends string = never>(options?: ConstructorOptions<TC, LC>) => PailType<TC, LC>);

export type PailConstructor<T extends string = never, L extends string = never> = new (options?: ConstructorOptions<T, L>) => PailType<T, L>;

// eslint-disable-next-line import/no-default-export
export default PailImpl as unknown as PailType;
