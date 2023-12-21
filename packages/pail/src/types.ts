import type { FormatterFunction } from "@visulima/fmt";
import type { ColorName } from "chalk";

declare global {
    namespace VisulimaPail {
        interface MetaOverrides<L> {}
    }
}

export interface Meta<L> extends VisulimaPail.MetaOverrides<L> {
    badge: string | undefined;
    date: Date | string;
    error: Error | undefined;
    context: Record<string, any> | undefined;
    file:
        | {
              line: number | undefined;
              name: string | undefined;
          }
        | undefined;
    label: string | undefined;
    message: string | undefined;
    prefix: string | undefined;
    scope: string[] | undefined;
    suffix: string | undefined;
    type: {
        level: L | DefaultLogLevels;
        name: string;
    };
    repeated?: number | undefined;
}

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

export type LoggerFunction = (...message: any[]) => void;

export type DefaultLogLevels = "debug" | "error" | "info" | "log" | "timer" | "warn";
// alias for backward-compatibility
export interface LoggerConfiguration<L extends string = never> {
    badge?: string;
    color: ColorName | "";
    label: string;
    logLevel: DefaultLogLevels | L;
}

export type LoggerTypesConfig<T extends string, L extends string = never> = Record<T, Partial<LoggerConfiguration<L>>>;
export type DefaultLoggerTypes<L extends string = never> = Record<DefaultLogTypes, LoggerConfiguration<L>>;

export interface Reporter<L extends string = never> {
    log: (meta: Meta<L>) => void;
}

export interface StreamAwareReporter<L extends string = never> extends Reporter<L> {
    setStderr: (stderr: NodeJS.WriteStream) => void;
    setStdout: (stdout: NodeJS.WriteStream) => void;
}

export interface LoggerTypesAwareReporter<T extends string = never, L extends string = never> extends Reporter<L> {
    setLoggerTypes: (types: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>) => void;
}

export interface SerializerAwareReporter<L extends string = never> extends Reporter<L> {
    setSerializers: (serializers: Map<string, Serializer>) => void;
}

export type Processor<L extends string = never> = (value: Meta<L>) => Meta<L>;

export type Serializer = {
    name: string;
    serialize: (value: any) => any;
    isApplicable: (value: any) => boolean;
};

export interface ConstructorOptions<T extends string = never, L extends string = never> {
    disabled?: boolean;
    fmt?: {
        formatters?: Record<string, FormatterFunction>;
    };
    logLevel?: DefaultLogLevels | L;
    logLevels?: Partial<Record<DefaultLogLevels, number>> & Record<L, number>;
    processors?: Processor<L>[];
    reporters?: Reporter<L>[];
    serializers?: Serializer[];
    scope?: string[] | string;
    stderr?: NodeJS.WriteStream;
    stdout?: NodeJS.WriteStream;
    throttle?: number;
    throttleMin?: number;
    // we can't negate DefaultLogTypes from string
    // see https://github.com/microsoft/TypeScript/pull/29317 (not merged as for 31 march 2021)
    // so we can't distinguish logger configuration between default log types and passed one
    types?: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;
}

export interface AdditionalFormatObject {
    context?: Record<string, any>;
    prefix?: string;
    suffix?: string;
}

export interface TimeEndResult {
    label: string;
    span: number;
}
