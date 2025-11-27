import { Buffer } from "node:buffer";

import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatSendGridAddress, formatSendGridAddresses, handleProviderError, ProviderState } from "../utils";
import type { AhaSendConfig, AhaSendEmailOptions } from "./types";

const PROVIDER_NAME = "ahasend";
const DEFAULT_ENDPOINT = "https://api.ahasend.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * AhaSend Provider for sending emails through AhaSend API
 */
const ahaSendProvider: ProviderFactory<AhaSendConfig, unknown, AhaSendEmailOptions> = defineProvider((config: AhaSendConfig = {} as AhaSendConfig) => {
    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const options: Pick<AhaSendConfig, "logger"> & Required<Omit<AhaSendConfig, "logger">> = {
        apiKey: config.apiKey,
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
            scheduling: false, // AhaSend may support scheduling, but not confirmed
            tagging: true,
            templates: true,
            tracking: true,
        },

        /**
         * Retrieves an email by its ID from AhaSend.
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

                await this.initialize();

                const headers: Record<string, string> = {
                    Authorization: `Bearer ${options.apiKey}`,
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
         * Initializes the AhaSend provider and validates API availability.
         * @throws {EmailError} When the AhaSend API is not available or the API key is invalid.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "AhaSend API not available or invalid API key");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the AhaSend API is available and credentials are valid.
         * @returns True if the API is available and credentials are valid, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                logger.debug("Checking AhaSend API availability");

                // Verify API availability using the documented ping endpoint
                const result = await makeRequest(`${options.endpoint}/v2/ping`, {
                    headers: {
                        Authorization: `Bearer ${options.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    method: "GET",
                    timeout: options.timeout,
                });

                if (result.success) {
                    // 2xx – API reachable and credentials accepted.
                    return true;
                }

                const statusCode = (result.data as { statusCode?: number })?.statusCode;

                if (statusCode === 401 || statusCode === 403) {
                    // API reachable but credentials invalid.
                    return false;
                }

                // Other non‑2xx/non‑auth errors: treat as unavailable.
                return false;
            } catch (error) {
                logger.debug("Error checking availability:", error);

                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Sends an email through the AhaSend API.
         * @param emailOptions The email options including AhaSend-specific features.
         * @returns A result object containing the email result or an error.
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: AhaSendEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await this.initialize();

                // Build payload for AhaSend API (standard REST API pattern)
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
                    payload.replyTo = formatSendGridAddress(emailOptions.replyTo);
                }

                // Add template
                if (emailOptions.templateId) {
                    payload.templateId = emailOptions.templateId;

                    if (emailOptions.templateVariables) {
                        payload.templateVariables = emailOptions.templateVariables;
                    }
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
                                contentType: attachment.contentType || "application/octet-stream",
                                filename: attachment.filename,
                                ...(attachment.cid && { cid: attachment.cid }),
                            };
                        }),
                    );
                }

                logger.debug("Sending email via AhaSend API", {
                    subject: payload.subject,
                    to: payload.to,
                });

                const headers: Record<string, string> = {
                    Authorization: `Bearer ${options.apiKey}`,
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

                // AhaSend returns message ID in response body
                const responseBody = (result.data as { body?: { id?: string; messageId?: string } })?.body;
                const messageId = responseBody?.messageId || responseBody?.id || generateMessageId();

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
         * Validates the AhaSend API credentials.
         * @returns A promise that resolves to true if credentials are valid, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});

export default ahaSendProvider;
