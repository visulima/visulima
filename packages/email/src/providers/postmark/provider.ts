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
import { createPostmarkAttachment, createProviderLogger, formatAddress, formatAddresses, handleProviderError, ProviderState } from "../utils";
import type { PostmarkConfig, PostmarkEmailOptions } from "./types";

const PROVIDER_NAME = "postmark";
const DEFAULT_ENDPOINT = "https://api.postmarkapp.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Postmark Provider for sending emails through Postmark API.
 */
const postmarkProvider: ProviderFactory<PostmarkConfig, unknown, PostmarkEmailOptions> = defineProvider((config: PostmarkConfig = {} as PostmarkConfig) => {
    if (!config.serverToken) {
        throw new RequiredOptionError(PROVIDER_NAME, "serverToken");
    }

    const options: Pick<PostmarkConfig, "logger"> & Required<Omit<PostmarkConfig, "logger">> = {
        debug: config.debug || false,
        endpoint: config.endpoint || DEFAULT_ENDPOINT,
        retries: config.retries || DEFAULT_RETRIES,
        serverToken: config.serverToken,
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
            scheduling: false, // Postmark doesn't support scheduling
            tagging: true,
            templates: true,
            tracking: true,
        },

        /**
         * Retrieves an email by its ID from Postmark.
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
                    "X-Postmark-Server-Token": options.serverToken,
                };

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.endpoint}/messages/outbound/${id}/details`, {
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
         * Initializes the Postmark provider and validates API availability.
         * @throws {EmailError} When the Postmark API is not available or the server token is invalid.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "Postmark API not available or invalid server token");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the Postmark API is available and credentials are valid.
         * @returns True if the API is available and credentials are valid, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": options.serverToken,
                };

                logger.debug("Checking Postmark API availability");

                // Check server info to validate token
                const result = await makeRequest(`${options.endpoint}/server`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                logger.debug("Postmark API availability check response:", {
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
         * Sends an email through the Postmark API.
         * @param emailOptions The email options including Postmark-specific features.
         * @returns A result object containing the email result or an error.
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: PostmarkEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                // Build payload for Postmark API
                const payload: Record<string, unknown> = {
                    From: formatAddress(emailOptions.from),
                    Subject: emailOptions.subject,
                    To: formatAddresses(emailOptions.to).join(","),
                };

                // Add HTML content
                if (emailOptions.html) {
                    payload.HtmlBody = emailOptions.html;
                }

                // Add text content
                if (emailOptions.text) {
                    payload.TextBody = emailOptions.text;
                }

                // Add CC
                if (emailOptions.cc) {
                    payload.Cc = formatAddresses(emailOptions.cc).join(",");
                }

                // Add BCC
                if (emailOptions.bcc) {
                    payload.Bcc = formatAddresses(emailOptions.bcc).join(",");
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    payload.ReplyTo = formatAddress(emailOptions.replyTo);
                }

                // Add template (either templateId or templateAlias)
                if (emailOptions.templateId) {
                    payload.TemplateId = emailOptions.templateId;

                    if (emailOptions.templateModel) {
                        payload.TemplateModel = emailOptions.templateModel;
                    }
                } else if (emailOptions.templateAlias) {
                    payload.TemplateAlias = emailOptions.templateAlias;

                    if (emailOptions.templateModel) {
                        payload.TemplateModel = emailOptions.templateModel;
                    }
                }

                // Add tracking options
                if (emailOptions.trackOpens !== undefined) {
                    payload.TrackOpens = emailOptions.trackOpens;
                }

                if (emailOptions.trackLinks !== undefined) {
                    payload.TrackLinks = emailOptions.trackLinks;
                }

                // Add inline CSS
                if (emailOptions.inlineCss !== undefined) {
                    payload.InlineCss = emailOptions.inlineCss;
                }

                // Add message stream
                if (emailOptions.messageStream) {
                    payload.MessageStream = emailOptions.messageStream;
                }

                // Add metadata
                if (emailOptions.metadata) {
                    payload.Metadata = emailOptions.metadata;
                }

                // Add tags (Postmark uses Tag field)
                if (emailOptions.tags && emailOptions.tags.length > 0) {
                    const [firstTag] = emailOptions.tags;

                    payload.Tag = firstTag; // Postmark supports single tag, use first one
                }

                // Add custom headers (Postmark expects array of {Name, Value} objects)
                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);
                    const headersArray: { Name: string; Value: string }[] = [];

                    for (const [key, value] of Object.entries(headersRecord)) {
                        headersArray.push({ Name: key, Value: String(value) });
                    }

                    if (headersArray.length > 0) {
                        payload.Headers = headersArray;
                    }
                }

                // Add attachments
                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    payload.Attachments = await Promise.all(
                        emailOptions.attachments.map(async (attachment) => createPostmarkAttachment(attachment, PROVIDER_NAME)),
                    );
                }

                logger.debug("Sending email via Postmark API", {
                    subject: payload.Subject,
                    to: payload.To,
                });

                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": options.serverToken,
                };

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/email`,
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

                // Postmark returns message ID in response body
                const responseBody = (result.data as { body?: { MessageID?: string } })?.body;
                const messageId = responseBody?.MessageID || generateMessageId();

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
         * Validates the Postmark API credentials.
         * @returns A promise that resolves to true if credentials are valid, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});

export default postmarkProvider;
