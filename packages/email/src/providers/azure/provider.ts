import { Buffer } from "node:buffer";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailResult, Result } from "../../types";
import { generateMessageId } from "../../utils/generate-message-id";
import { headersToRecord } from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import { retry } from "../../utils/retry";
import { validateEmailOptions } from "../../utils/validate-email-options";
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
export const azureProvider: ProviderFactory<AzureConfig, unknown, AzureEmailOptions> = defineProvider((options_: AzureConfig = {} as AzureConfig) => {
    if (!options_.region) {
        throw new RequiredOptionError(PROVIDER_NAME, "region");
    }

    if (!options_.connectionString && !options_.accessToken) {
        throw new RequiredOptionError(PROVIDER_NAME, "connectionString or accessToken");
    }

    const endpoint = options_.endpoint || `https://${options_.region}.communication.azure.com`;

    const options: Pick<AzureConfig, "logger" | "endpoint" | "connectionString" | "accessToken">
        & Required<Omit<AzureConfig, "logger" | "endpoint" | "connectionString" | "accessToken">> & { endpoint: string } = {
            debug: options_.debug || false,
            endpoint,
            region: options_.region,
            retries: options_.retries || DEFAULT_RETRIES,
            timeout: options_.timeout || DEFAULT_TIMEOUT,
            ...options_.connectionString && { connectionString: options_.connectionString },
            ...options_.accessToken && { accessToken: options_.accessToken },
            ...options_.logger && { logger: options_.logger },
        };

    const providerState = new ProviderState();
    const logger = createProviderLogger(PROVIDER_NAME, options.debug, options_.logger);

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
         * Retrieve email by ID
         * @param id Email ID to retrieve
         * @returns Email details
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
                        error: new EmailError(PROVIDER_NAME, `Failed to retrieve email: ${result.error?.message || "Unknown error"}`, { cause: result.error }),
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
         * Initialize the Azure provider
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!await this.isAvailable()) {
                    throw new EmailError(PROVIDER_NAME, "Azure Communication Services API not available or invalid credentials");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Check if Azure API is available and credentials are valid
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
         * Send email through Azure Communication Services API
         * @param emailOptions The email options including Azure-specific features
         */
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
                const payload: Record<string, unknown> = {
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
                    payload.replyTo = formatAzureAddress(emailOptions.replyTo);
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
                                    content = attachment.content;
                                } else if (attachment.content instanceof Promise) {
                                    const buffer = await attachment.content;

                                    content = Buffer.from(buffer).toString("base64");
                                } else {
                                    content = attachment.content.toString("base64");
                                }
                            } else if (attachment.raw) {
                                content = typeof attachment.raw === "string" ? attachment.raw : attachment.raw.toString("base64");
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
                });

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
         * Validate API credentials
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});
