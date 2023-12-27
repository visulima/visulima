import type { FormatterFunction } from "@visulima/fmt";
// eslint-disable-next-line import/no-extraneous-dependencies
import { build } from "@visulima/fmt";
import type { stringify } from "safe-stable-stringify";
import { configure as stringifyConfigure } from "safe-stable-stringify";
// eslint-disable-next-line import/no-extraneous-dependencies
import stringLength from "string-length";

import { LOG_LEVELS, LOG_TYPES } from "./constants";
import errorWithCauseSerializer from "./serializer/error/error-with-cause-serializer";
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
    Serializer,
    SerializerAwareReporter,
    StreamAwareReporter,
    StringifyAwareReporter,
    TimeEndResult,
} from "./types";
import arrayify from "./util/arrayify";
import getLongestLabel from "./util/get-longest-label";
import getType from "./util/get-type";
import mergeTypes from "./util/merge-types";
import padEnd from "./util/pad-end";

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

class PailImpl<T extends string = never, L extends string = never> implements Record<DefaultLogTypes, LoggerFunction> {
    protected timers: Map<string, number>;

    protected seqTimers: string[];

    private readonly _lastLog: {
        count?: number;
        object?: Meta<L>;
        serialized?: string;
        time?: Date;
        timeout?: ReturnType<typeof setTimeout>;
    };

    private readonly _customTypes: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;

    private readonly _customLogLevels: Partial<Record<Rfc5424LogLevels, number>> & Record<L, number>;

    private readonly _logLevels: Record<string, number>;

    private _disabled: boolean;

    private _scopeName: string[];

    private readonly _types: DefaultLoggerTypes<L> & Record<T, Partial<LoggerConfiguration<L>>>;

    private readonly _longestLabel: string;

    private readonly _processors: Set<Processor<L>>;

    private readonly _generalLogLevel: L | Rfc5424LogLevels;

    // TODO: Fix type in fmt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly _stringFormat: any;

    private readonly _reporters: Set<Reporter<L>>;

    private readonly _serializers: Map<string, Serializer>;

    private readonly _throttle: number;

    private readonly _throttleMin: number;

    private readonly _stdout: NodeJS.WriteStream | undefined;

    private readonly _stderr: NodeJS.WriteStream | undefined;

    private readonly _fmtFormatters: Record<string, FormatterFunction>;

    private readonly _stringify: typeof stringify;

