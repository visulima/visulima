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
import { createProviderLogger, formatAddress, formatAddressEmails, formatAddresses, handleProviderError, ProviderState } from "../utils";
import type { ResendConfig, ResendEmailOptions, ResendEmailTag } from "./types";

const PROVIDER_NAME = "resend";
const DEFAULT_ENDPOINT = "https://api.resend.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Validates tag format for Resend API.
 * Tags can only contain ASCII letters, numbers, underscores, or dashes.
 * @param tag The tag object to validate.
 * @returns An array of error messages (empty if validation passes).
 */
const validateTag = (tag: ResendEmailTag): string[] => {
    const errors: string[] = [];
    const validPattern = /^[\w-]+$/;

    if (!validPattern.test(tag.name)) {
        errors.push(`Tag name '${tag.name}' must only contain ASCII letters, numbers, underscores, or dashes`);
    }

    if (tag.name.length > 256) {
        errors.push(`Tag name '${tag.name}' exceeds maximum length of 256 characters`);
    }

    if (!validPattern.test(tag.value)) {
        errors.push(`Tag value '${tag.value}' for tag '${tag.name}' must only contain ASCII letters, numbers, underscores, or dashes`);
    }

    return errors;
};

/**
 * Resend Provider for sending emails through Resend API.
 */
// @ts-expect-error - ResendEmailOptions extends Omit<EmailOptions, "tags"> which doesn't satisfy the constraint, but is compatible at runtime
const resendProvider = defineProvider<ResendConfig, unknown, ResendEmailOptions>(((config: ResendConfig = {} as ResendConfig) => {
    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    const options: Pick<ResendConfig, "logger"> & Required<Omit<ResendConfig, "logger">> = {
        apiKey: config.apiKey,
        debug: config.debug || false,
        endpoint: config.endpoint || DEFAULT_ENDPOINT,
        logger: config.logger,
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
         * Retrieves an email by its ID from Resend.
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
         * Initializes the Resend provider and validates API availability.
         * @throws {EmailError} When the Resend API is not available or the API key is invalid.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "Resend API not available or invalid API key");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the Resend API is available and credentials are valid.
         * @returns True if the API is available and credentials are valid, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                if (options.apiKey && options.apiKey.startsWith("re_")) {
                    logger.debug("API key format is valid, assuming Resend is available");

                    return true;
                }

                const headers: Record<string, string> = {
                    Authorization: `Bearer ${options.apiKey}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Checking Resend API availability");

                const result = await makeRequest(`${options.endpoint}/domains`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                if (
                    result.data
                    && typeof result.data === "object"
                    && "body" in result.data
                    && result.data.body
                    && typeof result.data.body === "object"
                    && "name" in result.data.body
                    && result.data.body.name === "restricted_api_key"
                ) {
                    logger.debug("API key is valid but restricted to only sending emails");

                    return true;
                }

                logger.debug("Resend API availability check response:", {
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
         * Sends an email through the Resend API.
         * @param emailOptions The email options including Resend-specific features.
         * @returns A result object containing the email result or an error.
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: ResendEmailOptions): Promise<Result<EmailResult>> {
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
                    headers: emailOptions.headers ? headersToRecord(emailOptions.headers) : {},
                    html: emailOptions.html,
                    subject: emailOptions.subject,
                    text: emailOptions.text,
                    to: formatAddresses(emailOptions.to),
                };

                if (emailOptions.cc) {
                    payload.cc = formatAddressEmails(emailOptions.cc);
                }

                if (emailOptions.bcc) {
                    payload.bcc = formatAddressEmails(emailOptions.bcc);
                }

                if (emailOptions.replyTo) {
                    payload.reply_to = formatAddress(emailOptions.replyTo);
                }

                if (emailOptions.templateId) {
                    payload.template = emailOptions.templateId;

                    if (emailOptions.templateData) {
                        payload.data = emailOptions.templateData;
                    }
                }

                if (emailOptions.scheduledAt) {
                    payload.scheduled_at = typeof emailOptions.scheduledAt === "string" ? emailOptions.scheduledAt : emailOptions.scheduledAt.toISOString();
                }

                if (emailOptions.tags && emailOptions.tags.length > 0) {
                    const tagValidationErrors: string[] = [];

                    emailOptions.tags.forEach((tag) => {
                        const errors = validateTag(tag);

                        if (errors.length > 0) {
                            tagValidationErrors.push(...errors);
                        }
                    });

                    if (tagValidationErrors.length > 0) {
                        return {
                            error: new EmailError(PROVIDER_NAME, `Invalid email tags: ${tagValidationErrors.join(", ")}`),
                            success: false,
                        };
                    }

                    payload.tags = emailOptions.tags.map((tag) => {
                        return {
                            name: tag.name,
                            value: tag.value,
                        };
                    });
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
                                content_type: attachment.contentType,
                                filename: attachment.filename,
                                ...(attachment.path && { path: attachment.path }),
                            };
                        }),
                    );
                }

                logger.debug("Sending email via Resend API", {
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
                            `${options.endpoint}/emails`,
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

                const responseData = result.data as { body?: { id?: string } };
                const messageId
                    = responseData?.body && typeof responseData.body === "object" && responseData.body.id ? responseData.body.id : generateMessageId();

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
         * Validates the Resend API credentials.
         * @returns A promise that resolves to true if credentials are valid, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
    // @ts-expect-error - ResendEmailOptions extends Omit<EmailOptions, "tags"> which doesn't satisfy the constraint, but is compatible at runtime
}) as unknown as ProviderFactory<ResendConfig, unknown, ResendEmailOptions>);

export default resendProvider;
