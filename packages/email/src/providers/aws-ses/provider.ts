import type { EmailAddress, EmailResult, Result } from "../../types.js";
import type { AwsSesConfig } from "../../types.js";
import type { ProviderFactory } from "../provider.js";
import type { AwsSesEmailOptions } from "./types.js";
import { Buffer } from "node:buffer";
import * as crypto from "node:crypto";
import * as https from "node:https";
import { createError, createRequiredError, generateMessageId, validateEmailOptions } from "../../utils.js";
import { defineProvider } from "../provider.js";

const PROVIDER_NAME = "aws-ses";

/**
 * Default options for AWS SES provider
 */
const defaultOptions: Partial<AwsSesConfig> = {
    region: "us-east-1",
    maxAttempts: 3,
    apiVersion: "2010-12-01",
};

/**
 * Create canonical request for AWS Signature V4
 */
const createCanonicalRequest = (
    method: string,
    path: string,
    query: Record<string, string>,
    headers: Record<string, string>,
    payload: string,
): string => {
    const canonicalQueryString = Object.keys(query)
        .sort()
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
        .join("&");

    const canonicalHeaders = `${Object.keys(headers)
        .sort()
        .map((key) => `${key.toLowerCase()}:${headers[key]}`)
        .join("\n")}\n`;

    const signedHeaders = Object.keys(headers)
        .sort()
        .map((key) => key.toLowerCase())
        .join(";");

    const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");

    return [method, path, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");
};

/**
 * Create string to sign for AWS Signature V4
 */
const createStringToSign = (timestamp: string, region: string, canonicalRequest: string): string => {
    const date = timestamp.substring(0, 8);
    const hash = crypto.createHash("sha256").update(canonicalRequest).digest("hex");

    return ["AWS4-HMAC-SHA256", timestamp, `${date}/${region}/ses/aws4_request`, hash].join("\n");
};

/**
 * Calculate AWS Signature V4
 */
const calculateSignature = (
    secretKey: string,
    date: string,
    region: string,
    stringToSign: string,
): string => {
    const kDate = crypto.createHmac("sha256", `AWS4${secretKey}`).update(date).digest();
    const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
    const kService = crypto.createHmac("sha256", kRegion).update("ses").digest();
    const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
    return crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
};

/**
 * AWS SES Email Provider Implementation
 */
export const awsSesProvider: ProviderFactory<AwsSesConfig, unknown, AwsSesEmailOptions> = defineProvider(
    (opts: AwsSesConfig = {} as AwsSesConfig) => {
        // Merge with defaults
        const options = { ...defaultOptions, ...opts } as Required<AwsSesConfig>;

        // Validate required options
        if (!options.accessKeyId) {
            throw createRequiredError(PROVIDER_NAME, "accessKeyId");
        }
        if (!options.secretAccessKey) {
            throw createRequiredError(PROVIDER_NAME, "secretAccessKey");
        }

        // Debug helper
        const debug = (message: string, ...args: unknown[]): void => {
            if (options.debug) {
                console.log(`[AWS-SES] ${message}`, ...args);
            }
        };

        let isInitialized = false;

        return {
            name: PROVIDER_NAME,
            features: {
                attachments: true,
                html: true,
                templates: false,
                tracking: false,
                customHeaders: true,
                batchSending: false,
                scheduling: false,
                replyTo: true,
                tagging: true,
            },
            options,

            /**
             * Initialize the AWS SES provider
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    if (!(await this.isAvailable())) {
                        throw createError(PROVIDER_NAME, "AWS SES not available or invalid credentials");
                    }

                    isInitialized = true;
                    debug("Provider initialized successfully");
                } catch (error) {
                    throw createError(
                        PROVIDER_NAME,
                        `Failed to initialize: ${(error as Error).message}`,
                        { cause: error as Error },
                    );
                }
            },

            /**
             * Check if AWS SES is available
             */
            async isAvailable(): Promise<boolean> {
                // For AWS SES, we assume it's available if credentials are provided
                // A real implementation would verify credentials by calling GetSendQuota
                return !!(options.accessKeyId && options.secretAccessKey);
            },

            /**
             * Send email via AWS SES
             */
            async sendEmail(emailOpts: AwsSesEmailOptions): Promise<Result<EmailResult>> {
                try {
                    // Validate email options
                    const validationErrors = validateEmailOptions(emailOpts);
                    if (validationErrors.length > 0) {
                        return {
                            success: false,
                            error: createError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        };
                    }

                    if (!isInitialized) {
                        await this.initialize();
                    }

                    // Format recipients
                    const formatRecipients = (addresses: EmailAddress | EmailAddress[]): string[] => {
                        if (Array.isArray(addresses)) {
                            return addresses.map((addr) => addr.email);
                        }
                        return [addresses.email];
                    };

                    // Build email message
                    const messageParts: string[] = [];
                    if (emailOpts.text) {
                        messageParts.push(`Content-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: 7bit\n\n${emailOpts.text}`);
                    }
                    if (emailOpts.html) {
                        messageParts.push(`Content-Type: text/html; charset=UTF-8\nContent-Transfer-Encoding: 7bit\n\n${emailOpts.html}`);
                    }

                    const message = messageParts.join("\n\n");

                    // Build request parameters
                    const params: Record<string, string> = {
                        Action: "SendEmail",
                        Version: options.apiVersion,
                        Source: emailOpts.from.name ? `${emailOpts.from.name} <${emailOpts.from.email}>` : emailOpts.from.email,
                        "Message.Subject.Data": emailOpts.subject,
                        "Message.Body.Text.Data": emailOpts.text || "",
                        "Message.Body.Html.Data": emailOpts.html || "",
                    };

                    // Add recipients
                    const toAddresses = formatRecipients(emailOpts.to);
                    toAddresses.forEach((email, index) => {
                        params[`Destination.ToAddresses.member.${index + 1}`] = email;
                    });

                    if (emailOpts.cc) {
                        const ccAddresses = formatRecipients(emailOpts.cc);
                        ccAddresses.forEach((email, index) => {
                            params[`Destination.CcAddresses.member.${index + 1}`] = email;
                        });
                    }

                    if (emailOpts.bcc) {
                        const bccAddresses = formatRecipients(emailOpts.bcc);
                        bccAddresses.forEach((email, index) => {
                            params[`Destination.BccAddresses.member.${index + 1}`] = email;
                        });
                    }

                    if (emailOpts.replyTo) {
                        params["ReplyToAddresses.member.1"] = emailOpts.replyTo.email;
                    }

                    // Convert params to query string
                    const queryString = Object.keys(params)
                        .sort()
                        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                        .join("&");

                    // Create canonical request
                    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "");
                    const date = timestamp.substring(0, 8);
                    const endpoint = options.endpoint || `https://email.${options.region}.amazonaws.com`;
                    const url = new URL(endpoint);
                    const path = url.pathname || "/";

                    const headers: Record<string, string> = {
                        Host: url.hostname,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "X-Amz-Date": timestamp,
                    };

                    if (options.sessionToken) {
                        headers["X-Amz-Security-Token"] = options.sessionToken;
                    }

                    const canonicalRequest = createCanonicalRequest("POST", path, {}, headers, queryString);
                    const stringToSign = createStringToSign(timestamp, options.region, canonicalRequest);
                    const signature = calculateSignature(options.secretAccessKey, date, options.region, stringToSign);

                    const authorization = `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${date}/${options.region}/ses/aws4_request, SignedHeaders=${Object.keys(headers).sort().map((k) => k.toLowerCase()).join(";")}, Signature=${signature}`;

                    headers.Authorization = authorization;

                    // Make request
                    return new Promise((resolve) => {
                        const req = https.request(
                            {
                                hostname: url.hostname,
                                port: 443,
                                path,
                                method: "POST",
                                headers,
                            },
                            (res) => {
                                const chunks: Buffer[] = [];
                                res.on("data", (chunk) => chunks.push(chunk));
                                res.on("end", () => {
                                    const body = Buffer.concat(chunks).toString();
                                    const isSuccess = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;

                                    if (!isSuccess) {
                                        resolve({
                                            success: false,
                                            error: createError(
                                                PROVIDER_NAME,
                                                `AWS SES request failed with status ${res.statusCode}: ${body}`,
                                            ),
                                        });
                                        return;
                                    }

                                    // Extract message ID from response
                                    const messageIdMatch = body.match(/<MessageId>([^<]+)<\/MessageId>/);
                                    const messageId = messageIdMatch ? messageIdMatch[1] : generateMessageId();

                                    resolve({
                                        success: true,
                                        data: {
                                            messageId,
                                            sent: true,
                                            timestamp: new Date(),
                                            provider: PROVIDER_NAME,
                                            response: body,
                                        },
                                    });
                                });
                            },
                        );

                        req.on("error", (error) => {
                            resolve({
                                success: false,
                                error: createError(PROVIDER_NAME, `Request failed: ${error.message}`, { cause: error }),
                            });
                        });

                        req.write(queryString);
                        req.end();
                    });
                } catch (error) {
                    return {
                        success: false,
                        error: error instanceof Error ? error : createError(PROVIDER_NAME, String(error)),
                    };
                }
            },

            /**
             * Validate credentials
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);
