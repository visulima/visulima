import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailOptions, EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatAddress, formatMailpaceAddresses, handleProviderError, ProviderState } from "../utils";
import type { MailPaceConfig, MailPaceEmailOptions } from "./types";

const PROVIDER_NAME = "mailpace";
const DEFAULT_ENDPOINT = "https://app.mailpace.com/api/v1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * MailPace Provider for sending emails through MailPace API.
 */
// @ts-expect-error - MailPaceEmailOptions extends Omit<EmailOptions, "attachments"> which doesn't satisfy the constraint, but is compatible at runtime
const mailPaceProvider = defineProvider<MailPaceConfig, unknown, MailPaceEmailOptions>(((config: MailPaceConfig = {} as MailPaceConfig) => {
    if (!config.apiToken) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiToken");
    }

    const options: Pick<MailPaceConfig, "logger"> & Required<Omit<MailPaceConfig, "logger">> = {
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
         * Retrieves an email by its ID from Mailpace.
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
         * Initializes the MailPace provider and validates API availability.
         * @throws {EmailError} When the MailPace API is not available or the API token is invalid.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "MailPace API not available or invalid API token");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the MailPace API is available and credentials are valid.
         * @returns True if the API is available and credentials are valid, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                const headers: Record<string, string> = {
                    Authorization: `Bearer ${options.apiToken}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Checking MailPace API availability");

                const result = await makeRequest(`${options.endpoint}/account`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                logger.debug("MailPace API availability check response:", {
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
         * Sends an email through the MailPace API.
         * @param emailOptions The email options including MailPace-specific features.
         * @returns A result object containing the email result or an error.
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: MailPaceEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions as EmailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                const payload: Record<string, unknown> = {
                    from: formatAddress(emailOptions.from),
                    subject: emailOptions.subject,
                    to: formatMailpaceAddresses(emailOptions.to),
                };

                if (emailOptions.html) {
                    payload.htmlbody = emailOptions.html;
                }

                if (emailOptions.text) {
                    payload.textbody = emailOptions.text;
                }

                if (emailOptions.cc) {
                    payload.cc = formatMailpaceAddresses(emailOptions.cc);
                }

                if (emailOptions.bcc) {
                    payload.bcc = formatMailpaceAddresses(emailOptions.bcc);
                }

                if (emailOptions.replyTo) {
                    payload.replyto = formatAddress(emailOptions.replyTo);
                }

                if (emailOptions.templateId) {
                    payload.template_id = emailOptions.templateId;

                    if (emailOptions.templateVariables) {
                        payload.template_variables = emailOptions.templateVariables;
                    }
                }

                if (emailOptions.tags && emailOptions.tags.length > 0) {
                    payload.tags = emailOptions.tags;
                }

                if (emailOptions.listUnsubscribe) {
                    payload.list_unsubscribe = emailOptions.listUnsubscribe;
                }

                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);

                    payload.headers = headersRecord;
                }

                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    payload.attachments = emailOptions.attachments;
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
         * Validates the Mailpace API credentials.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
    // @ts-expect-error - MailPaceEmailOptions extends Omit<EmailOptions, "attachments"> which doesn't satisfy the constraint, but is compatible at runtime
}) as unkown as ProviderFactory<MailPaceConfig, unknown, MailPaceEmailOptions>);

export default mailPaceProvider;
