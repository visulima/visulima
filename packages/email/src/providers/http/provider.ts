import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailResult, Result } from "../../types";
import { generateMessageId, headersToRecord, makeRequest, validateEmailOptions } from "../../utils";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { HttpEmailConfig, HttpEmailOptions } from "./types";

const PROVIDER_NAME = "http";
const DEFAULT_METHOD = "POST";
const DEFAULT_TIMEOUT = 30_000;

/**
 * HTTP Email Provider for sending emails via HTTP API
 */
export const httpProvider: ProviderFactory<HttpEmailConfig, unknown, HttpEmailOptions> = defineProvider((options_: HttpEmailConfig = {} as HttpEmailConfig) => {
    if (!options_.endpoint) {
        throw new RequiredOptionError(PROVIDER_NAME, "endpoint");
    }

    const options: Required<HttpEmailConfig> = {
        apiKey: options_.apiKey || "",
        endpoint: options_.endpoint,
        headers: options_.headers || {},
        method: options_.method || DEFAULT_METHOD,
    };

    /**
     * Create standard headers for API requests
     */
    const getStandardHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...options.headers ? headersToRecord(options.headers) : {},
        };

        if (options.apiKey) {
            headers.Authorization = `Bearer ${options.apiKey}`;
        }

        return headers;
    };

    /**
     * Format the request based on email options
     */
    const formatRequest = (emailOptions: HttpEmailOptions): Record<string, unknown> => {
        const payload: Record<string, unknown> = {
            from: emailOptions.from.email,
            from_name: emailOptions.from.name,
            html: emailOptions.html,
            subject: emailOptions.subject,
            text: emailOptions.text,
            to: Array.isArray(emailOptions.to) ? emailOptions.to.map((r) => r.email) : emailOptions.to.email,
        };

        if (emailOptions.cc) {
            payload.cc = Array.isArray(emailOptions.cc) ? emailOptions.cc.map((r) => r.email) : emailOptions.cc.email;
        }

        if (emailOptions.bcc) {
            payload.bcc = Array.isArray(emailOptions.bcc) ? emailOptions.bcc.map((r) => r.email) : emailOptions.bcc.email;
        }

        if (emailOptions.customParams) {
            Object.assign(payload, emailOptions.customParams);
        }

        return payload;
    };

    let isInitialized = false;

    return {
        features: {
            attachments: false,
            batchSending: false,
            customHeaders: true,
            html: true,
            replyTo: false,
            scheduling: false,
            tagging: false,
            templates: false,
            tracking: false,
        },

        /**
         * Initialize the HTTP provider
         */
        async initialize(): Promise<void> {
            if (isInitialized) {
                return;
            }

            if (!await this.isAvailable()) {
                throw new EmailError(PROVIDER_NAME, "API endpoint not available");
            }

            isInitialized = true;
        },

        /**
         * Check if the HTTP endpoint is available
         */
        async isAvailable(): Promise<boolean> {
            try {
                const result = await makeRequest(options.endpoint, {
                    headers: getStandardHeaders(),
                    method: "OPTIONS",
                    timeout: DEFAULT_TIMEOUT,
                });

                if (result.success) {
                    return true;
                }

                if (
                    result.data
                    && typeof result.data === "object"
                    && "statusCode" in result.data
                    && typeof result.data.statusCode === "number"
                    && result.data.statusCode >= 400
                    && result.data.statusCode < 500
                ) {
                    return true;
                }

                return false;
            } catch (error) {
                if (error instanceof Error) {
                    const errorMessage = error.message;

                    if (errorMessage.includes("status 4") || errorMessage.includes("401") || errorMessage.includes("403")) {
                        return true;
                    }
                }

                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Send email via HTTP API
         */
        async sendEmail(emailOptions: HttpEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                if (!isInitialized) {
                    await this.initialize();
                }

                const headers = getStandardHeaders();

                if (emailOptions.headers) {
                    Object.assign(headers, headersToRecord(emailOptions.headers));
                }

                const payload = formatRequest(emailOptions);

                const endpoint = emailOptions.endpointOverride || options.endpoint;

                const method = emailOptions.methodOverride || options.method;

                const result = await makeRequest(
                    endpoint,
                    {
                        headers,
                        method,
                        timeout: DEFAULT_TIMEOUT,
                    },
                    JSON.stringify(payload),
                );

                if (!result.success) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Failed to send email: ${result.error?.message || "Unknown error"}`, { cause: result.error }),
                        success: false,
                    };
                }

                let messageId: string | undefined;
                const responseBody = (result.data as { body?: Record<string, unknown> })?.body;

                if (responseBody && typeof responseBody === "object") {
                    messageId
                        = (responseBody.id as string | undefined)
                            || (responseBody.messageId as string | undefined)
                            || (responseBody.data
                                && typeof responseBody.data === "object"
                                && ((responseBody.data as { id?: string }).id || (responseBody.data as { messageId?: string }).messageId));
                }

                if (!messageId) {
                    messageId = generateMessageId();
                }

                return {
                    data: {
                        messageId,
                        provider: PROVIDER_NAME,
                        response: (result.data as { body?: unknown })?.body,
                        sent: true,
                        timestamp: new Date(),
                    },
                    success: true,
                };
            } catch (error) {
                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to send email: ${(error as Error).message}`, { cause: error as Error }),
                    success: false,
                };
            }
        },

        /**
         * Validate configuration
         */
        async validateCredentials(): Promise<boolean> {
            try {
                const result = await makeRequest(options.endpoint, {
                    headers: getStandardHeaders(),
                    method: "GET",
                    timeout: DEFAULT_TIMEOUT,
                });

                if (
                    result.data
                    && typeof result.data === "object"
                    && "statusCode" in result.data
                    && typeof result.data.statusCode === "number"
                    && result.data.statusCode >= 200
                    && result.data.statusCode < 300
                ) {
                    return true;
                }

                return false;
            } catch {
                return false;
            }
        },
    };
});
