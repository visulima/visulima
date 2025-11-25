import { Buffer } from "node:buffer";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailResult, Result } from "../../types";
import { generateMessageId } from "../../utils/generate-message-id";
import { headersToRecord } from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import { retry } from "../../utils/retry";
import { validateEmailOptions } from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatSendGridAddress, formatSendGridAddresses, handleProviderError, ProviderState } from "../utils";
import type { ScalewayConfig, ScalewayEmailOptions } from "./types";

const PROVIDER_NAME = "scaleway";
const DEFAULT_ENDPOINT = "https://api.scaleway.com/transactional-email/v1alpha1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Scaleway Provider for sending emails through Scaleway API
 */
export const scalewayProvider: ProviderFactory<ScalewayConfig, unknown, ScalewayEmailOptions> = defineProvider(
    (options_: ScalewayConfig = {} as ScalewayConfig) => {
        if (!options_.apiKey) {
            throw new RequiredOptionError(PROVIDER_NAME, "apiKey");
        }

        if (!options_.region) {
            throw new RequiredOptionError(PROVIDER_NAME, "region");
        }

        const endpoint = options_.endpoint || DEFAULT_ENDPOINT;

        const options: Pick<ScalewayConfig, "logger" | "endpoint"> & Required<Omit<ScalewayConfig, "logger" | "endpoint">> & { endpoint: string } = {
            apiKey: options_.apiKey,
            debug: options_.debug || false,
            endpoint,
            region: options_.region,
            retries: options_.retries || DEFAULT_RETRIES,
            timeout: options_.timeout || DEFAULT_TIMEOUT,
            ...options_.logger && { logger: options_.logger },
        };

        const providerState = new ProviderState();
        const logger = createProviderLogger(PROVIDER_NAME, options.debug, options_.logger);

        return {
            features: {
                attachments: true,
                batchSending: false, // Scaleway doesn't support batch sending
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false, // Scaleway doesn't support scheduling
                tagging: false, // Scaleway doesn't support tags
                templates: true,
                tracking: false, // Scaleway has limited tracking
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
                        "Content-Type": "application/json",
                        "X-Auth-Token": options.apiKey,
                    };

                    logger.debug("Retrieving email details", { id });

                    const result = await retry(
                        async () =>
                            makeRequest(`${options.endpoint}/regions/${options.region}/emails/${id}`, {
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
             * Initialize the Scaleway provider
             */
            async initialize(): Promise<void> {
                await providerState.ensureInitialized(async () => {
                    if (!await this.isAvailable()) {
                        throw new EmailError(PROVIDER_NAME, "Scaleway API not available or invalid API key");
                    }

                    logger.debug("Provider initialized successfully");
                }, PROVIDER_NAME);
            },

            /**
             * Check if Scaleway API is available and credentials are valid
             */
            async isAvailable(): Promise<boolean> {
                try {
                    logger.debug("Checking Scaleway API availability");

                    // Scaleway doesn't have a simple health check, so we'll assume it's available if API key is present
                    return true;
                } catch (error) {
                    logger.debug("Error checking availability:", error);

                    return false;
                }
            },

            name: PROVIDER_NAME,

            options,

            /**
             * Send email through Scaleway API
             * @param emailOptions The email options including Scaleway-specific features
             */
            async sendEmail(emailOptions: ScalewayEmailOptions): Promise<Result<EmailResult>> {
                try {
                    const validationErrors = validateEmailOptions(emailOptions);

                    if (validationErrors.length > 0) {
                        return {
                            error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                            success: false,
                        };
                    }

                    await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                    // Build payload for Scaleway API
                    const payload: Record<string, unknown> = {
                        from: {
                            email: emailOptions.from.email,
                            ...emailOptions.from.name && { name: emailOptions.from.name },
                        },
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

                    // Add project ID
                    if (emailOptions.projectId) {
                        payload.projectId = emailOptions.projectId;
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
                                    name: attachment.filename,
                                    type: attachment.contentType || "application/octet-stream",
                                };
                            }),
                        );
                    }

                    logger.debug("Sending email via Scaleway API", {
                        subject: payload.subject,
                        to: payload.to,
                    });

                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                        "X-Auth-Token": options.apiKey,
                    };

                    const result = await retry(
                        async () =>
                            makeRequest(
                                `${options.endpoint}/regions/${options.region}/emails`,
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

                    // Scaleway returns message ID in response body
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
             * Validate API credentials
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);
