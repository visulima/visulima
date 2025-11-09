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
import type { MandrillConfig, MandrillEmailOptions } from "./types";

const PROVIDER_NAME = "mandrill";
const DEFAULT_ENDPOINT = "https://mandrillapp.com/api/1.0";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Format email address for Mandrill
 */
function formatAddress(address: EmailAddress): { email: string; name?: string; type?: string } {
    return {
        email: address.email,
        ...address.name && { name: address.name },
        type: "to",
    };
}

/**
 * Format email addresses array for Mandrill
 */
function formatAddresses(addresses: EmailAddress | EmailAddress[]): { email: string; name?: string; type?: string }[] {
    const addressList = Array.isArray(addresses) ? addresses : [addresses];

    return addressList.map(formatAddress);
}

/**
 * Mandrill Provider for sending emails through Mandrill API
 */
export const mandrillProvider: ProviderFactory<MandrillConfig, unknown, MandrillEmailOptions> = defineProvider(
    (options_: MandrillConfig = {} as MandrillConfig) => {
        if (!options_.apiKey) {
            throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
        }

        const options: Pick<MandrillConfig, "logger"> & Required<Omit<MandrillConfig, "logger">> = {
            apiKey: options_.apiKey,
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

                    logger.debug("Retrieving email details", { id });

                    // Mandrill uses messages/info endpoint
                    const payload = {
                        id,
                        key: options.apiKey,
                    };

                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                    };

                    const result = await retry(
                        async () =>
                            makeRequest(
                                `${options.endpoint}/messages/info.json`,
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
             * Initialize the Mandrill provider
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    if (!await this.isAvailable()) {
                        throw new EmailError(PROVIDER_NAME, "Mandrill API not available or invalid API key");
                    }

                    isInitialized = true;
                    logger.debug("Provider initialized successfully");
                } catch (error) {
                    throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
                }
            },

            /**
             * Check if Mandrill API is available and credentials are valid
             */
            async isAvailable(): Promise<boolean> {
                try {
                    logger.debug("Checking Mandrill API availability");

                    // Mandrill uses users/info endpoint to verify API key
                    const payload = {
                        key: options.apiKey,
                    };

                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                    };

                    const result = await makeRequest(
                        `${options.endpoint}/users/info.json`,
                        {
                            headers,
                            method: "POST",
                            timeout: options.timeout,
                        },
                        JSON.stringify(payload),
                    );

                    logger.debug("Mandrill API availability check response:", {
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
             * Send email through Mandrill API
             * @param emailOptions The email options including Mandrill-specific features
             */
            async sendEmail(emailOptions: MandrillEmailOptions): Promise<Result<EmailResult>> {
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

                    // Build message for Mandrill API
                    const message: Record<string, unknown> = {
                        from_email: emailOptions.from.email,
                        html: emailOptions.html || "",
                        subject: emailOptions.subject,
                        text: emailOptions.text || "",
                        ...emailOptions.from.name && { from_name: emailOptions.from.name },
                        to: formatAddresses(emailOptions.to),
                    };

                    // Add CC
                    if (emailOptions.cc) {
                        const ccAddresses = formatAddresses(emailOptions.cc);

                        for (const addr of ccAddresses) {
                            addr.type = "cc";
                        }

                        message.to = [...(message.to as { email: string; name?: string; type?: string }[]), ...ccAddresses];
                    }

                    // Add BCC
                    if (emailOptions.bcc) {
                        const bccAddresses = formatAddresses(emailOptions.bcc);

                        for (const addr of bccAddresses) {
                            addr.type = "bcc";
                        }

                        message.to = [...(message.to as { email: string; name?: string; type?: string }[]), ...bccAddresses];
                    }

                    // Add reply-to
                    if (emailOptions.replyTo) {
                        message.headers = {
                            "Reply-To": emailOptions.replyTo.name ? `${emailOptions.replyTo.name} <${emailOptions.replyTo.email}>` : emailOptions.replyTo.email,
                        };
                    }

                    // Add custom headers
                    if (emailOptions.headers) {
                        const headersRecord = headersToRecord(emailOptions.headers);

                        message.headers = {
                            ...(message.headers as Record<string, string>),
                            ...headersRecord,
                        };
                    }

                    // Add tags
                    if (emailOptions.tags && emailOptions.tags.length > 0) {
                        message.tags = emailOptions.tags;
                    }

                    // Add metadata
                    if (emailOptions.metadata) {
                        message.metadata = emailOptions.metadata;
                    }

                    // Add Google Analytics
                    if (emailOptions.googleAnalyticsDomains || emailOptions.googleAnalyticsCampaign) {
                        message.google_analytics_domains = emailOptions.googleAnalyticsDomains;
                        message.google_analytics_campaign = emailOptions.googleAnalyticsCampaign;
                    }

                    // Add subaccount
                    if (emailOptions.subaccount) {
                        message.subaccount = emailOptions.subaccount;
                    }

                    // Add attachments
                    if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                        message.attachments = await Promise.all(
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
                                    type: attachment.contentType || "application/octet-stream",
                                };
                            }),
                        );
                    }

                    // Build payload for Mandrill API
                    const payload: Record<string, unknown> = {
                        key: options.apiKey,
                        message,
                    };

                    // Add template if provided
                    if (emailOptions.templateName) {
                        payload.template_name = emailOptions.templateName;

                        if (emailOptions.templateContent) {
                            payload.template_content = emailOptions.templateContent;
                        }

                        if (emailOptions.templateVariables) {
                            payload.template_vars = emailOptions.templateVariables;
                        }
                    }

                    // Add global merge vars
                    if (emailOptions.globalMergeVars) {
                        message.global_merge_vars = emailOptions.globalMergeVars;
                    }

                    // Add per-recipient merge vars
                    if (emailOptions.mergeVars) {
                        message.merge_vars = emailOptions.mergeVars;
                    }

                    // Add send at
                    if (emailOptions.sendAt) {
                        payload.send_at = emailOptions.sendAt;
                    }

                    logger.debug("Sending email via Mandrill API", {
                        subject: message.subject,
                        to: message.to,
                    });

                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                    };

                    const result = await retry(
                        async () =>
                            makeRequest(
                                `${options.endpoint}/messages/send.json`,
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

                    // Mandrill returns array of results, one per recipient
                    const responseBody = (result.data as { body?: { _id?: string }[] })?.body;
                    const messageId = responseBody?.[0]?._id || generateMessageId();

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
