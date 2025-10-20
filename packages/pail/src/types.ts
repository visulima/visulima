import type { AnsiColors } from "@visulima/colorize";
import type { LiteralUnion, Primitive } from "type-fest";

import type InteractiveManager from "./interactive/interactive-manager";

/**
 * Global namespace for extending Pail's metadata interface.
 *
 * This global declaration allows other packages and applications to extend
 * the Meta interface with custom properties by declaring additional properties
 * in the VisulimaPail.CustomMeta interface.
 * @example
 * ```typescript
 * declare global {
 *   namespace VisulimaPail {
 *     interface CustomMeta<L> {
 *       userId?: string;
 *       requestId?: string;
 *     }
 *   }
 * }
 * ```
 */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace VisulimaPail {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
        interface CustomMeta<L> {}
    }
}

/**
 * Metadata object containing all information about a log entry.
 *
 * This interface defines the structure of metadata that is passed to reporters
 * and processors. It contains all the contextual information about a log message
 * including the message itself, timing information, error details, and more.
 * @template L - The log level type
 */
export interface Meta<L> extends VisulimaPail.CustomMeta<L> {
    badge: string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any[] | undefined;
    date: Date | string;
    error: Error | undefined;
    groups: string[];
    label: string | undefined;

    message: Primitive | ReadonlyArray<unknown> | Record<PropertyKey, unknown>;
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

/**
 * Extended RFC 5424 Log Levels.
 *
 * Standard syslog severity levels as defined in RFC 5424, plus additional
 * levels commonly used in modern applications. Each level has a numeric
 * priority where lower numbers indicate higher severity.
 * @see https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1
 */
export type ExtendedRfc5424LogLevels = "alert" | "critical" | "debug" | "emergency" | "error" | "informational" | "notice" | "trace" | "warning";

/**
 * Default Log Types.
 *
 * Predefined semantic log types that provide meaningful categorization
 * for different kinds of log messages. Each type has associated styling
 * and log level configuration.
 */
export type DefaultLogTypes
    = | "alert"
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
        | "warning"
        | "watch";

/**
 * Logger Function Type.
 *
 * Represents a logging function that can accept either a structured Message object
 * or multiple arguments in the traditional console.log style.
 */
export interface LoggerFunction {
    (message: Message): void;

    (...message: any[]): void;
}

/**
 * Logger Configuration.
 *
 * Configuration object that defines how a specific logger type should behave,
 * including its visual appearance and log level.
 * @template L - The log level type
 */
export interface LoggerConfiguration<L extends string> {
    badge?: string;

    color?: AnsiColors | undefined;
    label: string;
    logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>;
}

/**
 * Logger Types Configuration.
 *
 * A record mapping logger type names to their configurations.
 * @template T - Custom logger type names
 * @template L - Log level types
 */
export type LoggerTypesConfig<T extends string, L extends string> = Record<T, Partial<LoggerConfiguration<L>>>;

/**
 * Default Logger Types Configuration.
 *
 * A complete mapping of all default log types to their full configurations.
 * @template L - Log level types
 */
export type DefaultLoggerTypes<L extends string = string> = Record<DefaultLogTypes, LoggerConfiguration<L>>;

/**
 * Read-only Metadata.
 *
 * Immutable version of the Meta interface for use in reporters.
 * @template L - The log level type
 */
export type ReadonlyMeta<L extends string> = Readonly<Meta<L>>;

/**
 * Reporter Interface.
 *
 * Base interface for all reporters. Reporters are responsible for
 * outputting log messages to various destinations (console, files, etc.).
 * @template L - The log level type
 */
export interface Reporter<L extends string> {
    log: (meta: ReadonlyMeta<L>) => void;
}

/**
 * Stream-Aware Reporter Interface.
 *
 * Extends Reporter with the ability to work with Node.js streams.
 * Used for server-side reporters that need to write to stdout/stderr.
 * @template L - The log level type
 */
export interface StreamAwareReporter<L extends string> extends Reporter<L> {
    /** Set the stderr stream for error output */
    setStderr: (stderr: NodeJS.WriteStream) => void;

    /** Set the stdout stream for standard output */
    setStdout: (stdout: NodeJS.WriteStream) => void;
}

/**
 * Logger Types Aware Reporter Interface.
 *
 * Extends Reporter with the ability to receive logger type configurations.
 * Allows reporters to customize their output based on logger types.
 * @template T - Custom logger type names
 * @template L - The log level type
 */
export interface LoggerTypesAwareReporter<T extends string, L extends string> extends Reporter<L> {
    /** Set the logger types configuration */
    setLoggerTypes: (types: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>) => void;
}

/**
 * Stringify-Aware Reporter Interface.
 *
 * Extends Reporter with the ability to receive a custom stringify function.
 * Useful for reporters that need to serialize complex objects.
 * @template L - The log level type
 */
export interface StringifyAwareReporter<L extends string> extends Reporter<L> {
    /** Set the stringify function for object serialization */
    setStringify: (stringify: typeof JSON.stringify) => void;
}

/**
 * Interactive Stream Reporter Interface.
 *
 * Extends StreamAwareReporter with interactive capabilities for terminal UIs.
 * Supports features like progress bars and dynamic updates.
 * @template L - The log level type
 */
export interface InteractiveStreamReporter<L extends string> extends StreamAwareReporter<L> {
    /** Set the interactive manager for handling interactive output */
    setInteractiveManager: (manager?: InteractiveManager) => void;

    /** Enable or disable interactive mode */
    setIsInteractive: (interactive: boolean) => void;
}

/**
 * Processor Interface.
 *
 * Base interface for all processors. Processors can modify or enhance
 * log metadata before it reaches reporters.
 * @template L - The log level type
 */
export interface Processor<L extends string> {
    /** Process the log metadata */
    process: (meta: Meta<L>) => Meta<L>;
}

/**
 * Stringify-Aware Processor Interface.
 *
 * Extends Processor with the ability to receive a custom stringify function.
 * Useful for processors that need to serialize complex objects.
 * @template L - The log level type
 */
export interface StringifyAwareProcessor<L extends string> extends Processor<L> {
    /** Set the stringify function for object serialization */
    setStringify: (stringify: typeof JSON.stringify) => void;
}

export interface ConstructorOptions<T extends string, L extends string> {
    disabled?: boolean;
    logLevel?: LiteralUnion<ExtendedRfc5424LogLevels, L>;
    logLevels?: Partial<Record<ExtendedRfc5424LogLevels, number>> & Record<L, number>;
    messages?: {
        timerEnd?: string;
        timerStart?: string;
    };
    processors?: Processor<L>[];
    rawReporter?: Reporter<L>;
    reporters?: Reporter<L>[];
    scope?: string[] | string;
    throttle?: number;
    throttleMin?: number;
    // we can't negate DefaultLogTypes from string
    // see https://github.com/microsoft/TypeScript/pull/29317 (not merged as for 31 march 2021)
    // so we can't distinguish logger configuration between default log types and passed one
    types?: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;
}

export interface ServerConstructorOptions<T extends string, L extends string> extends ConstructorOptions<T, L> {
    interactive?: boolean;
    stderr: NodeJS.WriteStream;
    stdout: NodeJS.WriteStream;
}

export type Message = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context?: any[] | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: any;
    prefix?: string;
    suffix?: string;
};
