import { Buffer } from "node:buffer";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import { createLogger } from "../../utils/create-logger";
import { generateMessageId } from "../../utils/generate-message-id";
import { headersToRecord } from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import { retry } from "../../utils/retry";
import { validateEmailOptions } from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { MailjetConfig, MailjetEmailOptions } from "./types";

const PROVIDER_NAME = "mailjet";
const DEFAULT_ENDPOINT = "https://api.mailjet.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Format email address for Mailjet
 */
function formatAddress(address: EmailAddress): { Email: string; Name?: string } {
    return {
        Email: address.email,
        ...address.name && { Name: address.name },
    };
}

/**
 * Format email addresses array for Mailjet
 */
function formatAddresses(addresses: EmailAddress | EmailAddress[]): { Email: string; Name?: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatAddress);
}

/**
 * Mailjet Provider for sending emails through Mailjet API
 */
export const mailjetProvider: ProviderFactory<MailjetConfig, unknown, MailjetEmailOptions> = defineProvider((options_: MailjetConfig = {} as MailjetConfig) => {
    if (!options_.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    if (!options_.apiSecret) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiSecret");
    }

    const options: Pick<MailjetConfig, "logger"> & Required<Omit<MailjetConfig, "logger">> = {
        apiKey: options_.apiKey,
        apiSecret: options_.apiSecret,
        debug: options_.debug || false,
        endpoint: options_.endpoint || DEFAULT_ENDPOINT,
        retries: options_.retries || DEFAULT_RETRIES,
        timeout: options_.timeout || DEFAULT_TIMEOUT,
        ...options_.logger && { logger: options_.logger },
    };

    let isInitialized = false;

    const logger = createLogger(PROVIDER_NAME, options.debug, options_.logger);

    return {
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

                if (!isInitialized) {
                    await this.initialize();
                }

                const auth = Buffer.from(`${options.apiKey}:${options.apiSecret}`).toString("base64");
                const headers: Record<string, string> = {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.endpoint}/v3.1/REST/message/${id}`, {
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
         * Initialize the Mailjet provider
         */
        async initialize(): Promise<void> {
            if (isInitialized) {
                return;
            }

            try {
                if (!await this.isAvailable()) {
                    throw new EmailError(PROVIDER_NAME, "Mailjet API not available or invalid API credentials");
                }

                isInitialized = true;
                logger.debug("Provider initialized successfully");
            } catch (error) {
                throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
            }
        },

        /**
         * Check if Mailjet API is available and credentials are valid
         */
        async isAvailable(): Promise<boolean> {
            try {
                const auth = Buffer.from(`${options.apiKey}:${options.apiSecret}`).toString("base64");
                const headers: Record<string, string> = {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Checking Mailjet API availability");

                // Check user info to validate credentials
                const result = await makeRequest(`${options.endpoint}/v3.1/REST/user`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                logger.debug("Mailjet API availability check response:", {
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
         * Send email through Mailjet API
         * @param emailOptions The email options including Mailjet-specific features
         */
        async sendEmail(emailOptions: MailjetEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                if (!isInitialized) {
                    await this.initialize();
                }

                // Build message for Mailjet API
                const message: Record<string, unknown> = {
                    From: formatAddress(emailOptions.from),
                    Subject: emailOptions.subject,
                    To: formatAddresses(emailOptions.to),
                };

                // Add HTML content
                if (emailOptions.html) {
                    message.HTMLPart = emailOptions.html;
                }

                // Add text content
                if (emailOptions.text) {
                    message.TextPart = emailOptions.text;
                }

                // Add CC
                if (emailOptions.cc) {
                    message.Cc = formatAddresses(emailOptions.cc);
                }

                // Add BCC
                if (emailOptions.bcc) {
                    message.Bcc = formatAddresses(emailOptions.bcc);
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    message.ReplyTo = formatAddress(emailOptions.replyTo);
                }

                // Add template
                if (emailOptions.templateId) {
                    message.TemplateID = emailOptions.templateId;
                    message.TemplateLanguage = emailOptions.templateLanguage ?? true;

                    if (emailOptions.templateVariables) {
                        message.Variables = emailOptions.templateVariables;
                    }
                }

                // Add custom ID
                if (emailOptions.customId) {
                    message.CustomID = emailOptions.customId;
                }

                // Add event payload
                if (emailOptions.eventPayload) {
                    message.EventPayload = emailOptions.eventPayload;
                }

                // Add campaign
                if (emailOptions.campaign) {
                    message.Campaign = emailOptions.campaign;
                }

                // Add deduplicate campaign
                if (emailOptions.deduplicateCampaign !== undefined) {
                    message.DeduplicateCampaign = emailOptions.deduplicateCampaign;
                }

                // Add delivery time
                if (emailOptions.deliveryTime) {
                    message.Deliverytime = new Date(emailOptions.deliveryTime * 1000).toISOString();
                }

                // Add priority
                if (emailOptions.priority !== undefined) {
                    message.Priority = emailOptions.priority;
                }

                // Add URL tags
                if (emailOptions.urlTags) {
                    message.URLTags = emailOptions.urlTags;
                }

                // Add tags
                if (emailOptions.tags && emailOptions.tags.length > 0) {
                    message.CustomCampaign = emailOptions.tags.join(",");
                }

                // Add custom headers
                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);
                    const headersArray: { Name: string; Value: string }[] = [];

                    for (const [key, value] of Object.entries(headersRecord)) {
                        headersArray.push({ Name: key, Value: String(value) });
                    }

                    if (headersArray.length > 0) {
                        message.Headers = headersArray;
                    }
                }

                // Add attachments
                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    message.Attachments = await Promise.all(
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
                                Base64Content: content,
                                ContentType: attachment.contentType || "application/octet-stream",
                                Filename: attachment.filename,
                                ...attachment.cid && { ContentID: attachment.cid },
                            };
                        }),
                    );
                }

                const payload = {
                    Messages: [message],
                };

                logger.debug("Sending email via Mailjet API", {
                    subject: message.Subject,
                    to: message.To,
                });

                const auth = Buffer.from(`${options.apiKey}:${options.apiSecret}`).toString("base64");
                const headers: Record<string, string> = {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json",
                };

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/v3.1/send`,
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

                // Mailjet returns message IDs in response body
                const responseBody = (result.data as { body?: { Messages?: { To?: { MessageID?: number }[] }[] } })?.body;
                const messageId = responseBody?.Messages?.[0]?.To?.[0]?.MessageID?.toString() || generateMessageId();

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
