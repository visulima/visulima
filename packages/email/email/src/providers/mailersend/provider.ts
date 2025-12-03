import { Buffer } from "node:buffer";

import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatSendGridAddress, formatSendGridAddresses, handleProviderError, ProviderState } from "../utils";
import type { MailerSendConfig, MailerSendEmailOptions } from "./types";

const PROVIDER_NAME = "mailersend";
const DEFAULT_ENDPOINT = "https://api.mailersend.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * MailerSend Provider for sending emails through MailerSend API
 */
const mailerSendProvider: ProviderFactory<MailerSendConfig, unknown, MailerSendEmailOptions> = defineProvider(
    (config: MailerSendConfig = {} as MailerSendConfig) => {
        if (!config.apiToken) {
            throw new RequiredOptionError(PROVIDER_NAME, "apiToken");
        }

        const options: Pick<MailerSendConfig, "logger"> & Required<Omit<MailerSendConfig, "logger">> = {
            apiToken: config.apiToken,
            debug: config.debug || false,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            retries: config.retries || DEFAULT_RETRIES,
            timeout: config.timeout || DEFAULT_TIMEOUT,
            ...(config.logger && { logger: config.logger }),
        };

        const providerState = new ProviderState();
        const logger = createProviderLogger(PROVIDER_NAME, config.logger);

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
             * Retrieves an email by its ID from Mailersend.
             * @param id The email ID to retrieve.
             * @returns A result object containing the email details or an error.
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
                            error: new EmailError(
                                PROVIDER_NAME,
                                `Failed to retrieve email: ${result.error instanceof Error ? result.error.message : "Unknown error"}`,
                                {
                                    cause: result.error,
                                },
                            ),
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
             * Initializes the MailerSend provider and validates API availability.
             * @throws {EmailError} When the MailerSend API is not available or the API token is invalid.
             */
            async initialize(): Promise<void> {
                await providerState.ensureInitialized(async () => {
                    if (!(await this.isAvailable())) {
                        throw new EmailError(PROVIDER_NAME, "MailerSend API not available or invalid API token");
                    }

                    logger.debug("Provider initialized successfully");
                }, PROVIDER_NAME);
            },

            /**
             * Checks if the MailerSend API is available and credentials are valid.
             * @returns True if the API is available and credentials are valid, false otherwise.
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
                        error: result.error instanceof Error ? result.error.message : undefined,
                        statusCode: (result.data as { statusCode?: number })?.statusCode,
                        success: result.success,
                    });

                    return Boolean(
                        result.success
                        && result.data
                        && typeof result.data === "object"
                        && "statusCode" in result.data
                        && typeof (result.data as { statusCode?: unknown }).statusCode === "number"
                        && (result.data as { statusCode: number }).statusCode >= 200
                        && (result.data as { statusCode: number }).statusCode < 300,
                    );
                } catch (error) {
                    logger.debug("Error checking availability:", error);

                    return false;
                }
            },

            name: PROVIDER_NAME,

            options,

            /**
             * Sends an email through the MailerSend API.
             * @param emailOptions The email options including MailerSend-specific features.
             * @returns A result object containing the email result or an error.
             */
            // eslint-disable-next-line sonarjs/cognitive-complexity
            async sendEmail(emailOptions: MailerSendEmailOptions): Promise<Result<EmailResult>> {
                try {
                    const validationErrors = validateEmailOptions(emailOptions);

                    if (validationErrors.length > 0) {
                        return {
                            error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                            success: false,
                        };
                    }

                    await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                    // Build payload for MailerSend API
                    const payload: Record<string, unknown> = {
                        from: { email: emailOptions.from.email, name: emailOptions.from.name },
                        subject: emailOptions.subject,
                        to: formatSendGridAddresses(emailOptions.to),
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
                        payload.cc = formatSendGridAddresses(emailOptions.cc);
                    }

                    // Add BCC
                    if (emailOptions.bcc) {
                        payload.bcc = formatSendGridAddresses(emailOptions.bcc);
                    }

                    // Add reply-to
                    if (emailOptions.replyTo) {
                        payload.reply_to = formatSendGridAddress(emailOptions.replyTo);
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
                                    ...(attachment.contentType && { type: attachment.contentType }),
                                    ...(attachment.cid && { id: attachment.cid }),
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
                    return {
                        error: handleProviderError(PROVIDER_NAME, "send email", error, logger),
                        success: false,
                    };
                }
            },

            /**
             * Validates the Mailersend API credentials.
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);

export default mailerSendProvider;
