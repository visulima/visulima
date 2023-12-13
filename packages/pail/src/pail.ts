import { clearLine, cursorTo, moveCursor } from "node:readline";
import { Writable as WritableStream } from "node:stream";
import format from "quick-format-unescaped";

import dayjs from "dayjs";
import chalk from "chalk";
import stripAnsi from "strip-ansi";
import stringLength from "string-length";
import terminalSize from "terminal-size";
import wrapAnsi from "wrap-ansi";

import defaultTypes from "./logger-types";
import type {
    AdditionalFormatObject,
    ConstructorOptions,
    DefaultLoggerTypes,
    DefaultLogLevels,
    DefaultLogTypes,
    DisplayOptions,
    LoggerConfiguration,
    LoggerFunction,
    LoggerTypesConf as LoggerTypesConfig,
    ScopeFormatter,
    Secrets,
    StylesOptions,
    TimeEndResult,
} from "./types";
import padEnd from "./util/pad-end";
import mergeTypes from "./util/merge-types";
import arrayify from "./util/arrayify";
import getLongestLabel from "./util/get-longest-label";
import getCallerFilename from "./util/get-caller-filename";

type WriteStream = NodeJS.WriteStream;

const defaultLogLevels = {
    debug: 0,
    error: 4,
    info: 1,
    timer: 2,
    warn: 3,
};

const { green, grey, red, underline, yellow } = chalk;

let isPreviousLogInteractive = false;

const defaultScopeFormatter = (scopes: string[]): string => `[${scopes.join("::")}]`;

const barsScopeFormatter = (scopes: string[]): string => scopes.map((scope) => `[${scope}]`).join(" ");

class PailImpl<T extends string = never, L extends string = never> {
    static barsScopeFormatter: ScopeFormatter = barsScopeFormatter;

    private readonly _interactive: boolean;

    private readonly _display: DisplayOptions;

    private readonly _styles: StylesOptions;

    private readonly _customTypes: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;

    private readonly _customLogLevels: Partial<Record<DefaultLogLevels, number>> & Record<L, number>;

    private readonly _logLevels: Record<string, number>;

    private _disabled: boolean;

    private _scopeName: string[] | string;

    // eslint-disable-next-line @typescript-eslint/prefer-readonly
    protected timers: Map<string, number>;

    // eslint-disable-next-line @typescript-eslint/prefer-readonly
    protected seqTimers: string[];

    private readonly _types: DefaultLoggerTypes<L> & Record<T, Partial<LoggerConfiguration<L>>>;

    private readonly _stream: WritableStream | WritableStream[];

    private readonly _longestLabel: string;

    private _secrets: Secrets;

    private readonly _scopeFormatter: ScopeFormatter;

    private readonly _generalLogLevel: DefaultLogLevels | L;

    private readonly _dateFormat: string;
    private readonly _timestampFormat: string;
    private readonly _dayjs: typeof dayjs;

    public constructor(options: ConstructorOptions<T, L> = {}) {
        this._interactive = options.interactive ?? false;

        this._display = {
            badge: true,
            date: false,
            filename: false,
            label: true,
            scope: true,
            timestamp: false,
            ...options.display,
        };
        this._styles = {
            underline: {
                label: true,
                message: false,
                prefix: false,
                suffix: false,
                ...options.styles?.underline,
            },
            uppercase: {
                label: false,
                ...options.styles?.uppercase,
            },
            ...options.styles,
        };

        this._customTypes = (options.types ?? {}) as LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;
        this._customLogLevels = (options.logLevels ?? {}) as Partial<Record<DefaultLogLevels, number>> & Record<L, number>;
        this._logLevels = { ...defaultLogLevels, ...this._customLogLevels };
        this._disabled = options.disabled ?? false;
        this._scopeName = options.scope ?? "";
        this._scopeFormatter = options.scopeFormatter ?? defaultScopeFormatter;
        this.timers = new Map();
        this.seqTimers = [];
        this._types = mergeTypes<L, T>(defaultTypes, this._customTypes);
        this._stream = options.stream ?? process.stderr;
        this._longestLabel = getLongestLabel<L, T>(this._types);
        this._secrets = options.secrets ?? [];
        this._generalLogLevel = this._validateLogLevel(options.logLevel);

        this._dayjs = options.dayjs ?? dayjs;
        this._dateFormat = options.dateFormat ?? "YYYY-MM-DD";
        this._timestampFormat = options.timestampFormat ?? "HH:mm:ss";

        Object.keys(this._types).forEach((type) => {
            // @ts-expect-error
            this[type] = this._logger.bind(this, type);
        });
    }

    public get scopePath(): string[] {
        return arrayify(this._scopeName).filter((x) => x.length > 0);
    }

    public get currentOptions(): Omit<Required<ConstructorOptions<T, L>>, "scope"> {
        return {
            display: this._display,
            styles: this._styles,
            disabled: this._disabled,
            interactive: this._interactive,
            logLevel: this._generalLogLevel,
            logLevels: this._customLogLevels,
            scopeFormatter: this._scopeFormatter,
            secrets: this._secrets,
            stream: this._stream,
            types: this._customTypes,
            dateFormat: this._dateFormat,
            timestampFormat: this._timestampFormat,
            dayjs: this._dayjs,
        };
    }

