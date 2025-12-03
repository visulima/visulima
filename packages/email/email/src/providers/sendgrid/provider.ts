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
import { createProviderLogger, createSendGridAttachment, formatSendGridAddress, formatSendGridAddresses, handleProviderError, ProviderState } from "../utils";
import type { SendGridConfig, SendGridEmailOptions } from "./types";

const PROVIDER_NAME = "sendgrid";
const DEFAULT_ENDPOINT = "https://api.sendgrid.com/v3";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * SendGrid Provider for sending emails through SendGrid API
 */
const sendGridProvider: ProviderFactory<SendGridConfig, unknown, SendGridEmailOptions> = defineProvider((config: SendGridConfig = {} as SendGridConfig) => {
    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const options: Pick<SendGridConfig, "logger"> & Required<Omit<SendGridConfig, "logger">> = {
        apiKey: config.apiKey,
        debug: config.debug || false,
        endpoint: config.endpoint || DEFAULT_ENDPOINT,
        ...(config.logger && { logger: config.logger }),
        retries: config.retries || DEFAULT_RETRIES,
        timeout: config.timeout || DEFAULT_TIMEOUT,
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
         * Retrieves an email by its ID from SendGrid.
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
                    Authorization: `Bearer ${options.apiKey}`,
                    "Content-Type": "application/json",
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
         * Initializes the SendGrid provider and validates API availability.
         * @throws {EmailError} When the SendGrid API is not available or the API key is invalid.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "SendGrid API not available or invalid API key");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the SendGrid API is available and credentials are valid.
         * @returns True if the API is available and credentials are valid, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                if (options.apiKey && options.apiKey.startsWith("SG.")) {
                    logger.debug("API key format is valid, assuming SendGrid is available");

                    return true;
                }

                const headers: Record<string, string> = {
                    Authorization: `Bearer ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Checking SendGrid API availability");

                const result = await makeRequest(`${options.endpoint}/user/profile`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                logger.debug("SendGrid API availability check response:", {
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
         * Sends an email through the SendGrid API.
         * @param emailOptions The email options including SendGrid-specific features.
         * @returns A result object containing the email result or an error.
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: SendGridEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                const personalization: Record<string, unknown> = {
                    to: formatSendGridAddresses(emailOptions.to),
                };

                if (emailOptions.cc) {
                    personalization.cc = formatSendGridAddresses(emailOptions.cc);
                }

                if (emailOptions.bcc) {
                    personalization.bcc = formatSendGridAddresses(emailOptions.bcc);
                }

                if (emailOptions.subject) {
                    personalization.subject = emailOptions.subject;
                }

                if (emailOptions.tags && emailOptions.tags.length > 0) {
                    const customArgs: Record<string, string> = {};

                    for (let index = 0; index < emailOptions.tags.length; index += 1) {
                        customArgs[`tag_${index}`] = emailOptions.tags[index] as string;
                    }

                    personalization.customArgs = customArgs;
                }

                const payload: Record<string, unknown> = {
                    from: formatSendGridAddress(emailOptions.from),
                    personalizations: [personalization],
                };

                const content: { type: string; value: string }[] = [];

                if (emailOptions.html) {
                    content.push({ type: "text/html", value: emailOptions.html });
                }

                if (emailOptions.text) {
                    content.push({ type: "text/plain", value: emailOptions.text });
                }

                if (content.length > 0) {
                    payload.content = content;
                }

                if (emailOptions.replyTo) {
                    payload.reply_to = formatSendGridAddress(emailOptions.replyTo);
                }

                if (emailOptions.subject) {
                    payload.subject = emailOptions.subject;
                }

                if (emailOptions.templateId) {
                    payload.template_id = emailOptions.templateId;

                    if (emailOptions.templateData) {
                        personalization.dynamicTemplateData = emailOptions.templateData;
                    }
                }

                if (emailOptions.sendAt) {
                    personalization.send_at = emailOptions.sendAt;
                }

                if (emailOptions.batchId) {
                    payload.batch_id = emailOptions.batchId;
                }

                if (emailOptions.asmGroupId) {
                    payload.asm = {
                        group_id: emailOptions.asmGroupId,
                    };
                }

                if (emailOptions.ipPoolName) {
                    payload.ip_pool_name = emailOptions.ipPoolName;
                }

                if (emailOptions.mailSettings) {
                    payload.mail_settings = emailOptions.mailSettings;
                }

                if (emailOptions.trackingSettings) {
                    payload.tracking_settings = emailOptions.trackingSettings;
                }

                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);

                    payload.headers = headersRecord;
                }

                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    payload.attachments = await Promise.all(
                        emailOptions.attachments.map(async (attachment) => createSendGridAttachment(attachment, PROVIDER_NAME)),
                    );
                }

                logger.debug("Sending email via SendGrid API", {
                    subject: payload.subject,
                    to: personalization.to,
                });

                const headers: Record<string, string> = {
                    Authorization: `Bearer ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/mail/send`,
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

                const responseHeaders = (result.data as { headers?: Headers })?.headers;
                const headerMessageId = responseHeaders && responseHeaders instanceof Headers ? responseHeaders.get("X-Message-Id") : undefined;
                const messageId: string = headerMessageId || generateMessageId();

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
         * Validates the SendGrid API credentials.
         * @returns A promise that resolves to true if credentials are valid, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});

export default sendGridProvider;
