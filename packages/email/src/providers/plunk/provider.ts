import { Buffer } from "node:buffer";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, handleProviderError, ProviderState } from "../utils";
import type { PlunkConfig, PlunkEmailOptions } from "./types";

const PROVIDER_NAME = "plunk";
const DEFAULT_ENDPOINT = "https://api.useplunk.com/v1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Plunk Provider for sending emails through Plunk API
 */
export const plunkProvider: ProviderFactory<PlunkConfig, unknown, PlunkEmailOptions> = defineProvider((options_: PlunkConfig = {} as PlunkConfig) => {
    if (!options_.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const options: Required<PlunkConfig> = {
        apiKey: options_.apiKey,
        debug: options_.debug || false,
        endpoint: options_.endpoint || DEFAULT_ENDPOINT,
        retries: options_.retries || DEFAULT_RETRIES,
        timeout: options_.timeout || DEFAULT_TIMEOUT,
    };

    const providerState = new ProviderState();
    const logger = createProviderLogger(PROVIDER_NAME, options_.logger);

    return {
        features: {
            attachments: true,
            batchSending: false,
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false,
            tagging: false,
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
                    Authorization: `Bearer ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

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
         * Initialize the Plunk provider
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!await this.isAvailable()) {
                    throw new EmailError(PROVIDER_NAME, "Plunk API not available or invalid API key");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Check if Plunk API is available and credentials are valid
         */
        async isAvailable(): Promise<boolean> {
            try {
                // Check if API key exists and has valid format
                if (options.apiKey && options.apiKey.length > 0) {
                    logger.debug("API key exists, assuming Plunk is available");

                    return true;
                }

                return false;
            } catch (error) {
                logger.debug("Error checking availability:", error);

                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Send email through Plunk API
         * @param emailOptions The email options including Plunk-specific features
         */
        async sendEmail(emailOptions: PlunkEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                const formatRecipients = (addresses: EmailAddress | EmailAddress[]): string[] => {
                    if (Array.isArray(addresses)) {
                        return addresses.map((address) => address.email);
                    }

                    return [addresses.email];
                };

                // Determine subscriber email (use first 'to' address if not provided)
                const subscriberEmail = emailOptions.subscriber || (Array.isArray(emailOptions.to) ? emailOptions.to[0]?.email : emailOptions.to.email);

                const payload: Record<string, unknown> = {
                    to: subscriberEmail,
                };

                // Add from address
                if (emailOptions.from) {
                    payload.from = emailOptions.from.email;

                    if (emailOptions.from.name) {
                        payload.from_name = emailOptions.from.name;
                    }
                }

                // Add subject
                if (emailOptions.subject) {
                    payload.subject = emailOptions.subject;
                }

                // Add body (prefer HTML, fallback to text)
                if (emailOptions.html) {
                    payload.body = emailOptions.html;
                } else if (emailOptions.text) {
                    payload.body = emailOptions.text;
                }

                // Add text version if HTML is provided
                if (emailOptions.html && emailOptions.text) {
                    payload.text = emailOptions.text;
                }

                // Add CC recipients
                if (emailOptions.cc) {
                    payload.cc = formatRecipients(emailOptions.cc);
                }

                // Add BCC recipients
                if (emailOptions.bcc) {
                    payload.bcc = formatRecipients(emailOptions.bcc);
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    payload.reply_to = emailOptions.replyTo.email;

                    if (emailOptions.replyTo.name) {
                        payload.reply_to_name = emailOptions.replyTo.name;
                    }
                }

                // Add template ID if provided
                if (emailOptions.templateId) {
                    payload.template = emailOptions.templateId;
                }

                // Add template data or custom data
                if (emailOptions.data) {
                    payload.data = emailOptions.data;
                }

                // Add subscriber ID if provided
                if (emailOptions.subscriberId) {
                    payload.subscriber_id = emailOptions.subscriberId;
                }

                // Add custom headers
                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);

                    payload.headers = headersRecord;
                }

                // Add attachments if provided
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
                                content,
                                filename: attachment.filename,
                                type: attachment.contentType || "application/octet-stream",
                            };
                        }),
                    );
                }

                logger.debug("Sending email via Plunk API", {
                    subject: payload.subject,
                    to: payload.to,
                });

                const headers: Record<string, string> = {
                    Authorization: `Bearer ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/send`,
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

                const responseData = result.data as { body?: { id?: string; messageId?: string } };
                const messageId
                    = responseData?.body && typeof responseData.body === "object"
                        ? responseData.body.id || responseData.body.messageId || generateMessageId()
                        : generateMessageId();

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
