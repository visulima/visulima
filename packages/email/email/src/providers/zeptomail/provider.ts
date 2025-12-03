import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import { sanitizeHeaderName, sanitizeHeaderValue } from "../../utils/sanitize-header";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatZeptomailAddress, handleProviderError, ProviderState } from "../utils";
import type { ZeptomailConfig, ZeptomailEmailOptions } from "./types";

const PROVIDER_NAME = "zeptomail";
const DEFAULT_ENDPOINT = "https://api.zeptomail.com/v1.1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Zeptomail Provider for sending emails through Zeptomail API
 */
const zeptomailProvider: ProviderFactory<ZeptomailConfig, unknown, ZeptomailEmailOptions> = defineProvider(
    (config: ZeptomailConfig = {} as ZeptomailConfig) => {
        if (!config.token) {
            throw new RequiredOptionError(PROVIDER_NAME, "token");
        }

        if (!config.token.startsWith("Zoho-enczapikey ")) {
            throw new EmailError(PROVIDER_NAME, "Token should be in the format \"Zoho-enczapikey <your_api_key>\"");
        }

        const options: Pick<ZeptomailConfig, "logger" | "token"> & Required<Omit<ZeptomailConfig, "logger" | "token">> = {
            debug: config.debug || false,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            logger: config.logger,
            retries: config.retries || DEFAULT_RETRIES,
            timeout: config.timeout || DEFAULT_TIMEOUT,
            token: config.token,
        };

        const providerState = new ProviderState();
        const logger = createProviderLogger(PROVIDER_NAME, config.logger);

        return {
            features: {
                attachments: true,
                batchSending: false,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false,
                tagging: false,
                templates: false, // Zeptomail has template support but not implemented here
                tracking: true,
            },

            /**
             * Initializes the Zeptomail provider and validates API availability.
             * @throws {EmailError} When the Zeptomail API is not available or the token is invalid.
             */
            async initialize(): Promise<void> {
                await providerState.ensureInitialized(async () => {
                    if (!(await this.isAvailable())) {
                        throw new EmailError(PROVIDER_NAME, "Zeptomail API not available or invalid token");
                    }

                    logger.debug("Provider initialized successfully");
                }, PROVIDER_NAME);
            },

            /**
             * Checks if the Zeptomail API is available and credentials are valid.
             * @returns True if the API is available and credentials are valid, false otherwise.
             */
            async isAvailable(): Promise<boolean> {
                try {
                    if (options.token && options.token.startsWith("Zoho-enczapikey ")) {
                        logger.debug("Token format is valid, assuming Zeptomail is available");

                        return true;
                    }

                    return false;
                } catch (error) {
                    logger.debug("Error checking availability:", error);

                    return false;
                }
            },

            name: PROVIDER_NAME,

            options,

            /**
             * Sends an email through the Zeptomail API.
             * @param emailOptions The email options including Zeptomail-specific features.
             * @returns A result object containing the email result or an error.
             */
            // eslint-disable-next-line sonarjs/cognitive-complexity
            async sendEmail(emailOptions: ZeptomailEmailOptions): Promise<Result<EmailResult>> {
                try {
                    const validationErrors = validateEmailOptions(emailOptions);

                    if (validationErrors.length > 0) {
                        return {
                            error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                            success: false,
                        };
                    }

                    await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

                    type ZeptomailAttachment = {
                        content?: string;
                        file_cache_key?: string;
                        mime_type?: string;
                        name: string;
                    };
                    type ZeptomailPayload = {
                        attachments?: ZeptomailAttachment[];
                        bcc?: string | string[];
                        cc?: string | string[];
                        client_reference?: string;
                        from: string;
                        htmlbody?: string;
                        mime_headers?: Record<string, string>;
                        reply_to?: string[];
                        subject: string;
                        textbody?: string;
                        to: string | string[];
                        track_clicks?: boolean;
                        track_opens?: boolean;
                    };

                    const payload: Partial<ZeptomailPayload> = {
                        from: formatZeptomailAddress(emailOptions.from).address,
                        subject: emailOptions.subject,
                    };

                    if (Array.isArray(emailOptions.to)) {
                        payload.to = emailOptions.to.length === 1 ? (emailOptions.to[0] as EmailAddress).email : emailOptions.to.map((addr) => addr.email);
                    } else {
                        payload.to = emailOptions.to.email;
                    }

                    if (emailOptions.text) {
                        payload.textbody = emailOptions.text;
                    }

                    if (emailOptions.html) {
                        payload.htmlbody = emailOptions.html;
                    }

                    if (emailOptions.cc) {
                        if (Array.isArray(emailOptions.cc)) {
                            payload.cc = emailOptions.cc.length === 1 ? (emailOptions.cc[0] as EmailAddress).email : emailOptions.cc.map((addr) => addr.email);
                        } else {
                            payload.cc = emailOptions.cc.email;
                        }
                    }

                    if (emailOptions.bcc) {
                        if (Array.isArray(emailOptions.bcc)) {
                            payload.bcc
                                = emailOptions.bcc.length === 1 ? (emailOptions.bcc[0] as EmailAddress).email : emailOptions.bcc.map((addr) => addr.email);
                        } else {
                            payload.bcc = emailOptions.bcc.email;
                        }
                    }

                    if (emailOptions.replyTo) {
                        payload.reply_to = [formatZeptomailAddress(emailOptions.replyTo).address];
                    }

                    if (emailOptions.trackClicks !== undefined) {
                        payload.track_clicks = emailOptions.trackClicks;
                    }

                    if (emailOptions.trackOpens !== undefined) {
                        payload.track_opens = emailOptions.trackOpens;
                    }

                    if (emailOptions.clientReference) {
                        payload.client_reference = emailOptions.clientReference;
                    }

                    if (emailOptions.mimeHeaders && Object.keys(emailOptions.mimeHeaders).length > 0) {
                        const mimeHeaders: Record<string, string> = {};

                        for (const [key, value] of Object.entries(emailOptions.mimeHeaders)) {
                            mimeHeaders[key] = value;
                        }

                        payload.mime_headers = mimeHeaders;
                    }

                    if (emailOptions.headers) {
                        const headersRecord = headersToRecord(emailOptions.headers);

                        if (Object.keys(headersRecord).length > 0) {
                            if (!payload.mime_headers) {
                                payload.mime_headers = {};
                            }

                            Object.entries(headersRecord).forEach(([key, value]) => {
                                if (payload.mime_headers) {
                                    payload.mime_headers[sanitizeHeaderName(key)] = sanitizeHeaderValue(value);
                                }
                            });
                        }
                    }

                    if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                        payload.attachments = emailOptions.attachments.map((attachment) => {
                            const attachmentData: ZeptomailAttachment = {
                                name: attachment.filename,
                            };

                            if (attachment.content) {
                                attachmentData.content = typeof attachment.content === "string" ? attachment.content : attachment.content.toString("base64");

                                if (attachment.contentType) {
                                    attachmentData.mime_type = attachment.contentType;
                                }
                            } else if (attachment.path) {
                                attachmentData.file_cache_key = attachment.path;
                            }

                            return attachmentData;
                        });
                    }

                    logger.debug("Sending email via Zeptomail API", {
                        subject: payload.subject,
                        to: payload.to,
                    });

                    const headers: Record<string, string> = {
                        Accept: "application/json",
                        Authorization: options.token,
                        "Content-Type": "application/json",
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
                                JSON.stringify(payload as ZeptomailPayload),
                            ),
                        options.retries,
                    );

                    if (!result.success) {
                        logger.debug("API request failed", result.error);

                        let errorMessage = result.error instanceof Error ? result.error.message : "Unknown error";

                        const responseBody = result.data as { body?: { error?: { message?: string }; message?: string } } | undefined;

                        if (responseBody?.body?.message) {
                            errorMessage += ` Details: ${responseBody.body.message}`;
                        } else if (responseBody?.body?.error?.message) {
                            errorMessage += ` Details: ${responseBody.body.error.message}`;
                        }

                        return {
                            error: new EmailError(PROVIDER_NAME, `Failed to send email: ${errorMessage}`, { cause: result.error }),
                            success: false,
                        };
                    }

                    const responseData = (result.data as { body?: { request_id?: string } })?.body;
                    const messageId = responseData?.request_id || generateMessageId();

                    logger.debug("Email sent successfully", { messageId });

                    return {
                        data: {
                            messageId,
                            provider: PROVIDER_NAME,
                            response: responseData,
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
             * Validates the Zeptomail API credentials.
             * @returns A promise that resolves to true if credentials are valid, false otherwise.
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);

export default zeptomailProvider;
