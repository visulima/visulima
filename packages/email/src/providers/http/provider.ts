import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import { makeRequest } from "../../utils/make-request";
import validateEmailOptions from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { HttpEmailConfig, HttpEmailOptions } from "./types";

// Constants
const PROVIDER_NAME = "http";
const DEFAULT_METHOD = "POST";
const DEFAULT_TIMEOUT = 30_000;

/**
 * HTTP Email Provider for sending emails via HTTP API.
 */
const httpProvider: ProviderFactory<HttpEmailConfig, unknown, HttpEmailOptions> = defineProvider((options_: HttpEmailConfig = {} as HttpEmailConfig) => {
    // Validate required options
    if (!options_.endpoint) {
        throw new RequiredOptionError(PROVIDER_NAME, "endpoint");
    }

    // Initialize with defaults
    const options: Required<HttpEmailConfig> = {
        apiKey: options_.apiKey || "",
        endpoint: options_.endpoint,
        headers: options_.headers || {},
        method: options_.method || DEFAULT_METHOD,
    };

    /**
     * Creates standard headers for API requests.
     */
    const getStandardHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        // Add API key if provided
        if (options.apiKey) {
            headers.Authorization = `Bearer ${options.apiKey}`;
        }

        return headers;
    };

    /**
     * Formats the request based on email options.
     */
    const formatRequest = (emailOptions: HttpEmailOptions): Record<string, unknown> => {
        // Base payload with standard email fields
        const payload: Record<string, unknown> = {
            from: emailOptions.from.email,
            from_name: emailOptions.from.name,
            html: emailOptions.html,
            subject: emailOptions.subject,
            text: emailOptions.text,
            to: Array.isArray(emailOptions.to) ? emailOptions.to.map((r) => r.email) : emailOptions.to.email,
        };

        // Add CC if present
        if (emailOptions.cc) {
            payload.cc = Array.isArray(emailOptions.cc) ? emailOptions.cc.map((r) => r.email) : emailOptions.cc.email;
        }

        // Add BCC if present
        if (emailOptions.bcc) {
            payload.bcc = Array.isArray(emailOptions.bcc) ? emailOptions.bcc.map((r) => r.email) : emailOptions.bcc.email;
        }

        // Add custom parameters if provided
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
         * Initializes the HTTP provider.
         */
        async initialize(): Promise<void> {
            if (isInitialized) {
                return;
            }

            // Check if the API endpoint is available
            if (!(await this.isAvailable())) {
                throw new EmailError(PROVIDER_NAME, "API endpoint not available");
            }

            isInitialized = true;
        },

        /**
         * Checks if the HTTP endpoint is available.
         */
        async isAvailable(): Promise<boolean> {
            try {
                // Use OPTIONS request to check if endpoint is available
                const result = await makeRequest(options.endpoint, {
                    headers: getStandardHeaders(),
                    method: "OPTIONS",
                    timeout: DEFAULT_TIMEOUT,
                });

                // Success case - 2xx means API is reachable and working
                if (result.success) {
                    return true;
                }

                const statusCode = (result.data as { statusCode?: number })?.statusCode;

                if (statusCode === 401 || statusCode === 403) {
                    // API reachable but credentials invalid.
                    return false;
                }

                // Other non‑2xx/non‑auth errors: treat as unavailable.
                return false;
            } catch (error) {
                // Check for 401/403 errors - these mean credentials are invalid
                if (error instanceof Error) {
                    const errorMessage = error.message;

                    if (errorMessage.includes("401") || errorMessage.includes("403")) {
                        return false;
                    }
                }

                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Sends email via HTTP API.
         */
        async sendEmail(emailOptions: HttpEmailOptions): Promise<Result<EmailResult>> {
            try {
                // Validate email options first, before any other operations
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                // Make sure the provider is initialized
                if (!isInitialized) {
                    await this.initialize();
                }

                // Format headers
                const headers = getStandardHeaders();

                // Add custom headers from email options
                if (emailOptions.headers) {
                    Object.assign(headers, emailOptions.headers);
                }

                // Format the request payload
                const payload = formatRequest(emailOptions);

                // Use endpoint override if provided
                const endpoint = emailOptions.endpointOverride || options.endpoint;

                // Use method override if provided
                const method = emailOptions.methodOverride || options.method;

                // Make the request
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
                        error: new EmailError(PROVIDER_NAME, `Failed to send email: ${(result.error as Error)?.message || "Unknown error"}`, {
                            cause: result.error as Error,
                        }),
                        success: false,
                    };
                }

                // Extract message ID from the response following various patterns
                let messageId: string | undefined;
                const responseBody = (result.data as { body?: Record<string, unknown> })?.body;

                if (responseBody && typeof responseBody === "object") {
                    messageId
                        = (responseBody.id as string | undefined)
                            || (responseBody.messageId as string | undefined)
                            || ((responseBody.data
                                && typeof responseBody.data === "object"
                                && ((responseBody.data as { id?: string }).id || (responseBody.data as { messageId?: string }).messageId)) as string | undefined);
                }

                // Fall back to generating a message ID if none found
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
         * Validates configuration.
         */
        async validateCredentials(): Promise<boolean> {
            try {
                // Use GET request to validate credentials
                const result = await makeRequest(options.endpoint, {
                    headers: getStandardHeaders(),
                    method: "GET",
                    timeout: DEFAULT_TIMEOUT,
                });

                // Consider API available if response is successful (2xx)
                return Boolean(
                    result.data
                    && typeof result.data === "object"
                    && "statusCode" in result.data
                    && typeof result.data.statusCode === "number"
                    && result.data.statusCode >= 200
                    && result.data.statusCode < 300,
                );
            } catch {
                return false;
            }
        },
    };
});

export default httpProvider;
