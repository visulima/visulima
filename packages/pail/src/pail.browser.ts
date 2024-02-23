import type { stringify } from "safe-stable-stringify";
import { configure as stringifyConfigure } from "safe-stable-stringify";
import type { LiteralUnion, Primitive, UnknownArray, UnknownRecord } from "type-fest";

import { EXTENDED_RFC_5424_LOG_LEVELS, LOG_TYPES } from "./constants";
import type {
    ConstructorOptions,
    DefaultLogTypes,
    ExtendedRfc5424LogLevels,
    LoggerConfiguration,
    LoggerFunction,
    LoggerTypesAwareReporter,
    LoggerTypesConfig,
    Meta,
    Processor,
    Reporter,
    StringifyAwareProcessor,
    StringifyAwareReporter,
} from "./types";
import { arrayify } from "./util/arrayify";
import { getLongestLabel } from "./util/get-longest-label";
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

export class PailBrowserImpl<T extends string = never, L extends string = never> {
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

    protected readonly customTypes: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;

    protected readonly customLogLevels: Partial<Record<ExtendedRfc5424LogLevels, number>> & Record<L, number>;

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

    public constructor(options: ConstructorOptions<T, L>) {
        this.throttle = options.throttle ?? 1000;
        this.throttleMin = options.throttleMin ?? 5;

        this.stringify = stringifyConfigure({
            strict: true,
        });

        this.startTimerMessage = options?.messages?.timerStart ?? "Initialized timer...";
        this.endTimerMessage = options?.messages?.timerEnd ?? "Timer run for:";
        this.customTypes = (options.types ?? {}) as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;
        this.types = mergeTypes<L, T>(LOG_TYPES, this.customTypes);
        this.longestLabel = getLongestLabel<L, T>(this.types);

        this.customLogLevels = (options.logLevels ?? {}) as Partial<Record<ExtendedRfc5424LogLevels, number>> & Record<L, number>;
        this.logLevels = { ...EXTENDED_RFC_5424_LOG_LEVELS, ...this.customLogLevels };
        this.generalLogLevel = this._normalizeLogLevel(options.logLevel);

        this.reporters = new Set();
        this.processors = new Set();

        this.disabled = options.disabled ?? false;

        this.scopeName = arrayify(options.scope).filter(Boolean) as string[];

        this.timersMap = new Map();
        this.countMap = new Map();

        this.groups = [];

        this.seqTimers = new Set();

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,guard-for-in
        for (const type in this.types) {
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line security/detect-object-injection
            this[type] = this._logger.bind(this, type as T);
        }

        // Track of last log
        this.lastLog = {};

        this.registerReporters(options?.reporters ?? []);

        this.registerProcessors(options?.processors ?? []);
    }

