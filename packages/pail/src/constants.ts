import type { DefaultLoggerTypes } from "./types";

/**
 * Log Levels
 * The log levels pail uses are those defined in the syslog protocol @see https://datatracker.ietf.org/doc/html/rfc5424#page-36, which are:
 */
export const RFC_5424_LOG_LEVELS = {
    alert: 7, // Action must be taken immediately. Example: Entire website down, database unavailable, etc. This should trigger the SMS alerts and wake you up.
    critical: 6, // Critical conditions. Example: Application component unavailable, unexpected exception.
    debug: 1, // Detailed debug information.
    emergency: 8, // Emergency: system is unusable.
    error: 5, // Runtime errors that do not require immediate action but should typically be logged and monitored.
    informational: 2, // Interesting events. Examples: User logs in, SQL logs.
    notice: 3, // Normal but significant events.
    warning: 4, // Exceptional occurrences that are not errors. Examples: Use of deprecated APIs, poor use of an API, undesirable things that are not necessarily wrong.
};

export const LOG_TYPES: DefaultLoggerTypes = {
    alert: {
        color: "red",
        label: "alert",
        logLevel: "alert",
    },
    await: {
        color: "blue",
        label: "awaiting",
        logLevel: "informational",
    },
    complete: {
        color: "cyan",
        label: "complete",
        logLevel: "informational",
    },
    critical: {
        color: "red",
        label: "critical",
        logLevel: "critical",
    },
    debug: {
        color: "gray",
        label: "debug",
        logLevel: "debug",
    },
    emergency: {
        color: "red",
        label: "emergency",
        logLevel: "emergency",
    },
    error: {
        color: "red",
        label: "error",
        logLevel: "error",
    },
    info: {
        color: "blue",
        label: "info",
        logLevel: "informational",
    },
    log: {
        label: "",
        logLevel: "informational",
    },
    notice: {
        color: "blue",
        label: "notice",
        logLevel: "notice",
    },
    pending: {
        color: "magenta",
        label: "pending",
        logLevel: "informational",
    },
    start: {
        color: "green",
        label: "start",
        logLevel: "informational",
    },
    stop: {
        color: "yellow",
        label: "stop",
        logLevel: "informational",
    },
    success: {
        color: "green",
        label: "success",
        logLevel: "informational",
    },
    trace: {
        color: "magenta",
        label: "trace",
        logLevel: "trace",
    },
    wait: {
        color: "blue",
        label: "waiting",
        logLevel: "informational",
    },
    warn: {
        color: "yellow",
        label: "warning",
        logLevel: "warning",
    },
    watch: {
        color: "yellow",
        label: "watching",
        logLevel: "informational",
    },
};
