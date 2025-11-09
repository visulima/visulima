import { createHash, createHmac, randomUUID } from "node:crypto";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailAddress, EmailOptions, EmailResult, Result } from "../../types";
import { createLogger } from "../../utils/create-logger";
import { headersToRecord } from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import { validateEmailOptions } from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { AwsSesConfig, AwsSesEmailOptions } from "./types";

const hasBuffer = globalThis.Buffer !== undefined;

const getBuffer = (): typeof globalThis.Buffer => {
    if (!hasBuffer) {
        throw new Error("Buffer is required for AWS SES provider");
    }

    return globalThis.Buffer;
};

const PROVIDER_NAME = "aws-ses";

/**
 * Default options for AWS SES provider
 */
const defaultOptions: Partial<AwsSesConfig> = {
    apiVersion: "2010-12-01",
    maxAttempts: 3,
    region: "us-east-1",
};

/**
 * AWS SES Email Provider Implementation - Zero dependency version
 * Uses native Node.js APIs instead of AWS SDK
 */
export const awsSesProvider: ProviderFactory<AwsSesConfig, unknown, AwsSesEmailOptions> = defineProvider((options_: AwsSesConfig = {} as AwsSesConfig) => {
    const options = { ...defaultOptions, ...options_ } as Required<AwsSesConfig>;

    const logger = createLogger("AWS-SES", options.debug, options_.logger);

    /**
     * Create canonical request for AWS Signature V4
     */
    const createCanonicalRequest = (method: string, path: string, query: Record<string, string>, headers: Record<string, string>, payload: string): string => {
        const canonicalQueryString = Object.keys(query)
            .sort()
            .map((key) => {
                const value = query[key];

                return value === undefined ? "" : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            })
            .filter(Boolean)
            .join("&");

        const canonicalHeaders = `${Object.keys(headers)
            .sort()
            .map((key) => `${key.toLowerCase()}:${headers[key]}`)
            .join("\n")}\n`;

        const signedHeaders = Object.keys(headers)
            .sort()
            .map((key) => key.toLowerCase())
            .join(";");

        const payloadHash = createHash("sha256").update(payload).digest("hex");

        return [method, path, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");
    };

    /**
     * Create string to sign for AWS Signature V4
     */
    const createStringToSign = (timestamp: string, region: string, canonicalRequest: string): string => {
        const date = timestamp.slice(0, 8);
        const hash = createHash("sha256").update(canonicalRequest).digest("hex");

        return ["AWS4-HMAC-SHA256", timestamp, `${date}/${region}/ses/aws4_request`, hash].join("\n");
    };

    /**
     * Calculate AWS Signature V4
     */
    const calculateSignature = (secretKey: string, timestamp: string, region: string, stringToSign: string): string => {
        const date = timestamp.slice(0, 8);

        const kDate = createHmac("sha256", `AWS4${secretKey}`).update(date).digest();

        const kRegion = createHmac("sha256", kDate).update(region).digest();

        const kService = createHmac("sha256", kRegion).update("ses").digest();

        const kSigning = createHmac("sha256", kService).update("aws4_request").digest();

        return createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    };

    /**
     * Create AWS SES authorization header
     */
    const createAuthHeader = (accessKeyId: string, timestamp: string, region: string, headers: Record<string, string>, signature: string): string => {
        const date = timestamp.slice(0, 8);
        const signedHeaders = Object.keys(headers)
            .sort()
            .map((key) => key.toLowerCase())
            .join(";");

        return [
            `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${date}/${region}/ses/aws4_request`,
            `SignedHeaders=${signedHeaders}`,
            `Signature=${signature}`,
        ].join(", ");
    };

    /**
     * Make an HTTP request to AWS SES API using runtime-agnostic makeRequest
     */
    const makeAwsRequest = async (action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        if (!options.accessKeyId || !options.secretAccessKey) {
            logger.debug("Missing required credentials: accessKeyId or secretAccessKey");
            throw new RequiredOptionError(PROVIDER_NAME, ["accessKeyId", "secretAccessKey"]);
        }

        try {
            const region = options.region || (defaultOptions.region as string);
            const apiVersion = options.apiVersion || defaultOptions.apiVersion;
            const host = options.endpoint || `email.${region}.amazonaws.com`;
            const path = "/";
            const method = "POST";

            logger.debug("Making request to AWS SES:", { action, host, region });

            const body = new URLSearchParams();

            body.append("Action", action);
            body.append("Version", apiVersion as string);

            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    body.append(key, String(value));
                }
            });

            const bodyString = body.toString();

            logger.debug("Request body:", bodyString);

            const now = new Date();
            const amzDate = now.toISOString().replaceAll(/[:-]|\.\d{3}/g, "");

            const Buffer = getBuffer();

            const headers: Record<string, string> = {
                "Content-Length": Buffer.byteLength(bodyString).toString(),
                "Content-Type": "application/x-www-form-urlencoded",
                Host: host,
                "X-Amz-Date": amzDate,
            };

            if (options.sessionToken) {
                headers["X-Amz-Security-Token"] = options.sessionToken;
            }

            logger.debug("Request headers:", headers);

            const canonicalRequest = createCanonicalRequest(method, path, {}, headers, bodyString);

            const stringToSign = createStringToSign(amzDate, region, canonicalRequest);

            const signature = calculateSignature(options.secretAccessKey, amzDate, region, stringToSign);

            headers.Authorization = createAuthHeader(options.accessKeyId, amzDate, region, headers, signature);

            logger.debug("Making HTTPS request to:", `https://${host}${path}`);

            const url = `https://${host}${path}`;
            const result = await makeRequest(
                url,
                {
                    headers,
                    method,
                },
                bodyString,
            );

            if (!result.success) {
                throw result.error || new Error("AWS SES API request failed");
            }

            const responseData = (result.data as { body?: string; statusCode?: number })?.body;

            if (!responseData) {
                throw new Error("No response body from AWS SES");
            }

            const responseStatus = (result.data as { body?: string; statusCode?: number })?.statusCode;

            logger.debug("Response status:", responseStatus);
            logger.debug("Response data:", responseData);

            const statusCode = responseStatus;

            if (statusCode && statusCode >= 200 && statusCode < 300) {
                const parsedResult: Record<string, unknown> = {};

                if (action === "SendRawEmail") {
                    const messageIdMatch = responseData.match(/<MessageId>(.*?)<\/MessageId>/);

                    if (messageIdMatch && messageIdMatch[1]) {
                        parsedResult.MessageId = messageIdMatch[1];
                        logger.debug("Extracted MessageId:", parsedResult.MessageId);
                    }
                } else if (action === "GetSendQuota") {
                    const maxMatch = responseData.match(/<Max24HourSend>(.*?)<\/Max24HourSend>/);

                    if (maxMatch && maxMatch[1]) {
                        parsedResult.Max24HourSend = Number.parseFloat(maxMatch[1]);
                        logger.debug("Extracted Max24HourSend:", parsedResult.Max24HourSend);
                    }
                }

                return parsedResult;
            }

            const errorMatch = responseData.match(/<Message>(.*?)<\/Message>/);
            const errorMessage = errorMatch ? errorMatch[1] : "Unknown AWS SES error";

            logger.debug("AWS SES Error:", errorMessage);
            throw new Error(`AWS SES API Error: ${errorMessage}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            logger.debug("makeAwsRequest exception:", errorMessage);
            throw error instanceof Error ? error : new Error(errorMessage);
        }
    };

    /**
     * Format email address for email headers
     */
    const formatEmailAddress = (address: EmailAddress): string => (address.name ? `${address.name} <${address.email}>` : address.email);

    /**
     * Generate MIME message for email
     */
    const generateMimeMessage = (options: EmailOptions): string => {
        const boundary = `----=${randomUUID().replaceAll("-", "")}`;
        const now = new Date().toString();
        const messageId = `<${randomUUID().replaceAll("-", "")}@${options.from.email.split("@")[1]}>`;

        let message = "";

        message += `From: ${formatEmailAddress(options.from)}\r\n`;

        message += Array.isArray(options.to) ? `To: ${options.to.map(formatEmailAddress).join(", ")}\r\n` : `To: ${formatEmailAddress(options.to)}\r\n`;

        // Add CC if present
        if (options.cc) {
            message += Array.isArray(options.cc) ? `Cc: ${options.cc.map(formatEmailAddress).join(", ")}\r\n` : `Cc: ${formatEmailAddress(options.cc)}\r\n`;
        }

        // Add BCC if present
        if (options.bcc) {
            message += Array.isArray(options.bcc)
                ? `Bcc: ${options.bcc.map(formatEmailAddress).join(", ")}\r\n`
                : `Bcc: ${formatEmailAddress(options.bcc)}\r\n`;
        }

        // Add other headers
        message += `Subject: ${options.subject}\r\n`;
        message += `Date: ${now}\r\n`;
        message += `Message-ID: ${messageId}\r\n`;
        message += "MIME-Version: 1.0\r\n";

        // Add custom headers if provided
        if (options.headers) {
            const headersRecord = headersToRecord(options.headers);

            for (const [name, value] of Object.entries(headersRecord)) {
                message += `${name}: ${value}\r\n`;
            }
        }

        // Start multipart message
        message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

        // Add plain text part if provided
        if (options.text) {
            message += `--${boundary}\r\n`;
            message += "Content-Type: text/plain; charset=UTF-8\r\n";
            message += "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
            message += `${options.text.replaceAll(/([=\r\n])/g, "=$1")}\r\n\r\n`;
        }

        // Add HTML part if provided
        if (options.html) {
            message += `--${boundary}\r\n`;
            message += "Content-Type: text/html; charset=UTF-8\r\n";
            message += "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
            message += `${options.html.replaceAll(/([=\r\n])/g, "=$1")}\r\n\r\n`;
        }

        // Close the MIME message
        message += `--${boundary}--\r\n`;

        return message;
    };

    return {
        features: {
            attachments: false, // Not implemented in this version
            batchSending: false,
            customHeaders: true,
            html: true,
            replyTo: false, // Explicitly state that reply-to is not supported
            scheduling: false, // Explicitly state that scheduling is not supported
            tagging: false, // Explicitly state that tagging is not supported
            templates: false,
            tracking: false,
        },

        /**
         * Get provider instance - returns null since we don't use AWS SDK
         */
        getInstance: () => null,

        /**
         * Initialize the AWS SES provider
         */
        initialize(): void {
            // Nothing special needed here
            logger.debug("Initializing AWS SES provider with options:", {
                accessKeyId: options.accessKeyId ? `***${options.accessKeyId.slice(-4)}` : undefined,
                endpoint: options.endpoint,
                region: options.region,
                secretAccessKey: options.secretAccessKey ? "***" : undefined,
            });
        },

        /**
         * Check if AWS SES is available
         */
        async isAvailable(): Promise<boolean> {
            try {
                const response = await makeAwsRequest("GetSendQuota", {});

                return !!(response.Max24HourSend as number | undefined);
            } catch {
                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Send email using AWS SES with the Raw Email API
         * This avoids issues with the complex XML structure of the regular SendEmail API
         */
        async sendEmail(emailOptions: AwsSesEmailOptions): Promise<Result<EmailResult>> {
            try {
                // Validate email options
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    throw new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`);
                }

                // Prepare AWS SES specific options
                const params: Record<string, unknown> = {};

                if (emailOptions.configurationSetName) {
                    params.ConfigurationSetName = emailOptions.configurationSetName;
                }

                if (emailOptions.sourceArn) {
                    params.SourceArn = emailOptions.sourceArn;
                }

                if (emailOptions.returnPath) {
                    params.ReturnPath = emailOptions.returnPath;
                }

                if (emailOptions.returnPathArn) {
                    params.ReturnPathArn = emailOptions.returnPathArn;
                }

                if (emailOptions.messageTags && Object.keys(emailOptions.messageTags).length > 0) {
                    Object.entries(emailOptions.messageTags).forEach(([name, value], index) => {
                        params[`Tags.member.${index + 1}.Name`] = name;
                        params[`Tags.member.${index + 1}.Value`] = value;
                    });
                }

                // Generate the MIME message
                const rawMessage = generateMimeMessage(emailOptions);

                // Base64 encode the raw message
                const Buffer = getBuffer();
                const encodedMessage = Buffer.from(rawMessage).toString("base64");

                // Add the raw message data
                params["RawMessage.Data"] = encodedMessage;

                // Send the raw email
                const response = await makeAwsRequest("SendRawEmail", params);

                return {
                    data: {
                        messageId: (response.MessageId as string) || "",
                        provider: PROVIDER_NAME,
                        response,
                        sent: true,
                        timestamp: new Date(),
                    },
                    success: true,
                };
            } catch (error) {
                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to send email: ${error instanceof Error ? error.message : String(error)}`, {
                        cause: error instanceof Error ? error : new Error(String(error)),
                    }),
                    success: false,
                };
            }
        },

        /**
         * Validate AWS SES credentials
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});
