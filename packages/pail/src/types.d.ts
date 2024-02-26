import type { AnsiColors } from "@visulima/colorize";
import type { LiteralUnion, Primitive, UnknownArray, UnknownRecord } from "type-fest";

import type { InteractiveManager } from "./interactive/interactive-manager";

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
    context: any[] | Record<string, any> | undefined;
    date: Date | string;
    error: Error | undefined;
    groups: string[];
    label: string | undefined;
    message: Primitive | UnknownArray | UnknownRecord;
    prefix: string | undefined;
    repeated?: number | undefined;
    scope: string[] | undefined;
    suffix: string | undefined;
    traceError: Error | undefined; // for internal use
    type: {
        level: ExtendedRfc5424LogLevels | L;
        name: string;
    };
}

export type ExtendedRfc5424LogLevels = "alert" | "critical" | "debug" | "emergency" | "error" | "informational" | "notice" | "trace" | "warning";

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
    color?: AnsiColors | undefined;
    label: string;
    logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>;
}

export type LoggerTypesConfig<T extends string, L extends string = never> = Record<T, Partial<LoggerConfiguration<L>>>;
export type DefaultLoggerTypes<L extends string = never> = Record<DefaultLogTypes, LoggerConfiguration<L>>;

export type ReadonlyMeta<L extends string = never> = Readonly<Meta<L>>;

export interface Reporter<L extends string = never> {
    log: (meta: ReadonlyMeta<L>) => void;
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

export interface InteractiveStreamReporter<L extends string = never> extends StreamAwareReporter<L> {
    setInteractiveManager: (manager?: InteractiveManager) => void;
    setIsInteractive: (interactive: boolean) => void;
}

export interface Processor<L extends string = never> {
    process: (meta: Meta<L>) => Meta<L>;
}

export interface StringifyAwareProcessor<L extends string = never> extends Processor<L> {
    setStringify: (stringify: typeof JSON.stringify) => void;
}

export interface ConstructorOptions<T extends string = never, L extends string = never> {
    disabled?: boolean;
    logLevel?: LiteralUnion<ExtendedRfc5424LogLevels, L>;
    logLevels?: Partial<Record<ExtendedRfc5424LogLevels, number>> & Record<L, number>;
    messages?: {
        timerEnd?: string;
        timerStart?: string;
    };
    processors?: Processor<L>[];
    reporters?: Reporter<L>[];
    scope?: string[] | string;
    throttle?: number;
    throttleMin?: number;
    // we can't negate DefaultLogTypes from string
    // see https://github.com/microsoft/TypeScript/pull/29317 (not merged as for 31 march 2021)
    // so we can't distinguish logger configuration between default log types and passed one
    types?: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;
}

export interface ServerConstructorOptions<T extends string = never, L extends string = never> extends ConstructorOptions<T, L> {
    interactive?: boolean;
    stderr?: NodeJS.WriteStream;
    stdout?: NodeJS.WriteStream;
}
