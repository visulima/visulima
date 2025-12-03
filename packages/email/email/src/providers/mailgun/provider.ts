import { Buffer } from "node:buffer";

import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { Attachment, EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createMailgunAttachment, createProviderLogger, formatAddress, formatAddresses, handleProviderError, ProviderState } from "../utils";
import type { MailgunConfig, MailgunEmailOptions } from "./types";

const PROVIDER_NAME = "mailgun";
const DEFAULT_ENDPOINT = "https://api.mailgun.net";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Converts an object to form data format for multipart/form-data requests.
 * @param data The data object to convert.
 * @returns A FormData-like string representation.
 */
const objectToFormData = (data: Record<string, unknown>): string => {
    const formData: string[] = [];

    for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                formData.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
            }
        } else if (typeof value === "object") {
            formData.push(`${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}`);
        } else {
            formData.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    }

    return formData.join("&");
};

/**
 * Mailgun Provider for sending emails through Mailgun API
 */
const mailgunProvider: ProviderFactory<MailgunConfig, unknown, MailgunEmailOptions> = defineProvider((config: MailgunConfig = {} as MailgunConfig) => {
    if (!config.apiKey) {
        throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
    }

    if (!config.domain) {
        throw new RequiredOptionError(PROVIDER_NAME, "domain");
    }

    const options: Pick<MailgunConfig, "logger"> & Required<Omit<MailgunConfig, "logger">> = {
        apiKey: config.apiKey,
        debug: config.debug || false,
        domain: config.domain,
        endpoint: config.endpoint || DEFAULT_ENDPOINT,
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
         * Retrieves an email by its ID from Mailgun.
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

                // Mailgun uses events API to retrieve message info
                const auth = Buffer.from(`api:${options.apiKey}`).toString("base64");
                const headers: Record<string, string> = {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Retrieving email details", { id });

                const result = await retry(
                    async () =>
                        makeRequest(`${options.endpoint}/v3/${options.domain}/events?message-id=${encodeURIComponent(id)}&limit=1`, {
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

                // Mailgun Events API returns { items: [...] } structure
                const responseData = result.data as { items?: { message?: { headers?: unknown }; storage?: { url?: string } }[] };
                const items = responseData?.items || [];
                const eventData = items.length > 0 ? items[0] : undefined;

                return {
                    data: eventData?.message?.headers || eventData?.storage || undefined,
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
         * Initializes the Mailgun provider and validates API availability.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "Mailgun API not available or invalid API key/domain");
                }

                logger.debug("Provider initialized successfully");
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the Mailgun API is available and credentials are valid.
         * @returns True if the API is available and credentials are valid, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                const auth = Buffer.from(`api:${options.apiKey}`).toString("base64");
                const headers: Record<string, string> = {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json",
                };

                logger.debug("Checking Mailgun API availability");

                // Check domain validity
                const result = await makeRequest(`${options.endpoint}/v3/domains/${options.domain}`, {
                    headers,
                    method: "GET",
                    timeout: options.timeout,
                });

                logger.debug("Mailgun API availability check response:", {
                    error: result.error instanceof Error ? result.error.message : undefined,
                    statusCode: (result.data as { statusCode?: number })?.statusCode,
                    success: result.success,
                });

                if (!result.success || !result.data || typeof result.data !== "object") {
                    return false;
                }

                const { statusCode } = result.data as { statusCode?: number };

                return typeof statusCode === "number" && statusCode >= 200 && statusCode < 300;
            } catch (error) {
                logger.debug("Error checking availability:", error);

                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Sends an email through the Mailgun API.
         * @param emailOptions The email options. including Mailgun-specific features
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: MailgunEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                // Build form data for Mailgun API
                const formData: Record<string, unknown> = {
                    from: formatAddress(emailOptions.from),
                    to: formatAddresses(emailOptions.to).join(","),
                };

                // Add subject
                if (emailOptions.subject) {
                    formData.subject = emailOptions.subject;
                }

                // Add CC
                if (emailOptions.cc) {
                    formData.cc = formatAddresses(emailOptions.cc).join(",");
                }

                // Add BCC
                if (emailOptions.bcc) {
                    formData.bcc = formatAddresses(emailOptions.bcc).join(",");
                }

                // Add reply-to
                if (emailOptions.replyTo) {
                    formData["h:Reply-To"] = formatAddress(emailOptions.replyTo);
                }

                // Add HTML content
                if (emailOptions.html) {
                    formData.html = emailOptions.html;
                }

                // Add text content
                if (emailOptions.text) {
                    formData.text = emailOptions.text;
                }

                // Add template
                if (emailOptions.template) {
                    formData.template = emailOptions.template;

                    if (emailOptions.templateVariables) {
                        for (const [key, value] of Object.entries(emailOptions.templateVariables)) {
                            formData[`v:${key}`] = value;
                        }
                    }
                }

                // Add tags
                if (emailOptions.tags && emailOptions.tags.length > 0) {
                    formData["o:tag"] = emailOptions.tags;
                }

                // Add campaign ID
                if (emailOptions.campaignId) {
                    formData["o:campaign"] = emailOptions.campaignId;
                }

                // Add delivery time
                if (emailOptions.deliveryTime) {
                    formData["o:deliverytime"]
                        = typeof emailOptions.deliveryTime === "number" ? new Date(emailOptions.deliveryTime * 1000).toUTCString() : emailOptions.deliveryTime;
                }

                // Add tracking options
                if (emailOptions.clickTracking !== undefined) {
                    formData["o:clicktracking"] = emailOptions.clickTracking ? "yes" : "no";
                }

                if (emailOptions.openTracking !== undefined) {
                    formData["o:tracking"] = emailOptions.openTracking ? "yes" : "no";
                }

                if (emailOptions.unsubscribeTracking !== undefined) {
                    formData["o:tracking-clicks"] = emailOptions.unsubscribeTracking ? "yes" : "no";
                }

                // Add test mode
                if (emailOptions.testMode) {
                    formData["o:testmode"] = "yes";
                }

                // Add require TLS
                if (emailOptions.requireTls) {
                    formData["o:require-tls"] = "yes";
                }

                // Add skip verification
                if (emailOptions.skipVerification) {
                    formData["o:skip-verification"] = "yes";
                }

                // Add custom headers
                if (emailOptions.headers) {
                    const headersRecord = headersToRecord(emailOptions.headers);

                    for (const [key, value] of Object.entries(headersRecord)) {
                        formData[`h:${key}`] = value;
                    }
                }

                // Add attachments
                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    // Mailgun requires multipart/form-data for attachments
                    // For now, we'll use form-urlencoded and base64 encode attachments
                    // In a real implementation, you'd use FormData
                    const attachmentResults = await Promise.all(
                        emailOptions.attachments.map((attachment, i) => createMailgunAttachment(attachment as Attachment, PROVIDER_NAME, i)),
                    );

                    for (const attachmentData of attachmentResults) {
                        formData[attachmentData.key] = attachmentData.content;
                    }
                }

                logger.debug("Sending email via Mailgun API", {
                    subject: formData.subject,
                    to: formData.to,
                });

                const auth = Buffer.from(`api:${options.apiKey}`).toString("base64");
                const headers: Record<string, string> = {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                };

                const formBody = objectToFormData(formData);

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/v3/${options.domain}/messages`,
                            {
                                headers,
                                method: "POST",
                                timeout: options.timeout,
                            },
                            formBody,
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

                // Mailgun returns message ID in response body
                const responseBody = (result.data as { body?: { id?: string; message?: string } })?.body;
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
         * Validates the Mailgun API credentials.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});

export default mailgunProvider;
