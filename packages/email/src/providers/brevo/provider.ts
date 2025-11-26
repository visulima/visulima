import { Buffer } from "node:buffer";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatSendGridAddress, formatSendGridAddresses, handleProviderError, ProviderState } from "../utils";
import type { BrevoConfig, BrevoEmailOptions } from "./types";

const PROVIDER_NAME = "brevo";
const DEFAULT_ENDPOINT = "https://api.brevo.com/v3";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Brevo Provider for sending emails through Brevo API
 */
export const brevoProvider: ProviderFactory<BrevoConfig, unknown, BrevoEmailOptions> = defineProvider((options_: BrevoConfig = {} as BrevoConfig) => {
    if (!options_.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const options: Pick<BrevoConfig, "logger"> & Required<Omit<BrevoConfig, "logger">> = {
        apiKey: options_.apiKey,
        debug: options_.debug || false,
        endpoint: options_.endpoint || DEFAULT_ENDPOINT,
        retries: options_.retries || DEFAULT_RETRIES,
        timeout: options_.timeout || DEFAULT_TIMEOUT,
        ...options_.logger && { logger: options_.logger },
    };

    const providerState = new ProviderState();
    const logger = createProviderLogger(PROVIDER_NAME, options_.logger);

    return {
        endpoint: options.endpoint,

        features: {
            attachments: true,
            batchSending: true,
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: true,
            tagging: true,
            templates: true,
            tracking: true,
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
                    "api-key": options.apiKey,
                    "Content-Type": "application/json",
                };

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.endpoint}/smtp/emails/${id}`, {
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
         * Initialize the Brevo provider
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!await this.isAvailable()) {
                    throw new EmailError(PROVIDER_NAME, "Brevo API not available or invalid API key");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Check if Brevo API is available and credentials are valid
         */
        async isAvailable(): Promise<boolean> {
            try {
                const headers: Record<string, string> = {
                    "api-key": options.apiKey,
                    "Content-Type": "application/json",
                };

                logger.debug("Checking Brevo API availability");

                // Check account info to validate API key
                const result = await makeRequest(`${options.endpoint}/account`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                logger.debug("Brevo API availability check response:", {
                    error: result.error?.message,
                    statusCode: (result.data as { statusCode?: number })?.statusCode,
                    success: result.success,
                });

                return (
                    result.success
                    && result.data
                    && typeof result.data === "object"
                    && "statusCode" in result.data
                    && typeof result.data.statusCode === "number"
                    && result.data.statusCode >= 200
                    && result.data.statusCode < 300
                );
            } catch (error) {
                logger.debug("Error checking availability:", error);

                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Send email through Brevo API
         * @param emailOptions The email options including Brevo-specific features
         */
        async sendEmail(emailOptions: BrevoEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                // Build payload for Brevo API
                const payload: Record<string, unknown> = {
                    sender: formatSendGridAddress(emailOptions.from),
                    subject: emailOptions.subject,
                    to: formatSendGridAddresses(emailOptions.to),
                };

                // Add HTML content
                if (emailOptions.html) {
                    payload.htmlContent = emailOptions.html;
                }

                // Add text content
                if (emailOptions.text) {
                    payload.textContent = emailOptions.text;
                }

                // Add CC
                if (emailOptions.cc) {
                    payload.cc = formatSendGridAddresses(emailOptions.cc);
                }

                // Add BCC
                if (emailOptions.bcc) {
                    payload.bcc = formatSendGridAddresses(emailOptions.bcc);
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    payload.replyTo = formatSendGridAddress(emailOptions.replyTo);
                }

                // Add template
                if (emailOptions.templateId) {
                    payload.templateId = emailOptions.templateId;

                    if (emailOptions.templateParams) {
                        payload.params = emailOptions.templateParams;
                    }
                }

                // Add tags
                if (emailOptions.tags && emailOptions.tags.length > 0) {
                    payload.tags = emailOptions.tags;
                }

                // Add scheduled date/time
                if (emailOptions.scheduledAt) {
                    const scheduledDate
                        = typeof emailOptions.scheduledAt === "number" ? new Date(emailOptions.scheduledAt * 1000).toISOString() : emailOptions.scheduledAt;

                    payload.scheduledAt = scheduledDate;
                }

                // Add batch ID
                if (emailOptions.batchId) {
                    payload.batchId = emailOptions.batchId;
                }

                // Add custom headers
                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);

                    payload.headers = headersRecord;
                }

                // Add attachments
                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    payload.attachment = await Promise.all(
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
                                content,
                                name: attachment.filename,
                                ...attachment.contentType && { type: attachment.contentType },
                            };
                        }),
                    );
                }

                logger.debug("Sending email via Brevo API", {
                    subject: payload.subject,
                    to: payload.to,
                });

                const headers: Record<string, string> = {
                    "api-key": options.apiKey,
                    "Content-Type": "application/json",
                };

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/smtp/email`,
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

                // Brevo returns message ID in response body
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
