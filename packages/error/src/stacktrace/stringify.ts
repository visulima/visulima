import type { Trace } from "./types";

/**
 * Formats a single parsed stack frame to a standard "at ..." line.
 */
export const formatStackFrameLine = (frame: Trace): string => {
    const method = frame.methodName && frame.methodName !== "<unknown>" ? `${frame.methodName} ` : "";
    const file = frame.file ?? "<unknown>";
    const line = frame.line ?? 0;
    const column = frame.column ?? 0;

    // Prefer a consistent Node-style format: "    at method (file:line:column)"
    // If method is missing, omit the parentheses wrapper
    if (method.trim()) {
        return `    at ${method}(${file}:${line}:${column})`;
    }

    return `    at ${file}:${line}:${column}`;
};

/**
 * Turns an array of parsed stack frames into a stack string.
 * Optionally include the "ErrorName: message" header as the first line.
 */
export const formatStacktrace = (frames: Trace[], options?: { header?: { message?: string; name?: string } }): string => {
    const lines: string[] = [];

    if (options?.header && (options.header.name || options.header.message)) {
        const headerName = String(options.header.name || "Error");
        const headerMessage = String(options.header.message || "");

        lines.push(`${headerName}${headerMessage ? ": " : ""}${headerMessage}`);
    }

    for (const frame of frames) {
        lines.push(formatStackFrameLine(frame));
    }

    return lines.join("\n");
};