    private _timeSpan(then: number): number {
        return Date.now() - then;
    }

    // eslint-disable-next-line class-methods-use-this
    private _validateLogLevel(level: DefaultLogLevels | L | undefined): DefaultLogLevels | L {
        return level && Object.keys(this._logLevels).includes(level) ? level : "debug";
    }

    private _filterSecrets(message: string): string {
        const { _secrets } = this;

        if (_secrets.length === 0) {
            return message;
        }

        let safeMessage = message;

        _secrets.forEach((secret) => {
            safeMessage = safeMessage.replaceAll(new RegExp(String(secret), "g"), "[secure]");
        });

        return safeMessage;
    }

    private _formatStream(stream: WritableStream | WritableStream[]): WritableStream[] {
        return arrayify(stream);
    }

    private _formatDate(): string {
        const date_ = new Date();

        return `[${this._dayjs(date_).format(this._dateFormat)}]`;
    }

    private _formatFilename(): string {
        return `[${getCallerFilename()}]`;
    }

    private _formatScopeName(): string {
        return this._scopeFormatter(this.scopePath);
    }

    private _formatTimestamp(): string {
        const date_ = new Date();

        return `[${this._dayjs(date_).format(this._timestampFormat)}]`;
    }

    private _formatMessage(string_: any[] | string): string {
        return format(...arrayify(string_));
    }

    private _meta(): string[] {
        const meta = [];

        if (this._display.date) {
            const formattedDate = this._formatDate();

            meta.push(formattedDate);
        }

        if (this._display.timestamp) {
            const formattedTimestamp = this._formatTimestamp();

            meta.push(formattedTimestamp);
        }

        if (this._display.filename) {
            const formattedFilename = this._formatFilename();

            meta.push(formattedFilename);
        }

        if (this.scopePath.length > 0 && this._display.scope) {
            const formattedScope = this._formatScopeName();

            meta.push(formattedScope);
        }

        if (meta.length > 0) {
            meta.push("›");

            return meta.map((item) => grey(item));
        }

        return meta;
    }

    private _hasAdditional({ prefix, suffix }: AdditionalFormatObject, arguments_: any[]): string {
        return suffix ?? prefix ? "" : this._formatMessage(arguments_);
    }

    private _buildPail(type: Partial<LoggerConfiguration<L>>, ...arguments_: any[]): string {
        const { columns } = terminalSize();
        let size = columns;

        if (typeof this._styles.messageLength === "number") {
            size = this._styles.messageLength;
        }

        let message_;
        let additional: AdditionalFormatObject = {};

        if (arguments_.length === 1 && typeof arguments_[0] === "object" && arguments_[0] !== null) {
            if (arguments_[0] instanceof Error) {
                [message_] = arguments_;
            } else {
                const [{ message, prefix, suffix }] = arguments_;

                additional = { prefix, suffix };

                message_ = message ? this._formatMessage(message) : this._hasAdditional(additional, arguments_);
            }
        } else {
            message_ = this._formatMessage(arguments_);
        }

        const messages = this._meta();

        if (additional.prefix) {
            if (this._styles?.underline.prefix) {
                messages.push(underline(additional.prefix));
            } else {
                messages.push(additional.prefix);
            }
        }

        const colorize = type.color ? chalk[type.color] : chalk.white;

        if (this._display.badge && type.badge) {
            const badge = padEnd(type.badge, type.badge.length + 1);

            messages.push(colorize(badge));
        }

        if (this._display.label && type.label) {
            const label = this._styles?.uppercase.label ? type.label.toUpperCase() : type.label;
            const longestLabelLength = stringLength(this._longestLabel) + 1;
            const labelLength = stringLength(label);

            if (this._styles?.underline.label) {
                messages.push(colorize(`${underline(label)}${" ".repeat(longestLabelLength - labelLength)}`));
            } else {
                messages.push(colorize(`${label}${" ".repeat(longestLabelLength - labelLength)}`));
            }
        }

        const charLength = stringLength(messages.join(" "));
        const suffix: string[] = [];

        let suffixCharLength = 0;

        if (additional.suffix) {
            if (this._styles?.underline.suffix) {
                suffix.push(chalk.grey(underline(additional.suffix)));
            } else {
                suffix.push(chalk.grey(additional.suffix));
            }

            suffixCharLength += stringLength(additional.suffix);
        }

        size -= charLength + messages.length + suffixCharLength + suffix.length;

        if (message_ instanceof Error && message_.stack) {
            const [name, ...rest] = message_.stack.split("\n");

            if (this._styles?.underline.message) {
                messages.push(underline(name));
            } else {
                messages.push(name as string);
            }

            messages.push(grey(rest.map((l) => l.replace(/^/, "\n")).join("")));
        } else {
            if (this._styles?.underline.message) {
                messages.push(underline(message_));
            } else {
                messages.push(message_);
            }
        }

        const wrappedMessages = messages
            .map((message) => {
                const wrappedMessage = wrapAnsi(message, size, {
                    hard: false,
                    trim: false,
                    wordWrap: true,
                });

                if (wrappedMessage.includes("\n")) {
                    const [firstLine, ...rest] = wrappedMessage.split("\n");

                    return `${firstLine}\n${rest.map((l) => `${" ".repeat(charLength + 1)}${l}`).join("\n")}`;
                }

                return wrappedMessage;
            })
            .join(" ");

        if (suffix.length > 0) {
            return wrappedMessages + " " + suffix.join(" ");
        }

        return wrappedMessages;
    }