    public wrapConsole(): void {
        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const type in this.types) {
            // Backup original value
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!(console as any)["__" + type]) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any,security/detect-object-injection
                (console as any)["__" + type] = (console as any)[type];
            }
            // Override
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line @typescript-eslint/no-explicit-any,security/detect-object-injection
            (console as any)[type] = (this as unknown as PailBrowserImpl<T, L>)[type as keyof PailBrowserImpl<T, L>].log;
        }
    }

    public restoreConsole(): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const type in this.types) {
            // Restore if backup is available
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((console as any)["__" + type]) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any,security/detect-object-injection
                (console as any)[type] = (console as any)["__" + type];

                // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-dynamic-delete
                delete (console as any)["__" + type];
            }
        }
    }

    public wrapException(): void {
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

    public clone<N extends string = T>(cloneOptions: ConstructorOptions<N, L>): PailBrowserType<N, L> {
        const PailConstructor = PailBrowserImpl as unknown as new (options: ConstructorOptions<N, L>) => PailBrowserType<N, L>;

        const newInstance = new PailConstructor({
            disabled: this.disabled,
            logLevel: this.generalLogLevel,
            logLevels: this.customLogLevels,
            processors: [...this.processors],
            reporters: [...this.reporters],
            throttle: this.throttle,
            throttleMin: this.throttleMin,
            types: this.customTypes as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, N>, L>,
            ...cloneOptions,
        });

        newInstance.timersMap = new Map(this.timersMap.entries());
        newInstance.seqTimers = new Set(this.seqTimers.values());

        return newInstance;
    }

    public scope<N extends string = T>(...name: string[]): PailBrowserType<N, L> {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        return this.clone<N>({
            scope: name.flat(),
        });
    }

    public child<N extends string = T>(name: string): PailBrowserType<N, L> {
        const newScope = new Set(this.scopeName);

        newScope.add(name);

        return this.scope<N>(...newScope);
    }

    public unscope(): void {
        this.scopeName = [];
    }

    public time(label = "default"): void {
        if (this.seqTimers.has(label)) {
            const meta = { ...EMPTY_META } as Meta<L>;

            meta.scope = this.scopeName;
            meta.date = new Date();

            meta.message = "Timer '" + label + "' already exists";
            meta.prefix = label;

            this._logger("warn", meta);
        } else {
            this.seqTimers.add(label);
            this.timersMap.set(label, Date.now());

            const meta = { ...EMPTY_META } as Meta<L>;

            meta.scope = this.scopeName;
            meta.date = new Date();

            if (this.types.start.badge) {
                meta.badge = padEnd(this.types.start.badge, 2);
            }

            meta.prefix = label;
            meta.message = this.startTimerMessage;

            this._logger("start", meta);
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

            const meta = { ...EMPTY_META } as Meta<L>;

            meta.scope = this.scopeName;
            meta.date = new Date();

            if (this.types.stop.badge) {
                meta.badge = padEnd(this.types.stop.badge, 2);
            }

            meta.prefix = label;
            meta.message = span < 1000 ? span + " ms" : (span / 1000).toFixed(2) + " s";
            meta.context = data;

            this._logger("info", meta);
        } else {
            const meta = { ...EMPTY_META } as Meta<L>;

            meta.scope = this.scopeName;
            meta.date = new Date();

            meta.message = "Timer not found";
            meta.prefix = label;

            this._logger("warn", meta);
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

            const meta = { ...EMPTY_META } as Meta<L>;

            meta.scope = this.scopeName;
            meta.date = new Date();

            if (this.types.stop.badge) {
                meta.badge = padEnd(this.types.stop.badge, 2);
            }

            meta.prefix = label;
            meta.message = this.endTimerMessage + " ";
            meta.message += span < 1000 ? span + " ms" : (span / 1000).toFixed(2) + " s";

            this._logger("stop", meta);
        }
    }

    public group(label = "console.group"): void {
        if (typeof window === "undefined") {
            this.groups.push(label);
        } else {
            // eslint-disable-next-line no-console
            console.group(label);
        }
    }

    public groupEnd(): void {
        if (typeof window === "undefined") {
            this.groups.pop();
        } else {
            // eslint-disable-next-line no-console
            console.groupEnd();
        }
    }

    public count(label = "default"): void {
        const current = this.countMap.get(label) ?? 0;

        this.countMap.set(label, current + 1);

        const meta = { ...EMPTY_META } as Meta<L>;

        meta.scope = this.scopeName;
        meta.date = new Date();

        meta.prefix = label;
        meta.message = label + ": " + (current + 1);

        this._logger("log", meta);
    }

    public countReset(label = "default"): void {
        if (this.countMap.has(label)) {
            this.countMap.delete(label);
        } else {
            const meta = { ...EMPTY_META } as Meta<L>;

            meta.scope = this.scopeName;
            meta.date = new Date();

            if (this.types.warn.badge) {
                meta.badge = padEnd(this.types.warn.badge, 2);
            }

            meta.prefix = label;
            meta.message = "Count for " + label + " does not exist";

            this._logger("warn", meta);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public clear(): void {
        // eslint-disable-next-line no-console
        console.clear();
    }

    protected registerReporters(reporters: Reporter<L>[]): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const reporter of reporters) {
            if ((reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes) {
                (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes(this.types);
            }

            if ((reporter as StringifyAwareReporter<L>).setStringify) {
                (reporter as StringifyAwareReporter<L>).setStringify(this.stringify);
            }

            this.reporters.add(reporter);
        }
    }

    private registerProcessors(processors: Processor<L>[]): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const processor of processors) {
            if ((processor as StringifyAwareProcessor<L>).setStringify) {
                (processor as StringifyAwareProcessor<L>).setStringify(this.stringify);
            }

            this.processors.add(processor as Processor<L>);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    private _normalizeLogLevel(level: LiteralUnion<ExtendedRfc5424LogLevels, L> | undefined): LiteralUnion<ExtendedRfc5424LogLevels, L> {
        return level && Object.keys(this.logLevels).includes(level as string) ? level : "debug";
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/no-explicit-any
    private _buildMeta(typeName: string, type: Partial<LoggerConfiguration<L>>, ...arguments_: any[]): Meta<L> {
        let meta = { ...EMPTY_META } as Meta<L>;

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
            meta.badge = padEnd(type.badge, type.badge.length + 1);
        }

        if (type.label) {
            meta.label = type.label;
        }

        // Apply global processors
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const processor of this.processors) {
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
    private _logger(type: LiteralUnion<DefaultLogTypes, T>, ...messageObject: any[]): void {
        if (this.disabled) {
            return;
        }

        // eslint-disable-next-line security/detect-object-injection
        const logLevel = this._normalizeLogLevel(this.types[type].logLevel);

        // eslint-disable-next-line security/detect-object-injection
        if ((this.logLevels[logLevel] as number) >= (this.logLevels[this.generalLogLevel] as number)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,security/detect-object-injection
            const meta = this._buildMeta(type, this.types[type], ...messageObject);

            /**
             * @param newLog false if the throttle expired and we don't want to log a duplicate
             */
            const resolveLog = (newLog = false) => {
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                const repeated = (this.lastLog.count || 0) - this.throttleMin;

                if (this.lastLog.object && repeated > 0) {
                    const lastMeta = { ...this.lastLog.object };

                    if (repeated > 1) {
                        lastMeta.repeated = repeated;
                    }

                    this._report(lastMeta);

                    this.lastLog.count = 1;
                }

                if (newLog) {
                    this.lastLog.object = meta;

                    this._report(meta);
                }
            };

            clearTimeout(this.lastLog.timeout);

            const diffTime = this.lastLog.time && meta.date ? new Date(meta.date as Date | string).getTime() - this.lastLog.time.getTime() : 0;

            this.lastLog.time = new Date(meta.date as Date | string);

            if (diffTime < this.throttle) {
                try {
                    const serializedLog = this._simpleHash([meta.label, meta.scope, meta.type, meta.message, meta.prefix, meta.suffix].join(""));
                    const isSameLog = this.lastLog.serialized === serializedLog;

                    this.lastLog.serialized = serializedLog;

                    if (isSameLog) {
                        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
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

    private _report(meta: Meta<L>): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const reporter of this.reporters) {
            reporter.log(Object.freeze(meta));
        }
    }
}

export type PailBrowserType<T extends string = never, L extends string = never> = PailBrowserImpl<T, L> &
    Record<DefaultLogTypes, LoggerFunction> &
    Record<T, LoggerFunction> &
    (new <TC extends string = never, LC extends string = never>(options?: ConstructorOptions<TC, LC>) => PailBrowserType<TC, LC>);

export type PailConstructor<T extends string = never, L extends string = never> = new (options?: ConstructorOptions<T, L>) => PailBrowserType<T, L>;

export const PailBrowser = PailBrowserImpl as unknown as PailBrowserType;
