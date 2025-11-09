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
import type { InfobipConfig, InfobipEmailOptions } from "./types";

const PROVIDER_NAME = "infobip";
const DEFAULT_BASE_URL = "https://api.infobip.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Format email address for Infobip
 */
function formatAddress(address: EmailAddress): { email: string; name?: string } {
    return {
        email: address.email,
        ...address.name && { name: address.name },
    };
}

/**
 * Format email addresses array for Infobip
 */
function formatAddresses(addresses: EmailAddress | EmailAddress[]): { email: string; name?: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatAddress);
}

/**
 * Infobip Provider for sending emails through Infobip API
 */
export const infobipProvider: ProviderFactory<InfobipConfig, unknown, InfobipEmailOptions> = defineProvider((options_: InfobipConfig = {} as InfobipConfig) => {
    if (!options_.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const baseUrl = options_.baseUrl || DEFAULT_BASE_URL;
    const endpoint = options_.endpoint || `${baseUrl}/email/3/send`;

    const options: Pick<InfobipConfig, "logger"> & Required<Omit<InfobipConfig, "logger" | "baseUrl" | "endpoint">> & { baseUrl: string; endpoint: string } = {
        apiKey: options_.apiKey,
        baseUrl,
        debug: options_.debug || false,
        endpoint,
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
            tagging: false, // Infobip doesn't support tags
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

                const headers: Record<string, string> = {
                    Authorization: `App ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.baseUrl}/email/3/reports/${id}`, {
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
         * Initialize the Infobip provider
         */
        async initialize(): Promise<void> {
            if (isInitialized) {
                return;
            }

            try {
                if (!await this.isAvailable()) {
                    throw new EmailError(PROVIDER_NAME, "Infobip API not available or invalid API key");
                }

                isInitialized = true;
                logger.debug("Provider initialized successfully");
            } catch (error) {
                throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
            }
        },

        /**
         * Check if Infobip API is available and credentials are valid
         */
        async isAvailable(): Promise<boolean> {
            try {
                const headers: Record<string, string> = {
                    Authorization: `App ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Checking Infobip API availability");

                // Infobip doesn't have a simple health check, so we'll assume it's available if API key is present
                return true;
            } catch (error) {
                logger.debug("Error checking availability:", error);

                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Send email through Infobip API
         * @param emailOptions The email options including Infobip-specific features
         */
        async sendEmail(emailOptions: InfobipEmailOptions): Promise<Result<EmailResult>> {
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

                // Build payload for Infobip API
                const payload: Record<string, unknown> = {
                    from: emailOptions.from.email,
                    subject: emailOptions.subject,
                    to: formatAddresses(emailOptions.to).map((addr) => addr.email),
                };

                // Add HTML content
                if (emailOptions.html) {
                    payload.html = emailOptions.html;
                }

                // Add text content
                if (emailOptions.text) {
                    payload.text = emailOptions.text;
                }

                // Add CC
                if (emailOptions.cc) {
                    payload.cc = formatAddresses(emailOptions.cc).map((addr) => addr.email);
                }

                // Add BCC
                if (emailOptions.bcc) {
                    payload.bcc = formatAddresses(emailOptions.bcc).map((addr) => addr.email);
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    payload.replyTo = emailOptions.replyTo.email;
                }

                // Add template
                if (emailOptions.templateId) {
                    payload.templateId = emailOptions.templateId;

                    if (emailOptions.templateVariables) {
                        payload.templateData = emailOptions.templateVariables;
                    }
                }

                // Add tracking URL
                if (emailOptions.trackingUrl) {
                    payload.trackingUrl = emailOptions.trackingUrl;
                }

                // Add notify URL
                if (emailOptions.notifyUrl) {
                    payload.notifyUrl = emailOptions.notifyUrl;
                }

                // Add intermediate report
                if (emailOptions.intermediateReport !== undefined) {
                    payload.intermediateReport = emailOptions.intermediateReport;
                }

                // Add send at
                if (emailOptions.sendAt) {
                    payload.sendAt = emailOptions.sendAt;
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
                                content,
                                contentType: attachment.contentType || "application/octet-stream",
                                name: attachment.filename,
                            };
                        }),
                    );
                }

                logger.debug("Sending email via Infobip API", {
                    subject: payload.subject,
                    to: payload.to,
                });

                const headers: Record<string, string> = {
                    Authorization: `App ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                const result = await retry(
                    async () =>
                        makeRequest(
                            options.endpoint,
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

                // Infobip returns message ID in response body
                const responseBody = (result.data as { body?: { messages?: { messageId?: string }[] } })?.body;
                const messageId = responseBody?.messages?.[0]?.messageId || generateMessageId();

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
