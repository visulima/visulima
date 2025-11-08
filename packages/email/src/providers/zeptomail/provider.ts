import type { EmailAddress, EmailResult, Result } from "../../types.js";
import type { ZeptomailConfig } from "../../types.js";
import type { ProviderFactory } from "../provider.js";
import type { ZeptomailEmailOptions } from "./types.js";
import { createError, createRequiredError, generateMessageId, makeRequest, retry, validateEmailOptions } from "../../utils.js";
import { defineProvider } from "../provider.js";

// Constants
const PROVIDER_NAME = "zeptomail";
const DEFAULT_ENDPOINT = "https://api.zeptomail.com/v1.1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Zeptomail Provider for sending emails through Zeptomail API
 */
export const zeptomailProvider: ProviderFactory<ZeptomailConfig, unknown, ZeptomailEmailOptions> = defineProvider(
    (opts: ZeptomailConfig = {} as ZeptomailConfig) => {
        // Validate required options
        if (!opts.token) {
            throw createRequiredError(PROVIDER_NAME, "token");
        }

        // Make sure token has correct format
        if (!opts.token.startsWith("Zoho-enczapikey ")) {
            throw createError(PROVIDER_NAME, 'Token should be in the format "Zoho-enczapikey <your_api_key>"');
        }

        // Initialize with defaults
        const options: Required<ZeptomailConfig> = {
            debug: opts.debug || false,
            timeout: opts.timeout || DEFAULT_TIMEOUT,
            retries: opts.retries || DEFAULT_RETRIES,
            token: opts.token,
            endpoint: opts.endpoint || DEFAULT_ENDPOINT,
        };

        let isInitialized = false;

        // Debug helper
        const debug = (message: string, ...args: unknown[]): void => {
            if (options.debug) {
                console.log(`[${PROVIDER_NAME}] ${message}`, ...args);
            }
        };

        return {
            name: PROVIDER_NAME,
            features: {
                attachments: true,
                html: true,
                templates: false,
                tracking: true,
                customHeaders: true,
                batchSending: false,
                scheduling: false,
                replyTo: true,
                tagging: false,
            },
            options,

            /**
             * Initialize the Zeptomail provider
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    if (!(await this.isAvailable())) {
                        throw createError(PROVIDER_NAME, "Zeptomail API not available or invalid token");
                    }

                    isInitialized = true;
                    debug("Provider initialized successfully");
                } catch (error) {
                    throw createError(
                        PROVIDER_NAME,
                        `Failed to initialize: ${(error as Error).message}`,
                        { cause: error as Error },
                    );
                }
            },

            /**
             * Check if Zeptomail API is available
             */
            async isAvailable(): Promise<boolean> {
                // Token format validation is already done in constructor
                // For a real check, we could call a status endpoint
                return options.token.startsWith("Zoho-enczapikey ");
            },

            /**
             * Send email through Zeptomail API
             */
            async sendEmail(emailOpts: ZeptomailEmailOptions): Promise<Result<EmailResult>> {
                try {
                    // Validate email options
                    const validationErrors = validateEmailOptions(emailOpts);
                    if (validationErrors.length > 0) {
                        return {
                            success: false,
                            error: createError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        };
                    }

                    if (!isInitialized) {
                        await this.initialize();
                    }

                    // Format recipients
                    const formatRecipients = (addresses: EmailAddress | EmailAddress[]): Array<{ address: { email: string; name?: string } }> => {
                        if (Array.isArray(addresses)) {
                            return addresses.map((addr) => ({
                                address: {
                                    email: addr.email,
                                    name: addr.name,
                                },
                            }));
                        }
                        return [
                            {
                                address: {
                                    email: addresses.email,
                                    name: addresses.name,
                                },
                            },
                        ];
                    };

                    // Prepare request payload
                    const payload: Record<string, unknown> = {
                        from: {
                            address: {
                                email: emailOpts.from.email,
                                name: emailOpts.from.name,
                            },
                        },
                        to: formatRecipients(emailOpts.to),
                        subject: emailOpts.subject,
                    };

                    if (emailOpts.html) {
                        payload.htmlbody = emailOpts.html;
                    }

                    if (emailOpts.text) {
                        payload.textbody = emailOpts.text;
                    }

                    if (emailOpts.cc) {
                        payload.cc = formatRecipients(emailOpts.cc);
                    }

                    if (emailOpts.bcc) {
                        payload.bcc = formatRecipients(emailOpts.bcc);
                    }

                    if (emailOpts.replyTo) {
                        payload.reply_to = {
                            address: {
                                email: emailOpts.replyTo.email,
                                name: emailOpts.replyTo.name,
                            },
                        };
                    }

                    if (emailOpts.headers) {
                        payload.headers = emailOpts.headers;
                    }

                    if (emailOpts.attachments) {
                        payload.attachments = emailOpts.attachments.map((att) => ({
                            filename: att.filename,
                            content: typeof att.content === "string" ? att.content : att.content.toString("base64"),
                            content_type: att.contentType,
                        }));
                    }

                    const headers: Record<string, string> = {
                        Authorization: options.token,
                        "Content-Type": "application/json",
                    };

                    // Send email with retry logic
                    const sendRequest = async (): Promise<Result<EmailResult>> => {
                        const result = await makeRequest(
                            `${options.endpoint}/email`,
                            {
                                method: "POST",
                                headers,
                                timeout: options.timeout,
                            },
                            JSON.stringify(payload),
                        );

                        if (!result.success) {
                            return {
                                success: false,
                                error: result.error || createError(PROVIDER_NAME, "Failed to send email"),
                            };
                        }

                        const responseData = result.data as { body?: { data?: { queued_id?: string } } };
                        const messageId =
                            responseData?.body &&
                            typeof responseData.body === "object" &&
                            "data" in responseData.body &&
                            responseData.body.data &&
                            typeof responseData.body.data === "object" &&
                            "queued_id" in responseData.body.data &&
                            typeof responseData.body.data.queued_id === "string"
                                ? responseData.body.data.queued_id
                                : generateMessageId();

                        return {
                            success: true,
                            data: {
                                messageId,
                                sent: true,
                                timestamp: new Date(),
                                provider: PROVIDER_NAME,
                                response: result.data,
                            },
                        };
                    };

                    return retry(sendRequest, options.retries);
                } catch (error) {
                    return {
                        success: false,
                        error: error instanceof Error ? error : createError(PROVIDER_NAME, String(error)),
                    };
                }
            },
        };
    },
);