    private _write(stream: WritableStream | WriteStream, message: string) {
        const isTTY: boolean = (stream as WriteStream).isTTY ?? false;

        if (this._interactive && isTTY && isPreviousLogInteractive) {
            moveCursor(stream, 0, -1);
            clearLine(stream, 0);
            cursorTo(stream, 0);
        }

        if (stream instanceof WritableStream) {
            if (isTTY) {
                stream.write(`${message}\n`);
            } else {
                stream.write(`${stripAnsi(message)}\n`);
            }
        } else if (isTTY) {
            stream.write(`${message}\n`);
        } else {
            stream.write(`${stripAnsi(message)}\n`);
        }

        isPreviousLogInteractive = this._interactive;
    }

    private _log(message: string, streams: WritableStream | WritableStream[] = this._stream, logLevel: string) {
        if (this.isEnabled() && (this._logLevels[logLevel] as number) >= (this._logLevels[this._generalLogLevel] as number)) {
            this._formatStream(streams).forEach((stream) => {
                this._write(stream, message);
            });
        }
    }

    private _logger(type: T, ...messageObject: any[]) {
        const { logLevel, stream } = this._types[type];
        const message = this._buildPail(this._types[type], ...messageObject);

        this._log(this._filterSecrets(message), stream, this._validateLogLevel(logLevel));
    }

    public addSecrets(secrets: Secrets): void {
        if (!Array.isArray(secrets)) {
            throw new TypeError("Argument must be an array.");
        }

        this._secrets.push(...secrets);
    }

    public clearSecrets(): void {
        this._secrets = [];
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

    public clone<N extends string = T, R extends PailType<N> = PailType<N>>(options: ConstructorOptions<N>): R {
        const PailConstructor = PailImpl as unknown as new (options: ConstructorOptions<N>) => R;
        const newInstance = new PailConstructor({ ...this.currentOptions, ...options } as ConstructorOptions<N>);

        newInstance.timers = new Map(this.timers.entries());
        newInstance.seqTimers = [...this.seqTimers];

        return newInstance;
    }

    public scope<R extends PailType<T> = PailType<T>>(...name: string[]): R {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        return this.clone({
            scope: name,
        });
    }

    public child<R extends PailType<T> = PailType<T>>(name: string): R {
        const newScope = this.scopePath.concat(name);

        return this.scope<R>(...newScope);
    }

    public unscope(): void {
        this._scopeName = "";
    }

    public time(label?: string): string {
        if (!label) {
            label = `timer_${this.timers.size}`;
            this.seqTimers.push(label);
        }

        this.timers.set(label, Date.now());

        const messages = this._meta();

        if (this._types.start.badge) {
            messages.push(green(padEnd(this._types.start.badge, 2)));
        }

        if (this._styles?.underline.label) {
            messages.push(green(padEnd(underline(label), underline(this._longestLabel).length + 1)));
        } else {
            messages.push(green(padEnd(label, this._longestLabel.length + 1)));
        }

        messages.push("Initialized timer...");

        this._log(messages.join(" "), this._stream, "timer");

        return label;
    }

    public timeEnd(label?: string): TimeEndResult | undefined {
        if (!label && this.seqTimers.length > 0) {
            label = this.seqTimers.pop();
        }

        if (label && this.timers.has(label)) {
            const span = this._timeSpan(this.timers.get(label)!);
            this.timers.delete(label);

            const messages = this._meta();

            if (this._types.pause.badge) {
                messages.push(red(padEnd(this._types.pause.badge, 2)));
            }

            if (this._styles?.underline.label) {
                messages.push(red(padEnd(underline(label), underline(this._longestLabel).length + 1)));
            } else {
                messages.push(red(padEnd(label, this._longestLabel.length + 1)));
            }

            messages.push("Timer run for:");
            messages.push(yellow(span < 1000 ? `${span}ms` : `${(span / 1000).toFixed(2)}s`));

            this._log(messages.join(" "), this._stream, "timer");

            return { label, span };
        }

        return undefined;
    }
}

export type PailType<T extends string = never, L extends string = never> = PailImpl<T, L> &
    Record<DefaultLogTypes, LoggerFunction> &
    Record<T, LoggerFunction> &
    (new <T extends string = never, L extends string = never>(options?: ConstructorOptions<T, L>) => PailType<T, L>);

export type PailConstructor<T extends string = never, L extends string = never> = new (options?: ConstructorOptions<T, L>) => PailType<T, L>;

export default PailImpl as unknown as PailType;
