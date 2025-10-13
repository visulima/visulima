import type { stringify } from "safe-stable-stringify";
import { configure as stringifyConfigure } from "safe-stable-stringify";
import type { LiteralUnion, Primitive } from "type-fest";

import { EMPTY_SYMBOL, EXTENDED_RFC_5424_LOG_LEVELS, LOG_TYPES } from "./constants";
import RawReporter from "./reporter/raw/raw.browser";
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

export class PailBrowserImpl<T extends string = string, L extends string = string> {
    protected timersMap: Map<string, number>;

    protected countMap: Map<string, number>;

    protected seqTimers: Set<string>;

    protected readonly lastLog: {
        count?: number;
        object?: Meta<L>;
        serialized?: string;
        time?: Date;
        timeout?: ReturnType<typeof setTimeout>;
    };

    protected readonly logLevels: Record<string, number>;

    protected disabled: boolean;

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
        this.generalLogLevel = this._normalizeLogLevel(options.logLevel);

        this.reporters = new Set();
        this.processors = new Set();

        this.disabled = options.disabled ?? false;

        this.scopeName = arrayify(options.scope).filter(Boolean) as string[];

        this.timersMap = new Map<string, number>();
        this.countMap = new Map<string, number>();

        this.groups = [];

        this.seqTimers = new Set();

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,guard-for-in
        for (const type in this.types) {
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line security/detect-object-injection
            this[type] = this._logger.bind(this, type as T, false);
        }

        // Track of last log
        this.lastLog = {};

        if (Array.isArray(options.reporters)) {
            this.registerReporters(options.reporters);
        }

        this.rawReporter = this.extendReporter(options.rawReporter ?? new RawReporter<L>());

