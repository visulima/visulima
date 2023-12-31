import type { ColorName } from "chalk";
import type { Primitive, UnknownRecord } from "type-fest";

/**
 *  * This is a special exported interface for other packages/app to declare additional metadata for the logger.
 */
declare global {
    namespace VisulimaPail {
        // eslint-disable-next-line @typescript-eslint/no-empty-interface,@typescript-eslint/no-unused-vars
        interface CustomMeta<L> {}
    }
}

export interface Meta<L> extends VisulimaPail.CustomMeta<L> {
    badge: string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: Record<string, any> | undefined;
    date: Date | string;
    error: Error | undefined;
    label: string | undefined;
    message: Primitive | unknown[] | undefined;
    prefix: string | undefined;
    repeated?: number | undefined;
    scope: string[] | undefined;
    suffix: string | undefined;
    type: {
        level: L | Rfc5424LogLevels;
        name: string;
    };
}

export type Rfc5424LogLevels = "alert" | "critical" | "debug" | "emergency" | "error" | "informational" | "notice" | "warning";

export type DefaultLogTypes =
    | "alert"
    | "await"
    | "complete"
    | "critical"
    | "debug"
    | "emergency"
    | "error"
    | "info"
    | "log"
    | "notice"
    | "pending"
    | "start"
    | "stop"
    | "success"
    | "trace"
    | "wait"
    | "warn"
    | "watch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoggerFunction = (...message: any[]) => void;
// alias for backward-compatibility
export interface LoggerConfiguration<L extends string = never> {
    badge?: string;
    color?: ColorName | undefined;
    label: string;
    logLevel: L | Rfc5424LogLevels;
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

export interface StringifyAwareReporter<L extends string = never> extends Reporter<L> {
    setStringify: (stringify: typeof JSON.stringify) => void;
}

export interface Processor<L extends string = never> {
    process: (meta: Meta<L>) => Meta<L>;
}

export interface StringifyAwareProcessor<L extends string = never> extends Processor<L> {
    setStringify: (stringify: typeof JSON.stringify) => void;
}

export type Serializer<Type = string, Options = UnknownRecord> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isApplicable: (value: any) => boolean;
    name: string;
    options?: Options;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serialize: (value: any, options?: Options) => Type;
};

export interface ConstructorOptions<T extends string = never, L extends string = never> {
    disabled?: boolean;
    interactive?: boolean;
    logLevel?: L | Rfc5424LogLevels;
    logLevels?: Partial<Record<Rfc5424LogLevels, number>> & Record<L, number>;
    processors?: Processor<L>[];
    reporters?: Reporter<L>[];
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

export interface TimeEndResult {
    label: string;
    span: number;
}
