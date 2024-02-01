import type { stringify } from "safe-stable-stringify";
import { configure as stringifyConfigure } from "safe-stable-stringify";
import stringLength from "string-length";
import type { LiteralUnion, Primitive, UnknownArray, UnknownRecord } from "type-fest";

import { LOG_TYPES, RFC_5424_LOG_LEVELS } from "./constants";
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

export class PailBrowserImpl<T extends string = never, L extends string = never> {
    protected timers: Map<string, number>;

    protected seqTimers: string[];

    protected readonly _lastLog: {
        count?: number;
        object?: Meta<L>;
        serialized?: string;
        time?: Date;
        timeout?: ReturnType<typeof setTimeout>;
    };

    protected readonly _customTypes: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;

    protected readonly _customLogLevels: Partial<Record<Rfc5424LogLevels, number>> & Record<L, number>;

    protected readonly _logLevels: Record<string, number>;

    protected _disabled: boolean;

    protected _scopeName: string[];

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    protected readonly _types: DefaultLoggerTypes<L> & LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;

    protected readonly _longestLabel: string;

    protected readonly _processors: Set<Processor<L>>;

    protected readonly _generalLogLevel: LiteralUnion<Rfc5424LogLevels, L>;

    protected _reporters: Set<Reporter<L>>;

    protected readonly _throttle: number;

    protected readonly _throttleMin: number;

    protected readonly _stringify: typeof stringify;

    protected groups: string[] | undefined;

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public constructor(options: ConstructorOptions<T, L>) {
        this._throttle = options.throttle ?? 1000;
        this._throttleMin = options.throttleMin ?? 5;

        this._stringify = stringifyConfigure({
            strict: true,
        });

        this._customTypes = (options.types ?? {}) as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;
        this._types = mergeTypes<L, T>(LOG_TYPES, this._customTypes);
        this._longestLabel = getLongestLabel<L, T>(this._types);

        this._customLogLevels = (options.logLevels ?? {}) as Partial<Record<Rfc5424LogLevels, number>> & Record<L, number>;
        this._logLevels = { ...RFC_5424_LOG_LEVELS, ...this._customLogLevels };
        this._generalLogLevel = this._normalizeLogLevel(options.logLevel);

        this._reporters = new Set();

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const reporter of options.reporters ?? []) {
            if ((reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes) {
                (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes(this._types);
            }

            if ((reporter as StringifyAwareReporter<L>).setStringify) {
                (reporter as StringifyAwareReporter<L>).setStringify(this._stringify);
            }

            this._reporters.add(reporter);
        }

        this._processors = new Set();

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const processor of options.processors ?? []) {
            if ((processor as StringifyAwareProcessor<L>).setStringify) {
                (processor as StringifyAwareProcessor<L>).setStringify(this._stringify);
            }

            this._processors.add(processor as Processor<L>);
        }

        this._disabled = options.disabled ?? false;

        this._scopeName = arrayify(options.scope).filter(Boolean) as string[];

        this.timers = new Map();
        this.seqTimers = [];

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,guard-for-in
        for (const type in this._types) {
            // eslint-disable-next-line security/detect-object-injection
            this[type] = this._logger.bind(this, type as T);
        }

        // Track of last log
        this._lastLog = {};
    }

    public wrapConsole(): void {
        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const type in this._types) {
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
        for (const type in this._types) {
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
        this._disabled = true;
    }

    /**
     * Enables logging
     */
    public enable(): void {
        this._disabled = false;
    }

    public isEnabled(): boolean {
        return !this._disabled;
    }

    public clone<N extends string = T>(cloneOptions: ConstructorOptions<N, L>): PailBrowserType<N, L> {
        const PailConstructor = PailBrowserImpl as unknown as new (options: ConstructorOptions<N, L>) => PailBrowserType<N, L>;

        const newInstance = new PailConstructor({
            disabled: this._disabled,
            logLevel: this._generalLogLevel,
            logLevels: this._customLogLevels,
            processors: [...this._processors],
            reporters: [...this._reporters],
            throttle: this._throttle,
            throttleMin: this._throttleMin,
            types: this._customTypes as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, N>, L>,
            ...cloneOptions,
        });

        newInstance.timers = new Map(this.timers.entries());
        newInstance.seqTimers = [...this.seqTimers];

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
        const newScope = new Set([...this._scopeName, name]);

        return this.scope<N>(...newScope);
    }

    public unscope(): void {
        this._scopeName = [];
    }

    public time(label?: string): string {
        if (!label) {
            // eslint-disable-next-line no-param-reassign
            label = "timer_" + this.timers.size;

            this.seqTimers.push(label);
        }

        this.timers.set(label, Date.now());

        const meta = { ...EMPTY_META } as Meta<L>;

        meta.scope = this._scopeName;
        meta.date = new Date();

        if (this._types.start.badge) {
            // green
            meta.badge = padEnd(this._types.start.badge, 2);
        }

        // green
        meta.label = label + " ".repeat(this._longestLabel.length - stringLength(label));

        meta.message = "Initialized timer...";

        // @TODO
        // this._log(messages.join(" "), this._stream, "timer");

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

            meta.scope = this._scopeName;
            meta.date = new Date();

            if (this._types.stop.badge) {
                // red
                meta.badge = padEnd(this._types.stop.badge, 2);
            }

            // red
            meta.label = padEnd(label, this._longestLabel.length + 1);

            meta.message = "Timer run for:\n";
            // yellow
            meta.message += span < 1000 ? span + "ms" : (span / 1000).toFixed(2) + "s";

            // this._log(messages.join(" "), this._stream, "timer");

            return { label, span };
        }

        return undefined;
    }