    public constructor(options: ConstructorOptions<T, L>) {
        this._stdout = options.stdout;
        this._stderr = options.stderr;

        this._throttle = options.throttle ?? 1000;
        this._throttleMin = options.throttleMin ?? 5;

        this._fmtFormatters = options.fmt?.formatters ?? {};
        this._serializers = new Map([errorWithCauseSerializer, ...(options.serializers ?? [])].map((serializer) => [serializer.name, serializer]));

        this._stringify = stringifyConfigure({
            strict: true,
        });

        this._stringFormat = build({
            formatters: options.fmt?.formatters ?? {},
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stringify: (value: any) => {
                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,@typescript-eslint/naming-convention,@typescript-eslint/no-unused-vars
                for (const [_, serializer] of this._serializers) {
                    if (serializer.isApplicable(value)) {
                        return serializer.serialize(value);
                    }
                }

                return this._stringify(value);
            },
        });

        this._customTypes = (options.types ?? {}) as LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;
        this._types = mergeTypes<L, T>(LOG_TYPES, this._customTypes);
        this._longestLabel = getLongestLabel<L, T>(this._types);

        this._customLogLevels = (options.logLevels ?? {}) as Partial<Record<Rfc5424LogLevels, number>> & Record<L, number>;
        this._logLevels = { ...LOG_LEVELS, ...this._customLogLevels };
        this._generalLogLevel = this._normalizeLogLevel(options.logLevel);

        this._reporters = new Set(
            options.reporters?.map((reporter) => {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if ((reporter as StreamAwareReporter<L>).setStdout && this._stdout) {
                    (reporter as StreamAwareReporter<L>).setStdout(this._stdout);
                }

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if ((reporter as StreamAwareReporter<L>).setStderr && this._stderr) {
                    (reporter as StreamAwareReporter<L>).setStderr(this._stderr);
                }

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if ((reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes) {
                    (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes(this._types);
                }

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if ((reporter as SerializerAwareReporter<L>).setSerializers) {
                    (reporter as SerializerAwareReporter<L>).setSerializers(this._serializers);
                }

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if ((reporter as StringifyAwareReporter<L>).setStringify) {
                    (reporter as StringifyAwareReporter<L>).setStringify(this._stringify);
                }

                return reporter as Reporter<L>;
            }),
        );
        this._processors = new Set(options.processors ?? []);

        this._disabled = options.disabled ?? false;

        this._scopeName = arrayify(options.scope).filter(Boolean) as string[];

        this.timers = new Map();
        this.seqTimers = [];

        Object.keys(this._types).forEach((type) => {
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line security/detect-object-injection
            this[type] = this._logger.bind(this, type, false);
        });

        // @ts-expect-error - dynamic property
        this.raw = this._logger.bind(this, "log", true);

        // Track of last log
        this._lastLog = {};
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
        for (const type in this._types) {
            // Backup original value
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
            if (!(console as any)[`__${type}`]) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
                (console as any)[`__${type}`] = (console as any)[type];
            }
            // Override
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
            (console as any)[type] = (this as unknown as PailImpl<T, L>)[type as keyof PailImpl<T, L>].raw;
        }
    }

    public restoreConsole(): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const type in this._types) {
            // Restore if backup is available
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
            if ((console as any)[`__${type}`]) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
                (console as any)[type] = (console as any)[`__${type}`];

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,@typescript-eslint/no-dynamic-delete
                delete (console as any)[`__${type}`];
            }
        }
    }

    public wrapStd() {
        this._wrapStream(this._stdout, "log");
        this._wrapStream(this._stderr, "log");
    }

    public restoreStd() {
        this._restoreStream(this._stdout);
        this._restoreStream(this._stderr);
    }

    public wrapException(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.on("uncaughtException", (error: any) => {
            this.error(error);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.on("unhandledRejection", (error: any) => {
            this.error(error);
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

    public clone<N extends string = T, R extends PailType<N> = PailType<N>>(cloneOptions: ConstructorOptions<N>): R {
        const PailConstructor = PailImpl as unknown as new (options: ConstructorOptions<N>) => R;

        const newInstance = new PailConstructor({
            disabled: this._disabled,
            fmt: {
                formatters: this._fmtFormatters,
            },
            logLevel: this._generalLogLevel,
            logLevels: this._customLogLevels,
            processors: [...this._processors],
            serializers: [...this._serializers.values()],
            stderr: this._stderr,
            stdout: this._stdout,
            throttle: this._throttle,
            throttleMin: this._throttleMin,
            types: this._customTypes,
            ...cloneOptions,
        } as ConstructorOptions<N>);

        newInstance.timers = new Map(this.timers.entries());
        newInstance.seqTimers = [...this.seqTimers];

        return newInstance;
    }

    public scope<R extends PailType<T> = PailType<T>>(...name: string[]): R {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        return this.clone({
            reporters: [...this._reporters],
            scope: name.flat(),
        });
    }

    public child<R extends PailType<T> = PailType<T>>(name: string): R {
        const newScope = new Set([...this._scopeName, name]);

        return this.scope<R>(...newScope);
    }

    public unscope(): void {
        this._scopeName = [];
    }

    public time(label?: string): string {
        if (!label) {
            // eslint-disable-next-line no-param-reassign
            label = `timer_${this.timers.size}`;

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
        meta.label = `${label}${" ".repeat(this._longestLabel.length - stringLength(label))}`;

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
            meta.message += span < 1000 ? `${span}ms` : `${(span / 1000).toFixed(2)}s`;

            // this._log(messages.join(" "), this._stream, "timer");

            return { label, span };
        }

        return undefined;
    }

    private _wrapStream(stream: NodeJS.WriteStream | undefined, type: DefaultLoggerTypes<L>) {
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
            (this as unknown as PailImpl)[type].raw(String(data).trim());
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
        return level && Object.keys(this._logLevels).includes(level) ? level : "debug";
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _formatMessage(string_: any[]): string {
        // @TODO: fix this after types are fixed on fmt
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return this._stringFormat(...string_) as string;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/no-explicit-any
    private _buildMeta(typeName: string, type: Partial<LoggerConfiguration<L>>, ...arguments_: any[]): Meta<L> {
        let meta = { ...EMPTY_META } as Meta<L>;

        meta.type = {
            level: type.logLevel as L | Rfc5424LogLevels,
            name: typeName,
        };

        meta.scope = this._scopeName;
        meta.date = new Date();

        if (arguments_.length === 1 && typeof arguments_[0] === "object" && arguments_[0] !== null) {
            if (getType(arguments_[0]) === "Error") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,prefer-destructuring
                meta.error = arguments_[0];
            } else if ("message" in arguments_[0]) {
                const { context, message, prefix, suffix } = arguments_[0] as {
                    context?: Record<string, unknown>;
                    message: string;
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

                meta.message = this._formatMessage([message]);
            } else {
                meta.message = this._stringify(arguments_[0]);
            }
        } else {
            meta.message = this._formatMessage(arguments_);
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
            meta = { ...processor(meta) };
        }

        return meta;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/no-explicit-any
    private _logger(type: T, raw = false, ...messageObject: any[]): void {
        if (this._disabled) {
            return;
        }

        const logLevel = this._normalizeLogLevel(this._types[type].logLevel);

        // eslint-disable-next-line security/detect-object-injection
        if ((this._logLevels[logLevel] as number) >= (this._logLevels[this._generalLogLevel] as number)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
                    const serializedLog = this._stringify([
                        meta.label,
                        meta.scope,
                        meta.type,
                        meta.message,
                        meta.context,
                        meta.badge,
                        meta.prefix,
                        meta.suffix,
                    ]);
                    const isSameLog = this._lastLog.serialized === serializedLog;

                    this._lastLog.serialized = serializedLog;

                    if (isSameLog) {
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
            reporter.log(meta);
        }
    }
}

export type PailType<T extends string = never, L extends string = never> = PailImpl<T, L> &
    Record<DefaultLogTypes, LoggerFunction> &
    Record<T, LoggerFunction> &
    (new<TC extends string = never, LC extends string = never>(options?: ConstructorOptions<TC, LC>) => PailType<TC, LC>);

export type PailConstructor<T extends string = never, L extends string = never> = new (options?: ConstructorOptions<T, L>) => PailType<T, L>;

export default PailImpl as unknown as PailType;
