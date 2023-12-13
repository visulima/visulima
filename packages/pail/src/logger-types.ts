import type { DefaultLoggerTypes } from "./types";

const logTypes: DefaultLoggerTypes = {
    alert: {
        color: "red",
        label: "alert",
        logLevel: "error",
    },
    await: {
        color: "blue",
        label: "awaiting",
        logLevel: "info",
    },
    complete: {
        color: "cyan",
        label: "complete",
        logLevel: "info",
    },
    debug: {
        color: "gray",
        label: "debug",
        logLevel: "debug",
    },
    error: {
        color: "red",
        label: "error",
        logLevel: "error",
    },
    fatal: {
        color: "red",
        label: "fatal",
        logLevel: "error",
    },
    info: {
        color: "blue",
        label: "info",
        logLevel: "info",
    },
    log: {
        color: "",
        label: "",
        logLevel: "info",
    },
    note: {
        color: "blue",
        label: "note",
        logLevel: "info",
    },
    pause: {
        color: "yellow",
        label: "pause",
        logLevel: "info",
    },
    pending: {
        color: "magenta",
        label: "pending",
        logLevel: "info",
    },
    start: {
        color: "green",
        label: "start",
        logLevel: "info",
    },
    success: {
        color: "green",
        label: "success",
        logLevel: "info",
    },
    wait: {
        color: "blue",
        label: "waiting",
        logLevel: "info",
    },
    warn: {
        color: "yellow",
        label: "warning",
        logLevel: "warn",
    },
    watch: {
        color: "yellow",
        label: "watching",
        logLevel: "info",
    },
};

export default logTypes;
