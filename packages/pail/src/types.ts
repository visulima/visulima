import type { Writable as WritableStream } from "node:stream";

import type { ColorName } from "chalk";
import dayjs from "dayjs";

export type DefaultLogTypes =
    | "alert"
    | "await"
    | "complete"
    | "debug"
    | "error"
    | "fatal"
    | "info"
    | "log"
    | "note"
    | "pause"
    | "pending"
    | "start"
    | "success"
    | "wait"
    | "warn"
    | "watch";

export type Secrets = (number | string)[];

export type LoggerFunction = (...message: any[]) => void;

export type DefaultLogLevels = "debug" | "error" | "info" | "timer" | "warn";
// alias for backward-compatibility
export type LogLevel = DefaultLogLevels;

export interface LoggerConfiguration<L extends string = never> {
    badge?: string;
    color: ColorName | "";
    label: string;
    logLevel?: DefaultLogLevels | L;
    stream?: WritableStream | WritableStream[];
}

export type LoggerTypesConf<T extends string, L extends string = never> = Record<T, Partial<LoggerConfiguration<L>>>;
export type DefaultLoggerTypes<L extends string = never> = Record<DefaultLogTypes, LoggerConfiguration<L>>;

export type ScopeFormatter = (scopePath: string[]) => string;

export type DisplayOptions = {
    badge: boolean;
    date: boolean;
    filename: boolean;
    label: boolean;
    scope: boolean;
    timestamp: boolean;
};

export type StylesOptions = {
    underline: Partial<{
        label: boolean;
        message: boolean;
        prefix: boolean;
        suffix: boolean;
    }>;
    uppercase: Partial<{
        label: boolean;
    }>;
    // Length of the message before a line break is inserted
    messageLength?: number | undefined;
};

export interface ConstructorOptions<T extends string = never, L extends string = never> {
    display?: Partial<DisplayOptions>;
    styles?: Partial<StylesOptions>;
    disabled?: boolean;
    interactive?: boolean;
    logLevel?: DefaultLogLevels | L;
    logLevels?: Partial<Record<DefaultLogLevels, number>> & Record<L, number>;
    scope?: string[] | string;
    scopeFormatter?: ScopeFormatter;
    dayjs?: typeof dayjs;
    dateFormat?: string;
    timestampFormat?: string;
    secrets?: Secrets;
    stream?: WritableStream | WritableStream[];
    // we can't negate DefaultLogTypes from string
    // see https://github.com/microsoft/TypeScript/pull/29317 (not merged as for 31 march 2021)
    // so we can't distinguish logger configuration between default log types and passed one
    types?: LoggerTypesConf<T, L> & Partial<LoggerTypesConf<DefaultLogTypes, L>>;
}

export interface AdditionalFormatObject {
    prefix?: string;
    suffix?: string;
}

export interface TimeEndResult {
    label: string;
    span: number;
}
