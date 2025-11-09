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
import type { MailgunConfig, MailgunEmailOptions } from "./types";

const PROVIDER_NAME = "mailgun";
const DEFAULT_ENDPOINT = "https://api.mailgun.net";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Format email address for Mailgun
 */
function formatAddress(address: EmailAddress): string {
    if (address.name) {
        return `${address.name} <${address.email}>`;
    }

    return address.email;
}

/**
 * Format email addresses array for Mailgun
 */
function formatAddresses(addresses: EmailAddress | EmailAddress[]): string[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatAddress);
}

/**
 * Convert object to form data format
 */
function objectToFormData(data: Record<string, unknown>): string {
    const formData: string[] = [];

    for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                formData.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
            }
        } else if (typeof value === "object") {
            formData.push(`${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}`);
        } else {
            formData.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    }

    return formData.join("&");
}

/**
 * Mailgun Provider for sending emails through Mailgun API
 */
export const mailgunProvider: ProviderFactory<MailgunConfig, unknown, MailgunEmailOptions> = defineProvider((options_: MailgunConfig = {} as MailgunConfig) => {
    if (!options_.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    if (!options_.domain) {
        throw new RequiredOptionError(PROVIDER_NAME, "domain");
    }

    const options: Pick<MailgunConfig, "logger"> & Required<Omit<MailgunConfig, "logger">> = {
        apiKey: options_.apiKey,
        debug: options_.debug || false,
        domain: options_.domain,
        endpoint: options_.endpoint || DEFAULT_ENDPOINT,
        retries: options_.retries || DEFAULT_RETRIES,
        timeout: options_.timeout || DEFAULT_TIMEOUT,
        ...options_.logger && { logger: options_.logger },
    };

    let isInitialized = false;

    const logger = createLogger(PROVIDER_NAME, options.debug, options_.logger);

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

                if (!isInitialized) {
                    await this.initialize();
                }

                // Mailgun uses events API to retrieve message info
                const auth = Buffer.from(`api:${options.apiKey}`).toString("base64");
                const headers: Record<string, string> = {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.endpoint}/v3/${options.domain}/events/${id}`, {
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
         * Initialize the Mailgun provider
         */
        async initialize(): Promise<void> {
            if (isInitialized) {
                return;
            }

            try {
                if (!await this.isAvailable()) {
                    throw new EmailError(PROVIDER_NAME, "Mailgun API not available or invalid API key/domain");
                }

                isInitialized = true;
                logger.debug("Provider initialized successfully");
            } catch (error) {
                throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
            }
        },

        /**
         * Check if Mailgun API is available and credentials are valid
         */
        async isAvailable(): Promise<boolean> {
            try {
                const auth = Buffer.from(`api:${options.apiKey}`).toString("base64");
                const headers: Record<string, string> = {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Checking Mailgun API availability");

                // Check domain validity
                const result = await makeRequest(`${options.endpoint}/v3/domains/${options.domain}`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                logger.debug("Mailgun API availability check response:", {
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
         * Send email through Mailgun API
         * @param emailOptions The email options including Mailgun-specific features
         */
        async sendEmail(emailOptions: MailgunEmailOptions): Promise<Result<EmailResult>> {
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

                // Build form data for Mailgun API
                const formData: Record<string, unknown> = {
                    from: formatAddress(emailOptions.from),
                    to: formatAddresses(emailOptions.to).join(","),
                };

                // Add subject
                if (emailOptions.subject) {
                    formData.subject = emailOptions.subject;
                }

                // Add CC
                if (emailOptions.cc) {
                    formData.cc = formatAddresses(emailOptions.cc).join(",");
                }

                // Add BCC
                if (emailOptions.bcc) {
                    formData.bcc = formatAddresses(emailOptions.bcc).join(",");
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    formData["h:Reply-To"] = formatAddress(emailOptions.replyTo);
                }

                // Add HTML content
                if (emailOptions.html) {
                    formData.html = emailOptions.html;
                }

                // Add text content
                if (emailOptions.text) {
                    formData.text = emailOptions.text;
                }

                // Add template
                if (emailOptions.template) {
                    formData.template = emailOptions.template;

                    if (emailOptions.templateVariables) {
                        for (const [key, value] of Object.entries(emailOptions.templateVariables)) {
                            formData[`v:${key}`] = value;
                        }
                    }
                }

                // Add tags
                if (emailOptions.tags && emailOptions.tags.length > 0) {
                    formData["o:tag"] = emailOptions.tags;
                }

                // Add campaign ID
                if (emailOptions.campaignId) {
                    formData["o:campaign"] = emailOptions.campaignId;
                }

                // Add delivery time
                if (emailOptions.deliveryTime) {
                    formData["o:deliverytime"]
                        = typeof emailOptions.deliveryTime === "number" ? new Date(emailOptions.deliveryTime * 1000).toUTCString() : emailOptions.deliveryTime;
                }

                // Add tracking options
                if (emailOptions.clickTracking !== undefined) {
                    formData["o:clicktracking"] = emailOptions.clickTracking ? "yes" : "no";
                }

                if (emailOptions.openTracking !== undefined) {
                    formData["o:tracking"] = emailOptions.openTracking ? "yes" : "no";
                }

                if (emailOptions.unsubscribeTracking !== undefined) {
                    formData["o:tracking-clicks"] = emailOptions.unsubscribeTracking ? "yes" : "no";
                }

                // Add test mode
                if (emailOptions.testMode) {
                    formData["o:testmode"] = "yes";
                }

                // Add require TLS
                if (emailOptions.requireTls) {
                    formData["o:require-tls"] = "yes";
                }

                // Add skip verification
                if (emailOptions.skipVerification) {
                    formData["o:skip-verification"] = "yes";
                }

                // Add custom headers
                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);

                    for (const [key, value] of Object.entries(headersRecord)) {
                        formData[`h:${key}`] = value;
                    }
                }

                // Add attachments
                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    // Mailgun requires multipart/form-data for attachments
                    // For now, we'll use form-urlencoded and base64 encode attachments
                    // In a real implementation, you'd use FormData
                    for (let i = 0; i < emailOptions.attachments.length; i++) {
                        const attachment = emailOptions.attachments[i];

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

                        formData[`attachment[${i}]`] = content;
                    }
                }

                logger.debug("Sending email via Mailgun API", {
                    subject: formData.subject,
                    to: formData.to,
                });

                const auth = Buffer.from(`api:${options.apiKey}`).toString("base64");
                const headers: Record<string, string> = {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                };

                const formBody = objectToFormData(formData);

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/v3/${options.domain}/messages`,
                            {
                                headers,
                                method: "POST",
                                timeout: options.timeout,
                            },
                            formBody,
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

                // Mailgun returns message ID in response body
                const responseBody = (result.data as { body?: { id?: string; message?: string } })?.body;
                const messageId = responseBody?.id || responseBody?.message || generateMessageId();

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
