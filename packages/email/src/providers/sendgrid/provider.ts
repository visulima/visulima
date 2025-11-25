import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailResult, Result } from "../../types";
import { generateMessageId } from "../../utils/generate-message-id";
import { headersToRecord } from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import { retry } from "../../utils/retry";
import { validateEmailOptions } from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import {
    createProviderLogger,
    createSendGridAttachment,
    formatSendGridAddress,
    formatSendGridAddresses,
    handleProviderError,
    ProviderState,
} from "../utils";
import type { SendGridConfig, SendGridEmailOptions } from "./types";

const PROVIDER_NAME = "sendgrid";
const DEFAULT_ENDPOINT = "https://api.sendgrid.com/v3";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * SendGrid Provider for sending emails through SendGrid API
 */
export const sendGridProvider: ProviderFactory<SendGridConfig, unknown, SendGridEmailOptions> = defineProvider(
    (options_: SendGridConfig = {} as SendGridConfig) => {
        if (!options_.apiKey) {
            throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
        }

        const options: Required<SendGridConfig> = {
            apiKey: options_.apiKey,
            debug: options_.debug || false,
            endpoint: options_.endpoint || DEFAULT_ENDPOINT,
            retries: options_.retries || DEFAULT_RETRIES,
            timeout: options_.timeout || DEFAULT_TIMEOUT,
        };

        const providerState = new ProviderState();
        const logger = createProviderLogger(PROVIDER_NAME, options.debug, options_.logger);

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
             * Retrieve email by ID
             * @param id Email ID to retrieve
             * @returns Email details
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
                            error: new EmailError(PROVIDER_NAME, `Failed to retrieve email: ${result.error?.message || "Unknown error"}`, {
                                cause: result.error,
                            }),
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
             * Initialize the SendGrid provider
             */
            async initialize(): Promise<void> {
                await providerState.ensureInitialized(async () => {
                    if (!await this.isAvailable()) {
                        throw new EmailError(PROVIDER_NAME, "SendGrid API not available or invalid API key");
                    }

                    logger.debug("Provider initialized successfully");
                }, PROVIDER_NAME);
            },

            /**
             * Check if SendGrid API is available and credentials are valid
             */
            async isAvailable(): Promise<boolean> {
                try {
                    // SendGrid doesn't have a simple health check endpoint
                    // We'll validate API key format (starts with SG.)
                    if (options.apiKey && options.apiKey.startsWith("SG.")) {
                        logger.debug("API key format is valid, assuming SendGrid is available");

                        return true;
                    }

                    // Try to validate by checking user profile
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
                        error: result.error?.message,
                        statusCode: (result.data as { statusCode?: number })?.statusCode,
                        success: result.success,
                    });

                    return (
                        result.success
                        && result.data
                        && typeof result.data === "object"
                        && "statusCode" in result.data
                        && typeof result.data.statusCode === "number"
                        && result.data.statusCode >= 200
                        && result.data.statusCode < 300
                    );
                } catch (error) {
                    logger.debug("Error checking availability:", error);

                    return false;
                }
            },

            name: PROVIDER_NAME,

            options,

            /**
             * Send email through SendGrid API
             * @param emailOptions The email options including SendGrid-specific features
             */
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

                    // Build personalizations (SendGrid's way of handling recipients)
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
                        personalization.customArgs = emailOptions.tags.reduce(
                            (accumulator, tag, index) => {
                                accumulator[`tag_${index}`] = tag;

                                return accumulator;
                            },
                            {} as Record<string, string>,
                        );
                    }

                    const payload: Record<string, unknown> = {
                        from: formatSendGridAddress(emailOptions.from),
                        personalizations: [personalization],
                    };

                    // Add content
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

                    // Add reply-to
                    if (emailOptions.replyTo) {
                        payload.reply_to = formatSendGridAddress(emailOptions.replyTo);
                    }

                    // Add subject (also in personalizations, but can be at root level)
                    if (emailOptions.subject) {
                        payload.subject = emailOptions.subject;
                    }

                    // Add template ID
                    if (emailOptions.templateId) {
                        payload.template_id = emailOptions.templateId;

                        if (emailOptions.templateData) {
                            // Template data goes in personalizations
                            personalization.dynamicTemplateData = emailOptions.templateData;
                        }
                    }

                    // Add send at timestamp (goes in personalizations)
                    if (emailOptions.sendAt) {
                        personalization.send_at = emailOptions.sendAt;
                    }

                    // Add batch ID
                    if (emailOptions.batchId) {
                        payload.batch_id = emailOptions.batchId;
                    }

                    // Add ASM group ID
                    if (emailOptions.asmGroupId) {
                        payload.asm = {
                            group_id: emailOptions.asmGroupId,
                        };
                    }

                    // Add IP pool name
                    if (emailOptions.ipPoolName) {
                        payload.ip_pool_name = emailOptions.ipPoolName;
                    }

                    // Add mail settings
                    if (emailOptions.mailSettings) {
                        payload.mail_settings = emailOptions.mailSettings;
                    }

                    // Add tracking settings
                    if (emailOptions.trackingSettings) {
                        payload.tracking_settings = emailOptions.trackingSettings;
                    }

                    // Add custom headers
                    if (emailOptions.headers) {
                        const headersRecord = headersToRecord(emailOptions.headers);

                        payload.headers = headersRecord;
                    }

                    // Add attachments
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

                    // SendGrid returns message ID in X-Message-Id header or we generate one
                    const responseHeaders = (result.data as { headers?: Headers })?.headers;
                    let messageId: string;

                    messageId
                        = responseHeaders && responseHeaders instanceof Headers
                            ? responseHeaders.get("X-Message-Id") || generateMessageId()
                            : generateMessageId();

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
             * Validate API credentials
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);
