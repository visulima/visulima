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
import { createProviderLogger, formatPostalAddress, formatPostalAddresses, ProviderState } from "../utils";
import type { PostalConfig, PostalEmailOptions } from "./types";

const PROVIDER_NAME = "postal";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Postal Provider for sending emails through Postal API.
 */
const postalProvider: ProviderFactory<PostalConfig, unknown, PostalEmailOptions> = defineProvider((config: PostalConfig = {} as PostalConfig) => {
    if (!config.host) {
        throw new RequiredOptionError(PROVIDER_NAME, "host");
    }

    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const endpoint = config.endpoint || `https://${config.host}/api/v1`;

    const options: Pick<PostalConfig, "logger"> & Required<Omit<PostalConfig, "logger" | "endpoint">> & { endpoint: string } = {
        apiKey: config.apiKey,
        debug: config.debug || false,
        endpoint,
        host: config.host,
        retries: config.retries || DEFAULT_RETRIES,
        timeout: config.timeout || DEFAULT_TIMEOUT,
        ...(config.logger && { logger: config.logger }),
    };

    const providerState = new ProviderState();
    const logger = createProviderLogger(PROVIDER_NAME, config.logger);

    return {
        features: {
            attachments: true,
            batchSending: false, // Postal doesn't support batch sending
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false, // Postal doesn't support scheduling
            tagging: true,
            templates: true,
            tracking: true,
        },

        /**
         * Retrieves an email by its ID from Postal.
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
                    "Content-Type": "application/json",
                    "X-Server-API-Key": options.apiKey,
                };

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.endpoint}/messages/${id}`, {
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
                logger.debug("Exception retrieving email", error);

                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to retrieve email: ${(error as Error).message}`, { cause: error as Error }),
                    success: false,
                };
            }
        },

        /**
         * Initializes the Postal provider and validates API availability.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "Postal API not available or invalid API key");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the Postal API is available and credentials are valid.
         * @returns True if the API is available and credentials are valid, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    "X-Server-API-Key": options.apiKey,
                };

                logger.debug("Checking Postal API availability");

                // Check server info
                const result = await makeRequest(`${options.endpoint}/server`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                logger.debug("Postal API availability check response:", {
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
         * Sends an email through the Postal API.
         * @param emailOptions The email options. including Postal-specific features
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: PostalEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                // Build payload for Postal API
                const payload: Record<string, unknown> = {
                    from: formatPostalAddress(emailOptions.from).address,
                    subject: emailOptions.subject,
                    to: formatPostalAddresses(emailOptions.to).map((addr) => addr.address),
                };

                // Add HTML content
                if (emailOptions.html) {
                    payload.html_body = emailOptions.html;
                }

                // Add text content
                if (emailOptions.text) {
                    payload.plain_body = emailOptions.text;
                }

                // Add CC
                if (emailOptions.cc) {
                    payload.cc = formatPostalAddresses(emailOptions.cc).map((addr) => addr.address);
                }

                // Add BCC
                if (emailOptions.bcc) {
                    payload.bcc = formatPostalAddresses(emailOptions.bcc).map((addr) => addr.address);
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    payload.reply_to = formatPostalAddress(emailOptions.replyTo).address;
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
                    payload.tag = emailOptions.tags.join(",");
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
                                content_type: attachment.contentType || "application/octet-stream",
                                data: content,
                                name: attachment.filename,
                            };
                        }),
                    );
                }

                logger.debug("Sending email via Postal API", {
                    subject: payload.subject,
                    to: payload.to,
                });

                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    "X-Server-API-Key": options.apiKey,
                };

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/send/message`,
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

                // Postal returns message ID in response body
                const responseBody = (result.data as { body?: { message_id?: number } })?.body;
                const messageId = responseBody?.message_id?.toString() || generateMessageId();

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
         * Validates the Postal API credentials.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});

export default postalProvider;
