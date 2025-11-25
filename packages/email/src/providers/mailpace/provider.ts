import { Buffer } from "node:buffer";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailResult, Result } from "../../types";
import { generateMessageId } from "../../utils/generate-message-id";
import { headersToRecord } from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import { retry } from "../../utils/retry";
import { validateEmailOptions } from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatAddress, formatMailpaceAddresses, handleProviderError, ProviderState } from "../utils";
import type { MailPaceConfig, MailPaceEmailOptions } from "./types";

const PROVIDER_NAME = "mailpace";
const DEFAULT_ENDPOINT = "https://app.mailpace.com/api/v1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * MailPace Provider for sending emails through MailPace API
 */
export const mailPaceProvider: ProviderFactory<MailPaceConfig, unknown, MailPaceEmailOptions> = defineProvider(
    (options_: MailPaceConfig = {} as MailPaceConfig) => {
        if (!options_.apiToken) {
            throw new RequiredOptionError(PROVIDER_NAME, "apiToken");
        }

        const options: Pick<MailPaceConfig, "logger"> & Required<Omit<MailPaceConfig, "logger">> = {
            apiToken: options_.apiToken,
            debug: options_.debug || false,
            endpoint: options_.endpoint || DEFAULT_ENDPOINT,
            retries: options_.retries || DEFAULT_RETRIES,
            timeout: options_.timeout || DEFAULT_TIMEOUT,
            ...options_.logger && { logger: options_.logger },
        };

        const providerState = new ProviderState();
        const logger = createProviderLogger(PROVIDER_NAME, options.debug, options_.logger);

        return {
            features: {
                attachments: true,
                batchSending: false, // MailPace doesn't support batch sending
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false, // MailPace doesn't support scheduling
                tagging: true,
                templates: true,
                tracking: false, // MailPace has limited tracking
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
                        Authorization: `Bearer ${options.apiToken}`,
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
                    return {
                        error: handleProviderError(PROVIDER_NAME, "retrieve email", error, logger),
                        success: false,
                    };
                }
            },

            /**
             * Initialize the MailPace provider
             */
            async initialize(): Promise<void> {
                await providerState.ensureInitialized(async () => {
                    if (!await this.isAvailable()) {
                        throw new EmailError(PROVIDER_NAME, "MailPace API not available or invalid API token");
                    }

                    logger.debug("Provider initialized successfully");
                }, PROVIDER_NAME);
            },

            /**
             * Check if MailPace API is available and credentials are valid
             */
            async isAvailable(): Promise<boolean> {
                try {
                    const headers: Record<string, string> = {
                        Authorization: `Bearer ${options.apiToken}`,
                        "Content-Type": "application/json",
                    };

                    logger.debug("Checking MailPace API availability");

                    // Check account info
                    const result = await makeRequest(`${options.endpoint}/account`, {
                        headers,
                        method: "GET",
                        timeout: options.timeout,
                    });

                    logger.debug("MailPace API availability check response:", {
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
             * Send email through MailPace API
             * @param emailOptions The email options including MailPace-specific features
             */
            async sendEmail(emailOptions: MailPaceEmailOptions): Promise<Result<EmailResult>> {
                try {
                    const validationErrors = validateEmailOptions(emailOptions);

                    if (validationErrors.length > 0) {
                        return {
                            error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                            success: false,
                        };
                    }

                    await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                    // Build payload for MailPace API
                    const payload: Record<string, unknown> = {
                        from: formatAddress(emailOptions.from),
                        subject: emailOptions.subject,
                        to: formatMailpaceAddresses(emailOptions.to),
                    };

                    // Add HTML content
                    if (emailOptions.html) {
                        payload.htmlbody = emailOptions.html;
                    }

                    // Add text content
                    if (emailOptions.text) {
                        payload.textbody = emailOptions.text;
                    }

                    // Add CC
                    if (emailOptions.cc) {
                        payload.cc = formatMailpaceAddresses(emailOptions.cc);
                    }

                    // Add BCC
                    if (emailOptions.bcc) {
                        payload.bcc = formatMailpaceAddresses(emailOptions.bcc);
                    }

                    // Add reply-to
                    if (emailOptions.replyTo) {
                        payload.replyto = formatAddress(emailOptions.replyTo);
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
                        payload.tags = emailOptions.tags;
                    }

                    // Add list unsubscribe
                    if (emailOptions.listUnsubscribe) {
                        payload.list_unsubscribe = emailOptions.listUnsubscribe;
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
                                    content_type: attachment.contentType || "application/octet-stream",
                                    name: attachment.filename,
                                };
                            }),
                        );
                    }

                    logger.debug("Sending email via MailPace API", {
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

                    // MailPace returns message ID in response body
                    const responseBody = (result.data as { body?: { id?: string } })?.body;
                    const messageId = responseBody?.id || generateMessageId();

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
    },
);
