import type { DefaultLoggerTypes } from "./types";

const rfc5424LogTypes: DefaultLoggerTypes = {
    alert: {
        color: "red",
        label: "alert",
        logLevel: "alert",
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
    note: {
        color: "blue",
        label: "note",
        logLevel: "notice",
    },
    warn: {
        color: "yellow",
        label: "warning",
        logLevel: "warning",
    },
};

/**
 * Log Levels
 * The log levels pail uses are those defined in the syslog protocol @see https://datatracker.ietf.org/doc/html/rfc5424#page-36, which are:
 */
export const LOG_LEVELS = {
    alert: 1, // action must be taken immediately
    critical: 2, // critical conditions
    debug: 7, //  debug-level messages
    emergency: 0, // system is unusable
    error: 3, // error conditions
    informational: 6, // informational messages
    notice: 5, // normal but significant condition
    warning: 4, // warning conditions
};

export const LOG_TYPES: DefaultLoggerTypes = {
    ...rfc5424LogTypes,
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
    log: {
        label: "",
        logLevel: "informational",
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
    wait: {
        color: "blue",
        label: "waiting",
        logLevel: "informational",
    },
    watch: {
        color: "yellow",
        label: "watching",
        logLevel: "informational",
    },
};
