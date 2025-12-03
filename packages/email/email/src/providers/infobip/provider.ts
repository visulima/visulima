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
import { createProviderLogger, formatAddressEmails, handleProviderError, ProviderState } from "../utils";
import type { InfobipConfig, InfobipEmailOptions } from "./types";

const PROVIDER_NAME = "infobip";
const DEFAULT_BASE_URL = "https://api.infobip.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Infobip Provider for sending emails through Infobip API
 */
const infobipProvider: ProviderFactory<InfobipConfig, unknown, InfobipEmailOptions> = defineProvider((config: InfobipConfig = {} as InfobipConfig) => {
    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    const endpoint = config.endpoint || `${baseUrl}/email/3/send`;

    const options: Pick<InfobipConfig, "logger"> & Required<Omit<InfobipConfig, "logger" | "baseUrl" | "endpoint">> & { baseUrl: string; endpoint: string } = {
        apiKey: config.apiKey,
        baseUrl,
        debug: config.debug || false,
        endpoint,
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
            tagging: false, // Infobip doesn't support tags
            templates: true,
            tracking: true,
        },

        /**
         * Retrieves an email by its ID from Infobip.
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
                    Authorization: `App ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.baseUrl}/email/3/reports/${id}`, {
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
         * Initializes the Infobip provider and validates API availability.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "Infobip API not available or invalid API key");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the Infobip API is available and credentials are valid.
         * @returns True if the API is available and credentials are valid, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                logger.debug("Checking Infobip API availability");

                // Use account info endpoint to validate API key
                const headers: Record<string, string> = {
                    Authorization: `App ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                const result = await makeRequest(`${options.baseUrl}/account/1/me`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                return result.success;
            } catch (error) {
                logger.debug("Error checking availability:", error);

                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Sends an email through the Infobip API.
         * @param emailOptions The email options. including Infobip-specific features
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: InfobipEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                const payload: Record<string, unknown> = {
                    from: typeof emailOptions.from === "string" ? emailOptions.from : emailOptions.from.email,
                    subject: emailOptions.subject,
                    to: formatAddressEmails(emailOptions.to),
                };

                if (emailOptions.html) {
                    payload.html = emailOptions.html;
                }

                if (emailOptions.text) {
                    payload.text = emailOptions.text;
                }

                if (emailOptions.cc) {
                    payload.cc = formatAddressEmails(emailOptions.cc);
                }

                if (emailOptions.bcc) {
                    payload.bcc = formatAddressEmails(emailOptions.bcc);
                }

                if (emailOptions.replyTo) {
                    payload.replyTo = typeof emailOptions.replyTo === "string" ? emailOptions.replyTo : emailOptions.replyTo.email;
                }

                if (emailOptions.templateId) {
                    payload.templateId = emailOptions.templateId;

                    if (emailOptions.templateVariables) {
                        payload.templateData = emailOptions.templateVariables;
                    }
                }

                if (emailOptions.trackingUrl) {
                    payload.trackingUrl = emailOptions.trackingUrl;
                }

                if (emailOptions.notifyUrl) {
                    payload.notifyUrl = emailOptions.notifyUrl;
                }

                if (emailOptions.intermediateReport !== undefined) {
                    payload.intermediateReport = emailOptions.intermediateReport;
                }

                if (emailOptions.sendAt) {
                    payload.sendAt = emailOptions.sendAt;
                }

                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);

                    payload.headers = headersRecord;
                }

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
                                name: attachment.filename,
                            };
                        }),
                    );
                }

                logger.debug("Sending email via Infobip API", {
                    subject: payload.subject,
                    to: payload.to,
                });

                const headers: Record<string, string> = {
                    Authorization: `App ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                const result = await retry(
                    async () =>
                        makeRequest(
                            options.endpoint,
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

                const responseBody = (result.data as { body?: { messages?: { messageId?: string }[] } })?.body;
                const messageId = responseBody?.messages?.[0]?.messageId || generateMessageId();

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
         * Validates the Infobip API credentials.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});

export default infobipProvider;
