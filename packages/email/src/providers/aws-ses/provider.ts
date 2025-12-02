import { createHash, createHmac, randomUUID } from "node:crypto";

import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailOptions, EmailResult, Result } from "../../types";
import { createLogger } from "../../utils/create-logger";
import formatEmailAddressDefault from "../../utils/format-email-address";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import { sanitizeHeaderName, sanitizeHeaderValue } from "../../utils/sanitize-header";
import validateEmailOptions from "../../utils/validation/validate-email-options";
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
const awsSesProvider: ProviderFactory<AwsSesConfig, unknown, AwsSesEmailOptions> = defineProvider((config: AwsSesConfig = {} as AwsSesConfig) => {
    const options = { ...defaultOptions, ...config } as Required<AwsSesConfig>;

    const logger = createLogger("AWS-SES", config.logger);

    /**
     * Creates a canonical request for AWS Signature V4.
     * @param method The HTTP method to use for the request.
     * @param path The request path to include in the canonical request.
     * @param query The query parameters to include in the canonical request.
     * @param headers The request headers to include in the canonical request.
     * @param payload The request payload to hash for the canonical request.
     * @returns The canonical request string formatted according to AWS Signature V4 specification.
     */
    const createCanonicalRequest = (method: string, path: string, query: Record<string, string>, headers: Record<string, string>, payload: string): string => {
        const canonicalQueryString = Object.keys(query)
            .toSorted()
            .map((key) => {
                const value = query[key];

                return value === undefined ? "" : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            })
            .filter(Boolean)
            .join("&");

        const canonicalHeaders = `${Object.keys(headers)
            .toSorted()
            .map((key) => `${key.toLowerCase()}:${headers[key]}`)
            .join("\n")}\n`;

        const signedHeaders = Object.keys(headers)
            .toSorted()
            .map((key) => key.toLowerCase())
            .join(";");

        const payloadHash = createHash("sha256").update(payload).digest("hex");

        return [method, path, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");
    };

    /**
     * Creates a string to sign for AWS Signature V4.
     * @param timestamp The request timestamp in ISO 8601 format.
     * @param region The AWS region where the service is located.
     * @param canonicalRequest The canonical request string to include in the signature.
     * @returns The formatted string to sign according to AWS Signature V4 specification.
     */
    const createStringToSign = (timestamp: string, region: string, canonicalRequest: string): string => {
        const date = timestamp.slice(0, 8);
        const hash = createHash("sha256").update(canonicalRequest).digest("hex");

        return ["AWS4-HMAC-SHA256", timestamp, `${date}/${region}/ses/aws4_request`, hash].join("\n");
    };

    /**
     * Calculates the AWS Signature V4 using HMAC-SHA256.
     * @param secretKey The AWS secret access key for signing.
     * @param timestamp The request timestamp in ISO 8601 format.
     * @param region The AWS region where the service is located.
     * @param stringToSign The formatted string to sign.
     * @returns The calculated hexadecimal signature string.
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
     * Creates an AWS SES authorization header with Signature V4 credentials.
     * @param accessKeyId The AWS access key ID to include in the authorization header.
     * @param timestamp The request timestamp in ISO 8601 format.
     * @param region The AWS region where the service is located.
     * @param headers The request headers to include in the signed headers list.
     * @param signature The calculated hexadecimal signature string.
     * @returns The complete authorization header string ready for use in HTTP requests.
     */
    const createAuthHeader = (accessKeyId: string, timestamp: string, region: string, headers: Record<string, string>, signature: string): string => {
        const date = timestamp.slice(0, 8);
        const signedHeaders = Object.keys(headers)
            .toSorted()
            .map((key) => key.toLowerCase())
            .join(";");

        return [
            `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${date}/${region}/ses/aws4_request`,
            `SignedHeaders=${signedHeaders}`,
            `Signature=${signature}`,
        ].join(", ");
    };

    /**
     * Makes an HTTP request to the AWS SES API using runtime-agnostic makeRequest.
     * @param action The AWS SES action to perform.
     * @param params The parameters for the action.
     * @returns A promise that resolves with the response data.
     * @throws {EmailError} When the request fails.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
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

                    if (messageIdMatch) {
                        const [, messageId] = messageIdMatch;

                        parsedResult.MessageId = messageId;
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
     * Generates a MIME message for the email.
     * @param emailOptions The email options to generate the message from.
     * @returns The MIME-formatted email message as a string.
     */
    const generateMimeMessage = (emailOptions: EmailOptions): string => {
        const boundary = `----=${randomUUID().replaceAll("-", "")}`;
        const now = new Date().toUTCString();
        const domain = emailOptions.from.email.includes("@") ? emailOptions.from.email.split("@")[1] : "localhost";
        const messageId = `<${randomUUID().replaceAll("-", "")}@${domain}>`;
        const Buffer = getBuffer();

        let message = "";

        message += `From: ${formatEmailAddressDefault(emailOptions.from)}\r\n`;

        message += Array.isArray(emailOptions.to)
            ? `To: ${emailOptions.to.map((addr) => formatEmailAddressDefault(addr)).join(", ")}\r\n`
            : `To: ${formatEmailAddressDefault(emailOptions.to)}\r\n`;

        // Add CC if present
        if (emailOptions.cc) {
            message += Array.isArray(emailOptions.cc)
                ? `Cc: ${emailOptions.cc.map((addr) => formatEmailAddressDefault(addr)).join(", ")}\r\n`
                : `Cc: ${formatEmailAddressDefault(emailOptions.cc)}\r\n`;
        }

        // Add BCC if present
        if (emailOptions.bcc) {
            message += Array.isArray(emailOptions.bcc)
                ? `Bcc: ${emailOptions.bcc.map((addr) => formatEmailAddressDefault(addr)).join(", ")}\r\n`
                : `Bcc: ${formatEmailAddressDefault(emailOptions.bcc)}\r\n`;
        }

        // Add other headers with sanitized subject
        message += `Subject: ${sanitizeHeaderValue(emailOptions.subject)}\r\n`;
        message += `Date: ${now}\r\n`;
        message += `Message-ID: ${messageId}\r\n`;
        message += "MIME-Version: 1.0\r\n";

        // Add custom headers if provided
        if (emailOptions.headers) {
            const headersRecord = headersToRecord(emailOptions.headers);

            for (const [name, value] of Object.entries(headersRecord)) {
                const sanitizedName = sanitizeHeaderName(name);
                const sanitizedValue = sanitizeHeaderValue(value);

                message += `${sanitizedName}: ${sanitizedValue}\r\n`;
            }
        }

        // Start multipart message
        message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

        // Add plain text part if provided
        if (emailOptions.text) {
            message += `--${boundary}\r\n`;
            message += "Content-Type: text/plain; charset=UTF-8\r\n";
            message += "Content-Transfer-Encoding: base64\r\n\r\n";
            message += `${Buffer.from(emailOptions.text, "utf8").toString("base64")}\r\n\r\n`;
        }

        // Add HTML part if provided
        if (emailOptions.html) {
            message += `--${boundary}\r\n`;
            message += "Content-Type: text/html; charset=UTF-8\r\n";
            message += "Content-Transfer-Encoding: base64\r\n\r\n";
            message += `${Buffer.from(emailOptions.html, "utf8").toString("base64")}\r\n\r\n`;
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
         * Gets the provider instance (returns undefined since we don't use AWS SDK).
         * @returns Undefined, as this provider doesn't use the AWS SDK.
         */
        getInstance: () => undefined,

        /**
         * Initializes the AWS SES provider.
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
         * Checks if the AWS SES service is available.
         * @returns True if AWS SES is available, false otherwise.
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
         * Sends an email using AWS SES with the Raw Email API.
         * This avoids issues with the complex XML structure of the regular SendEmail API.
         * @param emailOptions The email options to send.
         * @returns A result object containing the email result or an error.
         */
        async sendEmail(emailOptions: AwsSesEmailOptions): Promise<Result<EmailResult>> {
            /**
             * Checks for unsupported fields that would be silently ignored.
             * @param awsEmailOptions The email options to check.
             * @returns Array of unsupported field names.
             */
            const checkUnsupportedFields = (awsEmailOptions: AwsSesEmailOptions): string[] => {
                const unsupportedFields: string[] = [];

                if (awsEmailOptions.attachments && awsEmailOptions.attachments.length > 0) {
                    unsupportedFields.push("attachments");
                }

                if (awsEmailOptions.priority) {
                    unsupportedFields.push("priority");
                }

                if (awsEmailOptions.tags && awsEmailOptions.tags.length > 0) {
                    unsupportedFields.push("tags (use messageTags instead)");
                }

                if (awsEmailOptions.replyTo) {
                    unsupportedFields.push("replyTo");
                }

                return unsupportedFields;
            };

            try {
                // Validate email options
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    throw new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`);
                }

                // Check for unsupported fields that would be silently ignored
                const unsupportedFields = checkUnsupportedFields(emailOptions);

                if (unsupportedFields.length > 0) {
                    throw new EmailError(
                        PROVIDER_NAME,
                        `Unsupported fields provided: ${unsupportedFields.join(", ")}. These fields are not supported by AWS SES Raw Email API and would be silently ignored.`,
                    );
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

                // Validate response contains MessageId
                const messageId = response.MessageId as string | undefined;

                if (!messageId || messageId.trim() === "") {
                    return {
                        error: new EmailError(
                            PROVIDER_NAME,
                            "AWS SES API returned a response without a MessageId. The email may not have been sent successfully.",
                        ),
                        success: false,
                    };
                }

                return {
                    data: {
                        messageId,
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
         * Validates the AWS SES credentials.
         * @returns A promise that resolves to true if credentials are valid, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});

export default awsSesProvider;
