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
import type { MailtrapConfig, MailtrapEmailOptions } from "./types";

const PROVIDER_NAME = "mailtrap";
const DEFAULT_ENDPOINT = "https://send.api.mailtrap.io";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Format email address for Mailtrap
 */
function formatAddress(address: EmailAddress): { email: string; name?: string } {
    return {
        email: address.email,
        ...address.name && { name: address.name },
    };
}

/**
 * Format email addresses array for Mailtrap
 */
function formatAddresses(addresses: EmailAddress | EmailAddress[]): { email: string; name?: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatAddress);
}

/**
 * Mailtrap Provider for sending emails through Mailtrap API
 */
export const mailtrapProvider: ProviderFactory<MailtrapConfig, unknown, MailtrapEmailOptions> = defineProvider(
    (options_: MailtrapConfig = {} as MailtrapConfig) => {
        if (!options_.apiToken) {
            throw new RequiredOptionError(PROVIDER_NAME, "apiToken");
        }

        const options: Pick<MailtrapConfig, "logger"> & Required<Omit<MailtrapConfig, "logger">> = {
            apiToken: options_.apiToken,
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
                scheduling: false, // Mailtrap doesn't support scheduling
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

                    const headers: Record<string, string> = {
                        "Api-Token": options.apiToken,
                        "Content-Type": "application/json",
                    };

                    logger.debug("Retrieving email details", { id });

                    // Mailtrap uses activity API
                    const result = await retry(
                        async () =>
                            makeRequest(`${options.endpoint}/api/send/${id}`, {
                                headers,
                                method: "GET",
                                timeout: options.timeout,
                            }),
                        options.retries,
                    );

                    if (!result.success) {
                        logger.debug("API request failed when retrieving email", result.error);

                        return {
                            error: new EmailError(PROVIDER_NAME, `Failed to retrieve email: ${result.error?.message || "Unknown error"}`, {
                                cause: result.error,
                            }),
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
             * Initialize the Mailtrap provider
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    if (!await this.isAvailable()) {
                        throw new EmailError(PROVIDER_NAME, "Mailtrap API not available or invalid API token");
                    }

                    isInitialized = true;
                    logger.debug("Provider initialized successfully");
                } catch (error) {
                    throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
                }
            },

            /**
             * Check if Mailtrap API is available and credentials are valid
             */
            async isAvailable(): Promise<boolean> {
                try {
                    const headers: Record<string, string> = {
                        "Api-Token": options.apiToken,
                        "Content-Type": "application/json",
                    };

                    logger.debug("Checking Mailtrap API availability");

                    // Check account info
                    const result = await makeRequest(`${options.endpoint}/api/account`, {
                        headers,
                        method: "GET",
                        timeout: options.timeout,
                    });

                    logger.debug("Mailtrap API availability check response:", {
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
             * Send email through Mailtrap API
             * @param emailOptions The email options including Mailtrap-specific features
             */
            async sendEmail(emailOptions: MailtrapEmailOptions): Promise<Result<EmailResult>> {
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

                    // Build payload for Mailtrap API
                    const payload: Record<string, unknown> = {
                        from: formatAddress(emailOptions.from),
                        subject: emailOptions.subject,
                        to: formatAddresses(emailOptions.to),
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
                        payload.cc = formatAddresses(emailOptions.cc);
                    }

                    // Add BCC
                    if (emailOptions.bcc) {
                        payload.bcc = formatAddresses(emailOptions.bcc);
                    }

                    // Add reply-to
                    if (emailOptions.replyTo) {
                        payload.reply_to = formatAddress(emailOptions.replyTo);
                    }

                    // Add template
                    if (emailOptions.templateUuid) {
                        payload.template_uuid = emailOptions.templateUuid;

                        if (emailOptions.templateVariables) {
                            payload.template_variables = emailOptions.templateVariables;
                        }
                    }

                    // Add category
                    if (emailOptions.category) {
                        payload.category = emailOptions.category;
                    }

                    // Add custom variables
                    if (emailOptions.customVariables) {
                        payload.custom_variables = emailOptions.customVariables;
                    }

                    // Add tags
                    if (emailOptions.tags && emailOptions.tags.length > 0) {
                        payload.tags = emailOptions.tags;
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
                                    filename: attachment.filename,
                                    type: attachment.contentType || "application/octet-stream",
                                    ...attachment.cid && { cid: attachment.cid },
                                };
                            }),
                        );
                    }

                    logger.debug("Sending email via Mailtrap API", {
                        subject: payload.subject,
                        to: payload.to,
                    });

                    const headers: Record<string, string> = {
                        "Api-Token": options.apiToken,
                        "Content-Type": "application/json",
                    };

                    const result = await retry(
                        async () =>
                            makeRequest(
                                `${options.endpoint}/api/send`,
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

                    // Mailtrap returns message IDs in response body
                    const responseBody = (result.data as { body?: { message_ids?: string[] } })?.body;
                    const messageId = responseBody?.message_ids?.[0] || generateMessageId();

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
    },
);
