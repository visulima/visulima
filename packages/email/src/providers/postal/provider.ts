import { Buffer } from "node:buffer";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import { generateMessageId } from "../../utils/generate-message-id";
import { headersToRecord } from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import { retry } from "../../utils/retry";
import { validateEmailOptions } from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatPostalAddress, formatPostalAddresses, handleProviderError, ProviderState } from "../utils";
import type { PostalConfig, PostalEmailOptions } from "./types";

const PROVIDER_NAME = "postal";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;


/**
 * Postal Provider for sending emails through Postal API
 */
export const postalProvider: ProviderFactory<PostalConfig, unknown, PostalEmailOptions> = defineProvider((options_: PostalConfig = {} as PostalConfig) => {
    if (!options_.host) {
        throw new RequiredOptionError(PROVIDER_NAME, "host");
    }

    if (!options_.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const endpoint = options_.endpoint || `https://${options_.host}/api/v1`;

    const options: Pick<PostalConfig, "logger"> & Required<Omit<PostalConfig, "logger" | "endpoint">> & { endpoint: string } = {
        apiKey: options_.apiKey,
        debug: options_.debug || false,
        endpoint,
        host: options_.host,
        retries: options_.retries || DEFAULT_RETRIES,
        timeout: options_.timeout || DEFAULT_TIMEOUT,
        ...options_.logger && { logger: options_.logger },
    };

    const providerState = new ProviderState();
    const logger = createProviderLogger(PROVIDER_NAME, options.debug, options_.logger);

    return {
        features: {
            attachments: true,
            batchSending: false, // Postal doesn't support batch sending
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false, // Postal doesn't support scheduling
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
                    "Content-Type": "application/json",
                    "X-Server-API-Key": options.apiKey,
                };

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.endpoint}/messages/${id}`, {
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
                logger.debug("Exception retrieving email", error);

                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to retrieve email: ${(error as Error).message}`, { cause: error as Error }),
                    success: false,
                };
            }
        },

        /**
         * Initialize the Postal provider
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!await this.isAvailable()) {
                    throw new EmailError(PROVIDER_NAME, "Postal API not available or invalid API key");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Check if Postal API is available and credentials are valid
         */
        async isAvailable(): Promise<boolean> {
            try {
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    "X-Server-API-Key": options.apiKey,
                };

                logger.debug("Checking Postal API availability");

                // Check server info
                const result = await makeRequest(`${options.endpoint}/server`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                logger.debug("Postal API availability check response:", {
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
         * Send email through Postal API
         * @param emailOptions The email options including Postal-specific features
         */
        async sendEmail(emailOptions: PostalEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                // Build payload for Postal API
                const payload: Record<string, unknown> = {
                    from: formatPostalAddress(emailOptions.from).address,
                    subject: emailOptions.subject,
                    to: formatPostalAddresses(emailOptions.to).map((addr) => addr.address),
                };

                // Add HTML content
                if (emailOptions.html) {
                    payload.html_body = emailOptions.html;
                }

                // Add text content
                if (emailOptions.text) {
                    payload.plain_body = emailOptions.text;
                }

                // Add CC
                if (emailOptions.cc) {
                    payload.cc = formatPostalAddresses(emailOptions.cc).map((addr) => addr.address);
                }

                // Add BCC
                if (emailOptions.bcc) {
                    payload.bcc = formatPostalAddresses(emailOptions.bcc).map((addr) => addr.address);
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    payload.reply_to = formatPostalAddress(emailOptions.replyTo).address;
                }

                // Add template
                if (emailOptions.templateId) {
                    payload.template_id = emailOptions.templateId;

                    if (emailOptions.templateVariables) {
                        payload.template_variables = emailOptions.templateVariables;
                    }
                }

                // Add tags
                if (emailOptions.tags && emailOptions.tags.length > 0) {
                    payload.tag = emailOptions.tags.join(",");
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
                                content_type: attachment.contentType || "application/octet-stream",
                                data: content,
                                name: attachment.filename,
                            };
                        }),
                    );
                }

                logger.debug("Sending email via Postal API", {
                    subject: payload.subject,
                    to: payload.to,
                });

                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    "X-Server-API-Key": options.apiKey,
                };

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/send/message`,
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

                // Postal returns message ID in response body
                const responseBody = (result.data as { body?: { message_id?: number } })?.body;
                const messageId = responseBody?.message_id?.toString() || generateMessageId();

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
                logger.debug("Exception sending email", error);

                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to send email: ${(error as Error).message}`, { cause: error as Error }),
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