    public group(label?: string): void {
        if (!Array.isArray(this.groups)) {
            this.groups = [];
        }

        this.groups.push(label ?? "console.group");
    }

    public groupEnd(): void {
        if (Array.isArray(this.groups)) {
            this.groups.pop();
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public clear(): void {
        // eslint-disable-next-line no-console
        console.clear();
    }

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    private _normalizeLogLevel(level: LiteralUnion<Rfc5424LogLevels, L> | undefined): LiteralUnion<Rfc5424LogLevels, L> {
        return level && Object.keys(this._logLevels).includes(level as string) ? level : "debug";
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/no-explicit-any
    private _buildMeta(typeName: string, type: Partial<LoggerConfiguration<L>>, ...arguments_: any[]): Meta<L> {
        let meta = { ...EMPTY_META } as Meta<L>;

        meta.type = {
            level: type.logLevel as LiteralUnion<Rfc5424LogLevels, L>,
            name: typeName,
        };

        meta.groups = this.groups;
        meta.scope = this._scopeName;
        meta.date = new Date();

        if (arguments_.length === 1 && typeof arguments_[0] === "object" && arguments_[0] !== null) {
            if (getType(arguments_[0]) === "Error") {
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
        for (const processor of this._processors) {
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
        if (this._disabled) {
            return;
        }

        // eslint-disable-next-line security/detect-object-injection
        const logLevel = this._normalizeLogLevel(this._types[type].logLevel);

        // eslint-disable-next-line security/detect-object-injection
        if ((this._logLevels[logLevel] as number) >= (this._logLevels[this._generalLogLevel] as number)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,security/detect-object-injection
            const meta = this._buildMeta(type, this._types[type], ...messageObject);

            /**
             * @param newLog false if the throttle expired and we don't want to log a duplicate
             */
            const resolveLog = (newLog = false) => {
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                const repeated = (this._lastLog.count || 0) - this._throttleMin;

                if (this._lastLog.object && repeated > 0) {
                    const lastMeta = { ...this._lastLog.object };

                    if (repeated > 1) {
                        lastMeta.repeated = repeated;
                    }

                    this._report(lastMeta);

                    this._lastLog.count = 1;
                }

                // Log
                if (newLog) {
                    this._lastLog.object = meta;

                    this._report(meta);
                }
            };

            clearTimeout(this._lastLog.timeout);

            const diffTime = this._lastLog.time && meta.date ? new Date(meta.date).getTime() - this._lastLog.time.getTime() : 0;

            this._lastLog.time = new Date(meta.date);

            if (diffTime < this._throttle) {
                try {
                    const serializedLog = this._simpleHash([meta.label, meta.scope, meta.type, meta.message, meta.prefix, meta.suffix].join(""));
                    const isSameLog = this._lastLog.serialized === serializedLog;

                    this._lastLog.serialized = serializedLog;

                    if (isSameLog) {
                        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                        this._lastLog.count = (this._lastLog.count || 0) + 1;

                        if (this._lastLog.count > this._throttleMin) {
                            // Auto-resolve when throttle is timed out
                            this._lastLog.timeout = setTimeout(resolveLog, this._throttle);

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
        for (const reporter of this._reporters) {
            reporter.log(Object.freeze(meta));
        }
    }
}

export type PailBrowserType<T extends string = never, L extends string = never> = PailBrowserImpl<T, L> &
    Record<DefaultLogTypes, LoggerFunction> &
    Record<T, LoggerFunction> &
    (new<TC extends string = never, LC extends string = never>(options?: ConstructorOptions<TC, LC>) => PailBrowserType<TC, LC>);

export type PailConstructor<T extends string = never, L extends string = never> = new (options?: ConstructorOptions<T, L>) => PailBrowserType<T, L>;

export const PailBrowser = PailBrowserImpl as unknown as PailBrowserType;