        if (Array.isArray(options.processors)) {
            this.registerProcessors(options.processors);
        }
    }

    public wrapConsole(): void {
        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const type in this.types) {
            // Backup original value
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!(console as any)[`__${type}`]) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any,security/detect-object-injection
                (console as any)[`__${type}`] = (console as any)[type];
            }

            // Override
            // @TODO: Fix typings
            // eslint-disable-next-line @typescript-eslint/no-explicit-any,security/detect-object-injection
            (console as any)[type] = (this as unknown as PailBrowserImpl<T, L>)[type as keyof PailBrowserImpl<T, L>];
        }
    }

    public restoreConsole(): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const type in this.types) {
            // Restore if backup is available
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((console as any)[`__${type}`]) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any,security/detect-object-injection
                (console as any)[type] = (console as any)[`__${type}`];

                // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-dynamic-delete
                delete (console as any)[`__${type}`];
            }
        }
    }

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
     * Disables logging
     */
    public disable(): void {
        this.disabled = true;
    }

    /**
     * Enables logging
     */
    public enable(): void {
        this.disabled = false;
    }

    public isEnabled(): boolean {
        return !this.disabled;
    }

    public scope<N extends string = T>(...name: string[]): PailBrowserType<N, L> {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        this.scopeName = name.flat();

        return this as unknown as PailBrowserType<N, L>;
    }

    public unscope(): void {
        this.scopeName = [];
    }

    public time(label = "default"): void {
        if (this.seqTimers.has(label)) {
            this._logger("warn", false, {
                message: `Timer '${label}' already exists`,
                prefix: label,
            });
        } else {
            this.seqTimers.add(label);
            this.timersMap.set(label, Date.now());

            this._logger("start", false, {
                message: this.startTimerMessage,
                prefix: label,
            });
        }
    }

    public timeLog(label?: string, ...data: unknown[]): void {
        if (!label && this.seqTimers.size > 0) {
            // eslint-disable-next-line no-param-reassign
            label = [...this.seqTimers].pop();
        }

        if (label && this.timersMap.has(label)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const span = Date.now() - this.timersMap.get(label)!;

            this._logger("info", false, {
                context: data,
                message: span < 1000 ? `${span} ms` : `${(span / 1000).toFixed(2)} s`,
                prefix: label,
            });
        } else {
            this._logger("warn", false, {
                context: data,
                message: "Timer not found",
                prefix: label,
            });
        }
    }

    public timeEnd(label?: string): void {
        if (!label && this.seqTimers.size > 0) {
            // eslint-disable-next-line no-param-reassign
            label = [...this.seqTimers].pop();
        }

        if (label && this.timersMap.has(label)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const span = Date.now() - this.timersMap.get(label)!;

            this.timersMap.delete(label);

            this._logger("stop", false, {
                message: `${this.endTimerMessage} ${span < 1000 ? `${span} ms` : `${(span / 1000).toFixed(2)} s`}`,
                prefix: label,
            });
        } else {
            this._logger("warn", false, {
                message: "Timer not found",
                prefix: label,
            });
        }
    }

    public group(label = "console.group"): void {
        if (globalThis.window === undefined) {
            this.groups.push(label);
        } else {
            // eslint-disable-next-line no-console
            console.group(label);
        }
    }

    public groupEnd(): void {
        if (globalThis.window === undefined) {
            this.groups.pop();
        } else {
            // eslint-disable-next-line no-console
            console.groupEnd();
        }
    }

    public count(label = "default"): void {
        const current = this.countMap.get(label) ?? 0;

        this.countMap.set(label, current + 1);

        this._logger("log", false, {
            message: `${label}: ${current + 1}`,
            prefix: label,
        });
    }

    public countReset(label = "default"): void {
        if (this.countMap.has(label)) {
            this.countMap.delete(label);
        } else {
            this._logger("warn", false, {
                message: `Count for ${label} does not exist`,
                prefix: label,
            });
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public clear(): void {
        // eslint-disable-next-line no-console
        console.clear();
    }

    public raw(message: string, ...arguments_: unknown[]): void {
        if (this.disabled) {
            return;
        }

        this._logger("log", true, {
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
        // eslint-disable-next-line no-loops/no-loops
        for (const reporter of reporters) {
            this.reporters.add(this.extendReporter(reporter));
        }
    }

    private _report(meta: Meta<L>, raw: boolean): void {
        if (raw) {
            this.rawReporter.log(Object.freeze(meta));
        } else {
            // eslint-disable-next-line no-loops/no-loops
            for (const reporter of this.reporters) {
                reporter.log(Object.freeze(meta));
            }
        }
    }

    private registerProcessors(processors: Processor<L>[]): void {
        // eslint-disable-next-line no-loops/no-loops
        for (const processor of processors) {
            if (typeof (processor as StringifyAwareProcessor<L>).setStringify === "function") {
                (processor as StringifyAwareProcessor<L>).setStringify(this.stringify);
            }

            this.processors.add(processor as Processor<L>);
        }
    }

    private _normalizeLogLevel(level: LiteralUnion<ExtendedRfc5424LogLevels, L> | undefined): LiteralUnion<ExtendedRfc5424LogLevels, L> {
        // eslint-disable-next-line security/detect-object-injection
        return level && this.logLevels[level] ? level : "debug";
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/no-explicit-any
    private _buildMeta(typeName: string, type: Partial<LoggerConfiguration<L>>, ...arguments_: any[]): Meta<L> {
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

        if (arguments_.length === 1 && typeof arguments_[0] === "object" && arguments_[0] !== null) {
            if (arguments_[0] instanceof Error) {
                // eslint-disable-next-line prefer-destructuring
                meta.error = arguments_[0];
            } else if ("message" in arguments_[0]) {
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
            } else {
                meta.message = arguments_[0] as Primitive | ReadonlyArray<unknown> | Record<PropertyKey, unknown>;
            }
        } else if (arguments_.length > 1 && typeof arguments_[0] === "string") {
            meta.message = arguments_[0] as string;
            meta.context = arguments_.slice(1);
        } else {
            // eslint-disable-next-line prefer-destructuring
            meta.message = arguments_[0];
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

    // eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/no-explicit-any
    private _logger(type: LiteralUnion<DefaultLogTypes, T>, raw: boolean, ...messageObject: any[]): void {
        if (this.disabled) {
            return;
        }

        // eslint-disable-next-line security/detect-object-injection
        const logLevel = this._normalizeLogLevel(this.types[type].logLevel);

        // eslint-disable-next-line security/detect-object-injection
        if ((this.logLevels[logLevel] as number) >= (this.logLevels[this.generalLogLevel] as number)) {
            // eslint-disable-next-line security/detect-object-injection
            let meta = this._buildMeta(type, this.types[type], ...messageObject);

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

                    this._report(lastMeta, raw);

                    this.lastLog.count = 1;
                }

                if (newLog) {
                    // Apply global processors
                    // eslint-disable-next-line no-loops/no-loops
                    for (const processor of this.processors) {
                        meta = { ...processor.process(meta) };
                    }

                    this.lastLog.object = meta;

                    this._report(meta, raw);
                }
            };

            clearTimeout(this.lastLog.timeout);

            const diffTime = this.lastLog.time && meta.date ? new Date(meta.date as Date | string).getTime() - this.lastLog.time.getTime() : 0;

            this.lastLog.time = new Date(meta.date as Date | string);

            if (diffTime < this.throttle) {
                try {
                    const serializedLog = JSON.stringify([meta.label, meta.scope, meta.type, meta.message, meta.prefix, meta.suffix, meta.context]);
                    const isSameLog = this.lastLog.serialized === serializedLog;

                    this.lastLog.serialized = serializedLog;

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

export type PailBrowserType<T extends string = string, L extends string = string> = (new<TC extends string = string, LC extends string = string>(options?: ConstructorOptions<TC, LC>) => PailBrowserType<TC, LC>)
    & PailBrowserImpl<T, L>
    & Record<DefaultLogTypes, LoggerFunction>
    & Record<T, LoggerFunction>;

export type PailConstructor<T extends string = string, L extends string = string> = new (options?: ConstructorOptions<T, L>) => PailBrowserType<T, L>;

export const PailBrowser = PailBrowserImpl as unknown as PailBrowserType;
