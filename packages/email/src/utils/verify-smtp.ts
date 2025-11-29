import { Socket } from "node:net";

import type { MxRecord } from "./check-mx-records";
import checkMxRecords from "./check-mx-records";

/**
 * Options for SMTP verification.
 */
interface SmtpVerificationOptions {
    fromEmail?: string;
    port?: number;
    timeout?: number;
}

/**
 * Detailed result of SMTP verification attempt.
 */
interface SmtpVerificationResult {
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
 * import { verifySmtp } from "@visulima/email/utils/verify-smtp";
 *
 * const result = await verifySmtp("user@example.com", {
 *     timeout: 5000,
 *     fromEmail: "test@example.com"
 * });
 * ```
 */
const verifySmtp = async (email: string, options: SmtpVerificationOptions = {}): Promise<SmtpVerificationResult> => {
    const { fromEmail = "test@example.com", port = 25, timeout = 5000 } = options;

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

    const domain = normalizedEmail.slice(atIndex + 1);

    const mxCheck = await checkMxRecords(domain);

    if (!mxCheck.valid || !mxCheck.records || mxCheck.records.length === 0) {
        return {
            error: mxCheck.error || "No MX records found",
            mxRecords: mxCheck.records,
            valid: false,
        };
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

        const onError = (error: Error): void => {
            cleanup();
            resolve({
                error: error.message,
                mxRecords: mxCheck.records,
                valid: false,
            });
        };

        const onTimeout = (): void => {
            cleanup();
            resolve({
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
                resolve({
                    mxRecords: mxCheck.records,
                    smtpResponse: response,
                    valid: true,
                });
            } else if (state === "rcpt-to" && (responseCode.startsWith("550") || responseCode.startsWith("551") || responseCode.startsWith("553"))) {
                cleanup();
                resolve({
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
            resolve({
                error: "No MX record available",
                mxRecords: mxCheck.records,
                valid: false,
            });
        }
    });
};

export default verifySmtp;
export type { SmtpVerificationOptions, SmtpVerificationResult };
