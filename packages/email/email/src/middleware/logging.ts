import type { EmailOptions } from "../types";
import type { Middleware } from "./types";

const redactAddress = (email: string): string => {
    const atIndex = email.indexOf("@");

    if (atIndex <= 0) {
        return "•••";
    }

    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);
    const head = local.slice(0, 1);

    return `${head}${"•".repeat(Math.max(1, local.length - 1))}@${domain}`;
};

const summarizeRecipients = (value: EmailOptions["to"], redact: boolean): string[] => {
    const list = Array.isArray(value) ? value : [value];

    return list.map((address) => {
        if (redact) {
            return redactAddress(address.email);
        }

        return address.email;
    });
};

/**
 * Options for the {@link loggingMiddleware}.
 */
export interface LoggingMiddlewareOptions {
    /**
     * The logger to write to.
     * @default console
     */
    logger?: Pick<Console, "error" | "info">;

    /**
     * Redact recipient addresses (e.g. `j••@example.com`) to keep PII out of logs.
     * @default true
     */
    redact?: boolean;
}

/**
 * Logs each send attempt and its outcome, redacting recipient PII by default.
 * @param options Logging configuration. See {@link LoggingMiddlewareOptions}.
 * @returns A middleware that logs sends and their results.
 */
export const loggingMiddleware = (options: LoggingMiddlewareOptions = {}): Middleware => {
    const { logger = console, redact = true } = options;

    return async (emailOptions, next) => {
        const recipients = summarizeRecipients(emailOptions.to, redact);

        // The subject often carries PII (names, order details); gate it behind the same redact flag.
        logger.info("[@visulima/email] sending", { subject: redact ? undefined : emailOptions.subject, to: recipients });

        const result = await next(emailOptions);

        if (result.success) {
            logger.info("[@visulima/email] sent", { messageId: result.data?.messageId, to: recipients });
        } else {
            // Log a sanitized error message rather than the raw error, which can embed the full payload.
            logger.error("[@visulima/email] send failed", { error: result.error instanceof Error ? result.error.message : result.error, to: recipients });
        }

        return result;
    };
};
