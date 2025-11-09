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
import type { PostmarkConfig, PostmarkEmailOptions } from "./types";

const PROVIDER_NAME = "postmark";
const DEFAULT_ENDPOINT = "https://api.postmarkapp.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Format email address for Postmark
 */
function formatAddress(address: EmailAddress): string {
    if (address.name) {
        return `${address.name} <${address.email}>`;
    }

    return address.email;
}

/**
 * Format email addresses array for Postmark
 */
function formatAddresses(addresses: EmailAddress | EmailAddress[]): string {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatAddress).join(",");
}

/**
 * Postmark Provider for sending emails through Postmark API
 */
export const postmarkProvider: ProviderFactory<PostmarkConfig, unknown, PostmarkEmailOptions> = defineProvider(
    (options_: PostmarkConfig = {} as PostmarkConfig) => {
        if (!options_.serverToken) {
            throw new RequiredOptionError(PROVIDER_NAME, "serverToken");
        }

        const options: Pick<PostmarkConfig, "logger"> & Required<Omit<PostmarkConfig, "logger">> = {
            debug: options_.debug || false,
            endpoint: options_.endpoint || DEFAULT_ENDPOINT,
            retries: options_.retries || DEFAULT_RETRIES,
            serverToken: options_.serverToken,
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
                scheduling: false, // Postmark doesn't support scheduling
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
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": options.serverToken,
                    };

                    logger.debug("Retrieving email details", { id });

                    const result = await retry(
                        async () =>
                            makeRequest(`${options.endpoint}/messages/outbound/${id}/details`, {
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
             * Initialize the Postmark provider
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    if (!await this.isAvailable()) {
                        throw new EmailError(PROVIDER_NAME, "Postmark API not available or invalid server token");
                    }

                    isInitialized = true;
                    logger.debug("Provider initialized successfully");
                } catch (error) {
                    throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
                }
            },

            /**
             * Check if Postmark API is available and credentials are valid
             */
            async isAvailable(): Promise<boolean> {
                try {
                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": options.serverToken,
                    };

                    logger.debug("Checking Postmark API availability");

                    // Check server info to validate token
                    const result = await makeRequest(`${options.endpoint}/server`, {
                        headers,
                        method: "GET",
                        timeout: options.timeout,
                    });

                    logger.debug("Postmark API availability check response:", {
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
             * Send email through Postmark API
             * @param emailOptions The email options including Postmark-specific features
             */
            async sendEmail(emailOptions: PostmarkEmailOptions): Promise<Result<EmailResult>> {
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

                    // Build payload for Postmark API
                    const payload: Record<string, unknown> = {
                        From: formatAddress(emailOptions.from),
                        Subject: emailOptions.subject,
                        To: formatAddresses(emailOptions.to),
                    };

                    // Add HTML content
                    if (emailOptions.html) {
                        payload.HtmlBody = emailOptions.html;
                    }

                    // Add text content
                    if (emailOptions.text) {
                        payload.TextBody = emailOptions.text;
                    }

                    // Add CC
                    if (emailOptions.cc) {
                        payload.Cc = formatAddresses(emailOptions.cc);
                    }

                    // Add BCC
                    if (emailOptions.bcc) {
                        payload.Bcc = formatAddresses(emailOptions.bcc);
                    }

                    // Add reply-to
                    if (emailOptions.replyTo) {
                        payload.ReplyTo = formatAddress(emailOptions.replyTo);
                    }

                    // Add template (either templateId or templateAlias)
                    if (emailOptions.templateId) {
                        payload.TemplateId = emailOptions.templateId;

                        if (emailOptions.templateModel) {
                            payload.TemplateModel = emailOptions.templateModel;
                        }
                    } else if (emailOptions.templateAlias) {
                        payload.TemplateAlias = emailOptions.templateAlias;

                        if (emailOptions.templateModel) {
                            payload.TemplateModel = emailOptions.templateModel;
                        }
                    }

                    // Add tracking options
                    if (emailOptions.trackOpens !== undefined) {
                        payload.TrackOpens = emailOptions.trackOpens;
                    }

                    if (emailOptions.trackLinks !== undefined) {
                        payload.TrackLinks = emailOptions.trackLinks;
                    }

                    // Add inline CSS
                    if (emailOptions.inlineCss !== undefined) {
                        payload.InlineCss = emailOptions.inlineCss;
                    }

                    // Add message stream
                    if (emailOptions.messageStream) {
                        payload.MessageStream = emailOptions.messageStream;
                    }

                    // Add metadata
                    if (emailOptions.metadata) {
                        payload.Metadata = emailOptions.metadata;
                    }

                    // Add tags (Postmark uses Tag field)
                    if (emailOptions.tags && emailOptions.tags.length > 0) {
                        payload.Tag = emailOptions.tags[0]; // Postmark supports single tag, use first one
                    }

                    // Add custom headers (Postmark expects array of {Name, Value} objects)
                    if (emailOptions.headers) {
                        const headersRecord = headersToRecord(emailOptions.headers);
                        const headersArray: { Name: string; Value: string }[] = [];

                        for (const [key, value] of Object.entries(headersRecord)) {
                            headersArray.push({ Name: key, Value: String(value) });
                        }

                        if (headersArray.length > 0) {
                            payload.Headers = headersArray;
                        }
                    }

                    // Add attachments
                    if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                        payload.Attachments = await Promise.all(
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
                                    Content: content,
                                    ContentType: attachment.contentType || "application/octet-stream",
                                    Name: attachment.filename,
                                    ...attachment.cid && { ContentID: attachment.cid },
                                };
                            }),
                        );
                    }

                    logger.debug("Sending email via Postmark API", {
                        subject: payload.Subject,
                        to: payload.To,
                    });

                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": options.serverToken,
                    };

                    const result = await retry(
                        async () =>
                            makeRequest(
                                `${options.endpoint}/email`,
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

                    // Postmark returns message ID in response body
                    const responseBody = (result.data as { body?: { MessageID?: string } })?.body;
                    const messageId = responseBody?.MessageID || generateMessageId();

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
