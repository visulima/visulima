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
import type { MailerSendConfig, MailerSendEmailOptions } from "./types";

const PROVIDER_NAME = "mailersend";
const DEFAULT_ENDPOINT = "https://api.mailersend.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Format email address for MailerSend
 */
function formatAddress(address: EmailAddress): { email: string; name?: string } {
    return {
        email: address.email,
        ...address.name && { name: address.name },
    };
}

/**
 * Format email addresses array for MailerSend
 */
function formatAddresses(addresses: EmailAddress | EmailAddress[]): { email: string; name?: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatAddress);
}

/**
 * MailerSend Provider for sending emails through MailerSend API
 */
export const mailerSendProvider: ProviderFactory<MailerSendConfig, unknown, MailerSendEmailOptions> = defineProvider(
    (options_: MailerSendConfig = {} as MailerSendConfig) => {
        if (!options_.apiToken) {
            throw new RequiredOptionError(PROVIDER_NAME, "apiToken");
        }

        const options: Pick<MailerSendConfig, "logger"> & Required<Omit<MailerSendConfig, "logger">> = {
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

                    const headers: Record<string, string> = {
                        Authorization: `Bearer ${options.apiToken}`,
                        "Content-Type": "application/json",
                    };

                    logger.debug("Retrieving email details", { id });

                    const result = await retry(
                        async () =>
                            makeRequest(`${options.endpoint}/v1/activity/${id}`, {
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
             * Initialize the MailerSend provider
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    if (!await this.isAvailable()) {
                        throw new EmailError(PROVIDER_NAME, "MailerSend API not available or invalid API token");
                    }

                    isInitialized = true;
                    logger.debug("Provider initialized successfully");
                } catch (error) {
                    throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
                }
            },

            /**
             * Check if MailerSend API is available and credentials are valid
             */
            async isAvailable(): Promise<boolean> {
                try {
                    const headers: Record<string, string> = {
                        Authorization: `Bearer ${options.apiToken}`,
                        "Content-Type": "application/json",
                    };

                    logger.debug("Checking MailerSend API availability");

                    // Check token validity
                    const result = await makeRequest(`${options.endpoint}/v1/tokens/verify`, {
                        headers,
                        method: "GET",
                        timeout: options.timeout,
                    });

                    logger.debug("MailerSend API availability check response:", {
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
             * Send email through MailerSend API
             * @param emailOptions The email options including MailerSend-specific features
             */
            async sendEmail(emailOptions: MailerSendEmailOptions): Promise<Result<EmailResult>> {
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

                    // Build payload for MailerSend API
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
                    if (emailOptions.templateId) {
                        payload.template_id = emailOptions.templateId;

                        if (emailOptions.templateVariables) {
                            payload.variables = emailOptions.templateVariables;
                        }
                    }

                    // Add personalization
                    if (emailOptions.personalization && emailOptions.personalization.length > 0) {
                        payload.personalization = emailOptions.personalization;
                    }

                    // Add tags
                    if (emailOptions.tags && emailOptions.tags.length > 0) {
                        payload.tags = emailOptions.tags;
                    }

                    // Add scheduled at
                    if (emailOptions.scheduledAt) {
                        payload.send_at = emailOptions.scheduledAt;
                    }

                    // Add domain ID
                    if (emailOptions.domainId) {
                        payload.domain_id = emailOptions.domainId;
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
                                    ...attachment.contentType && { type: attachment.contentType },
                                    ...attachment.cid && { id: attachment.cid },
                                };
                            }),
                        );
                    }

                    logger.debug("Sending email via MailerSend API", {
                        subject: payload.subject,
                        to: payload.to,
                    });

                    const headers: Record<string, string> = {
                        Authorization: `Bearer ${options.apiToken}`,
                        "Content-Type": "application/json",
                    };

                    const result = await retry(
                        async () =>
                            makeRequest(
                                `${options.endpoint}/v1/email`,
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

                    // MailerSend returns message ID in response body
                    const responseBody = (result.data as { body?: { message_id?: string } })?.body;
                    const messageId = responseBody?.message_id || generateMessageId();

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
