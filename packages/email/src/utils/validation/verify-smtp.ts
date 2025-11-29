import { Socket } from "node:net";

import type { Cache } from "../cache";
import type { MxCheckResult, MxRecord } from "./check-mx-records";
import { checkMxRecords } from "./check-mx-records";

/**
 * Options for SMTP verification.
 */
export interface SmtpVerificationOptions {
    cache?: Cache<MxCheckResult>;
    fromEmail?: string;
    port?: number;
    smtpCache?: Cache<SmtpVerificationResult>;
    timeout?: number;
    ttl?: number;
}

/**
 * Detailed result of SMTP verification attempt.
 */
export interface SmtpVerificationResult {
    error?: string;
    mxRecords?: MxRecord[];
    smtpResponse?: string;
    valid: boolean;
}

/**
 * Verifies an email address by checking MX records and attempting SMTP verification.
 * Note: Many mail servers block SMTP verification to prevent email harvesting.
 * @param email The email address to verify.
 * @param options Verification options.
 * @returns Result containing verification status.
 * @example
 * ```ts
 * import { verifySmtp } from "@visulima/email/validation/verify-smtp";
 *
 * const result = await verifySmtp("user@example.com", {
 *     timeout: 5000,
 *     fromEmail: "test@example.com"
 * });
 * ```
 */
export const verifySmtp = async (email: string, options: SmtpVerificationOptions = {}): Promise<SmtpVerificationResult> => {
    const { fromEmail = "test@example.com", port = 25, timeout = 5000, ttl = 3_600_000 } = options;

    if (!email || typeof email !== "string") {
        return {
            error: "Invalid email address",
            valid: false,
        };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const atIndex = normalizedEmail.indexOf("@");

    if (atIndex === -1 || atIndex === normalizedEmail.length - 1) {
        return {
            error: "Invalid email format",
            valid: false,
        };
    }

    const { smtpCache } = options;
    const cacheKey = `smtp:${normalizedEmail}:${fromEmail}:${port}`;

    if (smtpCache) {
        const cached = await smtpCache.get(cacheKey);

        if (cached !== undefined) {
            return cached;
        }
    }

    const domain = normalizedEmail.slice(atIndex + 1);

    const mxCache = options.cache as Cache<MxCheckResult> | undefined;

    const mxCheck = await checkMxRecords(domain, {
        cache: mxCache,
    });

    if (!mxCheck.valid || !mxCheck.records || mxCheck.records.length === 0) {
        const result: SmtpVerificationResult = {
            error: mxCheck.error || "No MX records found",
            mxRecords: mxCheck.records,
            valid: false,
        };

        if (smtpCache) {
            await smtpCache.set(cacheKey, result, ttl);
        }

        return result;
    }

    const mxRecord = mxCheck.records[0];

    return new Promise((resolve) => {
        const socket = new Socket();
        let response = "";
        let state: "connected" | "helo" | "mail-from" | "rcpt-to" = "connected";

        const cleanup = (): void => {
            socket.removeAllListeners();
            socket.destroy();
        };

        const cacheAndResolve = (result: SmtpVerificationResult): void => {
            if (smtpCache) {
                smtpCache.set(cacheKey, result, ttl).catch(() => {
                    // Ignore cache errors
                });
            }

            resolve(result);
        };

        const onError = (error: Error): void => {
            cleanup();
            cacheAndResolve({
                error: error.message,
                mxRecords: mxCheck.records,
                valid: false,
            });
        };

        const onTimeout = (): void => {
            cleanup();
            cacheAndResolve({
                error: "SMTP connection timeout",
                mxRecords: mxCheck.records,
                valid: false,
            });
        };

        socket.setTimeout(timeout);
        socket.on("error", onError);
        socket.on("timeout", onTimeout);

        socket.on("data", (data: Buffer) => {
            response += data.toString();
            const responseCode = response.slice(-3);

            if (state === "connected" && (responseCode.startsWith("220") || responseCode.startsWith("250"))) {
                state = "helo";
                socket.write(`HELO ${domain}\r\n`);
            } else if (state === "helo" && responseCode.startsWith("250")) {
                state = "mail-from";
                socket.write(`MAIL FROM:<${fromEmail}>\r\n`);
            } else if (state === "mail-from" && responseCode.startsWith("250")) {
                state = "rcpt-to";
                socket.write(`RCPT TO:<${normalizedEmail}>\r\n`);
            } else if (state === "rcpt-to" && responseCode.startsWith("250")) {
                cleanup();
                cacheAndResolve({
                    mxRecords: mxCheck.records,
                    smtpResponse: response,
                    valid: true,
                });
            } else if (state === "rcpt-to" && (responseCode.startsWith("550") || responseCode.startsWith("551") || responseCode.startsWith("553"))) {
                cleanup();
                cacheAndResolve({
                    error: "Email address does not exist",
                    mxRecords: mxCheck.records,
                    smtpResponse: response,
                    valid: false,
                });
            }
        });

        if (mxRecord) {
            socket.connect(port, mxRecord.exchange);
        } else {
            cleanup();
            cacheAndResolve({
                error: "No MX record available",
                mxRecords: mxCheck.records,
                valid: false,
            });
        }
    });
};
