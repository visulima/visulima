import { Buffer } from "node:buffer";

import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatAzureAddress, formatAzureAddresses, handleProviderError, ProviderState } from "../utils";
import type { AzureConfig, AzureEmailOptions } from "./types";

const PROVIDER_NAME = "azure";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Azure Communication Services Provider for sending emails through Azure API
 */
const azureProvider: ProviderFactory<AzureConfig, unknown, AzureEmailOptions> = defineProvider((config: AzureConfig = {} as AzureConfig) => {
    if (!config.region) {
        throw new RequiredOptionError(PROVIDER_NAME, "region");
    }

    if (!config.connectionString && !config.accessToken) {
        throw new RequiredOptionError(PROVIDER_NAME, "connectionString or accessToken");
    }

    const endpoint = config.endpoint || `https://${config.region}.communication.azure.com`;

    const options: Pick<AzureConfig, "logger" | "endpoint" | "connectionString" | "accessToken">
        & Required<Omit<AzureConfig, "logger" | "endpoint" | "connectionString" | "accessToken">> & { endpoint: string } = {
            debug: config.debug || false,
            endpoint,
            region: config.region,
            retries: config.retries || DEFAULT_RETRIES,
            timeout: config.timeout || DEFAULT_TIMEOUT,
            ...(config.connectionString && { connectionString: config.connectionString }),
            ...(config.accessToken && { accessToken: config.accessToken }),
            ...(config.logger && { logger: config.logger }),
        };

    const providerState = new ProviderState();
    const logger = createProviderLogger(PROVIDER_NAME, config.logger);

    return {
        features: {
            attachments: true,
            batchSending: false, // Azure doesn't support batch sending
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false, // Azure doesn't support scheduling
            tagging: false, // Azure doesn't support tags
            templates: true,
            tracking: false, // Azure has limited tracking
        },

        /**
         * Retrieves an email by its ID from Azure Communication Services.
         * @param id The email ID to retrieve.
         * @returns A result object containing the email details or an error.
         */
        async getEmail(id: string): Promise<Result<unknown>> {
            try {
                if (!id) {
                    return {
                        error: new EmailError(PROVIDER_NAME, "Email ID is required to retrieve email details"),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                };

                if (options.accessToken) {
                    headers.Authorization = `Bearer ${options.accessToken}`;
                } else if (options.connectionString) {
                    // Extract key from connection string for basic auth
                    const match = options.connectionString.match(/endpoint=([^;]+);accesskey=([^;]+)/);

                    if (match) {
                        headers.Authorization = `Bearer ${match[2]}`;
                    }
                }

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.endpoint}/emails/${id}`, {
                            headers,
                            method: "GET",
                            timeout: options.timeout,
                        }),
                    options.retries,
                );

                if (!result.success) {
                    logger.debug("API request failed when retrieving email", result.error);

                    return {
                        error: new EmailError(
                            PROVIDER_NAME,
                            `Failed to retrieve email: ${result.error instanceof Error ? result.error.message : "Unknown error"}`,
                            { cause: result.error },
                        ),
                        success: false,
                    };
                }

                logger.debug("Email details retrieved successfully");

                return {
                    data: (result.data as { body?: unknown })?.body,
                    success: true,
                };
            } catch (error) {
                return {
                    error: handleProviderError(PROVIDER_NAME, "retrieve email", error, logger),
                    success: false,
                };
            }
        },

        /**
         * Initializes the Azure provider and validates API availability.
         * @throws {EmailError} When the Azure Communication Services API is not available or credentials are invalid.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "Azure Communication Services API not available or invalid credentials");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the Azure Communication Services API is available and credentials are valid.
         * @returns True if the API is available and credentials are valid, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                };

                if (options.accessToken) {
                    headers.Authorization = `Bearer ${options.accessToken}`;
                } else if (options.connectionString) {
                    const match = options.connectionString.match(/endpoint=([^;]+);accesskey=([^;]+)/);

                    if (match) {
                        headers.Authorization = `Bearer ${match[2]}`;
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }

                logger.debug("Checking Azure Communication Services API availability");

                // Azure doesn't have a simple health check, so we'll assume it's available if credentials are present
                return true;
            } catch (error) {
                logger.debug("Error checking availability:", error);

                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Sends an email through the Azure Communication Services API.
         * @param emailOptions The email options including Azure-specific features.
         * @returns A result object containing the email result or an error.
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: AzureEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                // Build payload for Azure API
                const payload: {
                    attachments?: unknown[];
                    content: { html?: string; plainText?: string; subject: string };
                    headers?: Record<string, string>;
                    importance?: string;
                    recipients: { bcc?: unknown[]; cc?: unknown[]; to: unknown[] };
                    replyTo?: string;
                    senderAddress: string;
                } = {
                    content: {
                        subject: emailOptions.subject,
                    },
                    recipients: {
                        to: formatAzureAddresses(emailOptions.to),
                    },
                    senderAddress: emailOptions.from.email,
                };

                // Add HTML content
                if (emailOptions.html) {
                    payload.content.html = emailOptions.html;
                }

                // Add text content
                if (emailOptions.text) {
                    payload.content.plainText = emailOptions.text;
                }

                // Add CC
                if (emailOptions.cc) {
                    payload.recipients.cc = formatAzureAddresses(emailOptions.cc);
                }

                // Add BCC
                if (emailOptions.bcc) {
                    payload.recipients.bcc = formatAzureAddresses(emailOptions.bcc);
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    payload.replyTo = formatAzureAddress(emailOptions.replyTo).email;
                }

                // Add importance
                if (emailOptions.importance) {
                    payload.importance = emailOptions.importance;
                }

                // Add custom headers
                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);

                    payload.headers = headersRecord;
                }

                // Add attachments
                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    payload.attachments = await Promise.all(
                        emailOptions.attachments.map(async (attachment) => {
                            let content: string;

                            if (attachment.content) {
                                if (typeof attachment.content === "string") {
                                    content = Buffer.from(attachment.content, "utf8").toString("base64");
                                } else if (attachment.content && typeof (attachment.content as PromiseLike<unknown>).then === "function") {
                                    const buffer = await attachment.content;

                                    content = Buffer.from(buffer).toString("base64");
                                } else {
                                    content = attachment.content.toString("base64");
                                }
                            } else if (attachment.raw) {
                                content
                                    = typeof attachment.raw === "string"
                                        ? Buffer.from(attachment.raw, "utf8").toString("base64")
                                        : attachment.raw.toString("base64");
                            } else {
                                throw new EmailError(PROVIDER_NAME, `Attachment ${attachment.filename} has no content`);
                            }

                            return {
                                contentInBase64: content,
                                contentType: attachment.contentType || "application/octet-stream",
                                name: attachment.filename,
                            };
                        }),
                    );
                }

                logger.debug("Sending email via Azure Communication Services API", {
                    subject: payload.content.subject,
                    to: payload.recipients.to,
                } as Record<string, unknown>);

                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                };

                if (options.accessToken) {
                    headers.Authorization = `Bearer ${options.accessToken}`;
                } else if (options.connectionString) {
                    const match = options.connectionString.match(/endpoint=([^;]+);accesskey=([^;]+)/);

                    if (match) {
                        headers.Authorization = `Bearer ${match[2]}`;
                    } else {
                        return {
                            error: new EmailError(PROVIDER_NAME, "Invalid connection string format"),
                            success: false,
                        };
                    }
                }

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/emails:send`,
                            {
                                headers,
                                method: "POST",
                                timeout: options.timeout,
                            },
                            JSON.stringify(payload),
                        ),
                    options.retries,
                );

                if (!result.success) {
                    logger.debug("API request failed when sending email", result.error);

                    return {
                        error: result.error || new EmailError(PROVIDER_NAME, "Failed to send email"),
                        success: false,
                    };
                }

                // Azure returns message ID in response body
                const responseBody = (result.data as { body?: { messageId?: string } })?.body;
                const messageId = responseBody?.messageId || generateMessageId();

                logger.debug("Email sent successfully", { messageId });

                return {
                    data: {
                        messageId,
                        provider: PROVIDER_NAME,
                        response: result.data,
                        sent: true,
                        timestamp: new Date(),
                    },
                    success: true,
                };
            } catch (error) {
                return {
                    error: handleProviderError(PROVIDER_NAME, "send email", error, logger),
                    success: false,
                };
            }
        },

        /**
         * Validates the Azure Communication Services API credentials.
         * @returns A promise that resolves to true if credentials are valid, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});

export default azureProvider;
