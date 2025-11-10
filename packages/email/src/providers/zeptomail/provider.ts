import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import { generateMessageId } from "../../utils/generate-message-id";
import { headersToRecord } from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import { retry } from "../../utils/retry";
import { validateEmailOptions } from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, formatZeptomailAddress, formatZeptomailAddresses, handleProviderError, ProviderState } from "../utils";
import type { ZeptomailConfig, ZeptomailEmailOptions } from "./types";

// Constants
const PROVIDER_NAME = "zeptomail";
const DEFAULT_ENDPOINT = "https://api.zeptomail.com/v1.1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Zeptomail Provider for sending emails through Zeptomail API
 */
export const zeptomailProvider: ProviderFactory<ZeptomailConfig, unknown, ZeptomailEmailOptions> = defineProvider(
    (options_: ZeptomailConfig = {} as ZeptomailConfig) => {
        // Validate required options
        if (!options_.token) {
            throw new RequiredOptionError(PROVIDER_NAME, "token");
        }

        // Make sure token has correct format
        if (!options_.token.startsWith("Zoho-enczapikey ")) {
            throw new EmailError(PROVIDER_NAME, "Token should be in the format \"Zoho-enczapikey <your_api_key>\"");
        }

        // Initialize with defaults
        const options: Pick<ZeptomailConfig, "token"> & Required<Omit<ZeptomailConfig, "token">> = {
            debug: options_.debug || false,
            endpoint: options_.endpoint || DEFAULT_ENDPOINT,
            retries: options_.retries || DEFAULT_RETRIES,
            timeout: options_.timeout || DEFAULT_TIMEOUT,
            token: options_.token,
        };

        const providerState = new ProviderState();
        const logger = createProviderLogger(PROVIDER_NAME, options.debug, options_.logger);

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
             * Initialize the Zeptomail provider
             */
            async initialize(): Promise<void> {
                await providerState.ensureInitialized(async () => {
                    // Test endpoint availability and credentials
                    if (!await this.isAvailable()) {
                        throw new EmailError(PROVIDER_NAME, "Zeptomail API not available or invalid token");
                    }

                    logger.debug("Provider initialized successfully");
                }, PROVIDER_NAME);
            },

            /**
             * Check if Zeptomail API is available and credentials are valid
             */
            async isAvailable(): Promise<boolean> {
                try {
                    // Since Zeptomail doesn't have a dedicated endpoint to check token,
                    // we'll just check if token exists and has correct format
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
             * Send email through Zeptomail API
             * @param emailOpts The email options including Zeptomail-specific features
             */
            async sendEmail(emailOptions: ZeptomailEmailOptions): Promise<Result<EmailResult>> {
                try {
                    // Validate email options
                    const validationErrors = validateEmailOptions(emailOptions);

                    if (validationErrors.length > 0) {
                        return {
                            error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                            success: false,
                        };
                    }

                    // Make sure provider is initialized
                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);


                    // Prepare request payload
                    const payload: Record<string, any> = {
                        from: formatZeptomailAddress(emailOptions.from),
                        subject: emailOptions.subject,
                        to: formatZeptomailAddresses(emailOptions.to),
                    };

                    // Add text body if present
                    if (emailOptions.text) {
                        payload.textbody = emailOptions.text;
                    }

                    // Add HTML body if present
                    if (emailOptions.html) {
                        payload.htmlbody = emailOptions.html;
                    }

                    // Add CC if present
                    if (emailOptions.cc) {
                        payload.cc = formatZeptomailAddresses(emailOptions.cc);
                    }

                    // Add BCC if present
                    if (emailOptions.bcc) {
                        payload.bcc = formatZeptomailAddresses(emailOptions.bcc);
                    }

                    // Add reply-to if present
                    if (emailOptions.replyTo) {
                        payload.reply_to = [formatZeptomailAddress(emailOptions.replyTo)];
                    }

                    // Add tracking options if present
                    if (emailOptions.trackClicks !== undefined) {
                        payload.track_clicks = emailOptions.trackClicks;
                    }

                    if (emailOptions.trackOpens !== undefined) {
                        payload.track_opens = emailOptions.trackOpens;
                    }

                    // Add client reference if present
                    if (emailOptions.clientReference) {
                        payload.client_reference = emailOptions.clientReference;
                    }

                    // Add MIME headers if present
                    if (emailOptions.mimeHeaders && Object.keys(emailOptions.mimeHeaders).length > 0) {
                        payload.mime_headers = Object.entries(emailOptions.mimeHeaders).reduce(
                            (accumulator, [key, value]) => {
                                accumulator[key] = value;

                                return accumulator;
                            },
                            {} as Record<string, string>,
                        );
                    }

                    // Add custom headers if present
                    if (emailOptions.headers) {
                        const headersRecord = headersToRecord(emailOptions.headers);

                        if (Object.keys(headersRecord).length > 0) {
                            // Zeptomail doesn't have a dedicated field for custom headers, so we'll merge them into mime_headers
                            if (!payload.mime_headers) {
                                payload.mime_headers = {};
                            }

                            Object.entries(headersRecord).forEach(([key, value]) => {
                                payload.mime_headers[key] = value;
                            });
                        }
                    }

                    // Add attachments if present
                    if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                        payload.attachments = emailOptions.attachments.map((attachment) => {
                            const attachmentData: Record<string, any> = {
                                name: attachment.filename,
                            };

                            // Use content if provided
                            if (attachment.content) {
                                attachmentData.content = typeof attachment.content === "string" ? attachment.content : attachment.content.toString("base64");

                                if (attachment.contentType) {
                                    attachmentData.mime_type = attachment.contentType;
                                }
                            }
                            // Or use file_cache_key if available (assuming this is something supported by Zeptomail)
                            else if (attachment.path) {
                                attachmentData.file_cache_key = attachment.path;
                            }

                            return attachmentData;
                        });
                    }

                    logger.debug("Sending email via Zeptomail API", {
                        subject: payload.subject,
                        to: payload.to,
                    });

                    // Create headers with API token
                    const headers: Record<string, string> = {
                        Accept: "application/json",
                        Authorization: options.token,
                        "Content-Type": "application/json",
                    };

                    // Send request with retry capability
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
                        logger.debug("API request failed", result.error);

                        // Enhanced error messages based on response
                        let errorMessage = result.error?.message || "Unknown error";

                        // Try to extract any error details from the response body
                        if (result.data?.body?.message) {
                            errorMessage += ` Details: ${result.data.body.message}`;
                        } else if (result.data?.body?.error?.message) {
                            errorMessage += ` Details: ${result.data.body.error.message}`;
                        }

                        return {
                            error: new EmailError(PROVIDER_NAME, `Failed to send email: ${errorMessage}`, { cause: result.error }),
                            success: false,
                        };
                    }

                    // Extract information from response
                    const responseData = result.data.body;
                    // Zeptomail returns a request_id in the successful response
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
             * Validate API credentials
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);
