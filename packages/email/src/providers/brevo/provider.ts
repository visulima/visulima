import { Buffer } from "node:buffer";

import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatSendGridAddress, formatSendGridAddresses, handleProviderError, ProviderState } from "../utils";
import type { BrevoConfig, BrevoEmailOptions } from "./types";

const PROVIDER_NAME = "brevo";
const DEFAULT_ENDPOINT = "https://api.brevo.com/v3";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Brevo Provider for sending emails through Brevo API
 */
// @ts-expect-error - BrevoEmailOptions extends Omit<EmailOptions, "replyTo"> which doesn't satisfy the constraint, but is compatible at runtime
const brevoProvider: ProviderFactory<BrevoConfig, unknown, BrevoEmailOptions> = defineProvider<BrevoConfig, unknown, BrevoEmailOptions>(
    (config: BrevoConfig = {} as BrevoConfig) => {
        if (!config.apiKey) {
            throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
        }

        const endpoint = config.endpoint || DEFAULT_ENDPOINT;

        const options: Pick<BrevoConfig, "logger">
            & Required<Omit<BrevoConfig, "logger" | "endpoint" | "hardValidation">> & { endpoint: string; hardValidation: boolean } = {
                apiKey: config.apiKey,
                debug: config.debug || false,
                endpoint,
                hardValidation: config.hardValidation || false,
                retries: config.retries || DEFAULT_RETRIES,
                timeout: config.timeout || DEFAULT_TIMEOUT,
                ...(config.logger && { logger: config.logger }),
            };

        const providerState = new ProviderState();
        const logger = createProviderLogger(PROVIDER_NAME, config.logger);

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
             * Retrieves an email by its ID from Brevo.
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
                        "api-key": options.apiKey,
                        "Content-Type": "application/json",
                    };

                    logger.debug("Retrieving email details", { id });

                    const result = await retry(
                        async () =>
                            makeRequest(`${options.endpoint}/smtp/emails/${id}`, {
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
                                { cause: result.error },
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
             * Initializes the Brevo provider and validates API availability.
             */
            async initialize(): Promise<void> {
                await providerState.ensureInitialized(async () => {
                    if (!(await this.isAvailable())) {
                        throw new EmailError(PROVIDER_NAME, "Brevo API not available or invalid API key");
                    }

                    logger.debug("Provider initialized successfully");
                }, PROVIDER_NAME);
            },

            /**
             * Checks if the Brevo API is available and credentials are valid.
             * @returns True if the API is available and credentials are valid, false otherwise.
             */
            async isAvailable(): Promise<boolean> {
                try {
                    const headers: Record<string, string> = {
                        "api-key": options.apiKey,
                        "Content-Type": "application/json",
                    };

                    logger.debug("Checking Brevo API availability");

                    const result = await makeRequest(`${options.endpoint}/account`, {
                        headers,
                        method: "GET",
                        timeout: options.timeout,
                    });

                    logger.debug("Brevo API availability check response:", {
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
             * Sends an email through the Brevo API.
             * @param emailOptions The email options. including Brevo-specific features
             */
            // eslint-disable-next-line sonarjs/cognitive-complexity
            async sendEmail(emailOptions: BrevoEmailOptions): Promise<Result<EmailResult>> {
                try {
                    // Normalize replyTo for validation (convert array to single address)
                    let normalizedReplyTo: EmailAddress | undefined;

                    if (Array.isArray(emailOptions.replyTo)) {
                        normalizedReplyTo = emailOptions.replyTo.length > 0 ? emailOptions.replyTo[0] : undefined;
                    } else {
                        normalizedReplyTo = emailOptions.replyTo;
                    }

                    const normalizedOptions = {
                        ...emailOptions,
                        replyTo: normalizedReplyTo,
                    };

                    const validationErrors = validateEmailOptions(normalizedOptions);

                    if (validationErrors.length > 0) {
                        return {
                            error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                            success: false,
                        };
                    }

                    await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                    const payload: Record<string, unknown> = {
                        sender: formatSendGridAddress(emailOptions.from),
                        subject: emailOptions.subject,
                        to: formatSendGridAddresses(emailOptions.to),
                    };

                    if (emailOptions.html) {
                        payload.htmlContent = emailOptions.html;
                    }

                    if (emailOptions.text) {
                        payload.textContent = emailOptions.text;
                    }

                    if (emailOptions.cc) {
                        payload.cc = formatSendGridAddresses(emailOptions.cc);
                    }

                    if (emailOptions.bcc) {
                        payload.bcc = formatSendGridAddresses(emailOptions.bcc);
                    }

                    if (emailOptions.replyTo) {
                        if (Array.isArray(emailOptions.replyTo)) {
                            if (options.hardValidation) {
                                return {
                                    error: new EmailError(PROVIDER_NAME, "Only one replyTo address is allowed"),
                                    success: false,
                                };
                            }

                            // Take the first address from the array
                            if (emailOptions.replyTo.length === 0) {
                                return {
                                    error: new EmailError(PROVIDER_NAME, "replyTo array cannot be empty"),
                                    success: false,
                                };
                            }

                            const firstReplyTo = emailOptions.replyTo[0];

                            if (!firstReplyTo) {
                                return {
                                    error: new EmailError(PROVIDER_NAME, "replyTo array cannot be empty"),
                                    success: false,
                                };
                            }

                            payload.replyTo = formatSendGridAddress(firstReplyTo);
                        } else {
                            payload.replyTo = formatSendGridAddress(emailOptions.replyTo);
                        }
                    }

                    if (emailOptions.templateId) {
                        payload.templateId = emailOptions.templateId;

                        if (emailOptions.templateParams) {
                            payload.params = emailOptions.templateParams;
                        }
                    }

                    if (emailOptions.tags && emailOptions.tags.length > 0) {
                        payload.tags = emailOptions.tags;
                    }

                    if (emailOptions.scheduledAt) {
                        const scheduledDate
                            = typeof emailOptions.scheduledAt === "number" ? new Date(emailOptions.scheduledAt * 1000).toISOString() : emailOptions.scheduledAt;

                        payload.scheduledAt = scheduledDate;
                    }

                    if (emailOptions.batchId) {
                        payload.batchId = emailOptions.batchId;
                    }

                    if (emailOptions.headers) {
                        const headersRecord = headersToRecord(emailOptions.headers);

                        payload.headers = headersRecord;
                    }

                    if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                        payload.attachment = await Promise.all(
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
                                    ...(attachment.contentType && { type: attachment.contentType }),
                                };
                            }),
                        );
                    }

                    logger.debug("Sending email via Brevo API", {
                        subject: payload.subject,
                        to: payload.to,
                    });

                    const headers: Record<string, string> = {
                        "api-key": options.apiKey,
                        "Content-Type": "application/json",
                    };

                    const result = await retry(
                        async () =>
                            makeRequest(
                                `${options.endpoint}/smtp/email`,
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

                    const responseBody = (result.data as { body?: { messageId?: string } })?.body;
                    const messageId = responseBody?.messageId || generateMessageId();

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
             * Validates the Brevo API credentials.
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);

export default brevoProvider;
