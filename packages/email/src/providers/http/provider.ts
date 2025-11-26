import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import headersToRecord from "../../utils/headers-to-record";
import { makeRequest } from "../../utils/make-request";
import validateEmailOptions from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, handleProviderError, ProviderState } from "../utils";
import type { HttpEmailConfig, HttpEmailOptions } from "./types";

const PROVIDER_NAME = "http";
const DEFAULT_METHOD = "POST";
const DEFAULT_TIMEOUT = 30_000;

/**
 * HTTP Email Provider for sending emails via HTTP API
 */
const httpProvider: ProviderFactory<HttpEmailConfig, unknown, HttpEmailOptions> = defineProvider((config: HttpEmailConfig = {} as HttpEmailConfig) => {
    if (!config.endpoint) {
        throw new RequiredOptionError(PROVIDER_NAME, "endpoint");
    }

    const options: Required<HttpEmailConfig> = {
        apiKey: config.apiKey || "",
        endpoint: config.endpoint,
        headers: config.headers || {},
        method: config.method || DEFAULT_METHOD,
    };

    const providerState = new ProviderState();
    const logger = createProviderLogger(PROVIDER_NAME, undefined);

    /**
     * Creates standard headers for API requests.
     * @returns A record of standard HTTP headers including Content-Type and optional Authorization.
     */
    const getStandardHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(options.headers ? headersToRecord(options.headers) : {}),
        };

        if (options.apiKey) {
            headers.Authorization = `Bearer ${options.apiKey}`;
        }

        return headers;
    };

    /**
     * Formats the request payload based on email options.
     * @param emailOptions The email options to format into a request payload.
     * @returns A record containing the formatted request data.
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
         * Initializes the HTTP provider and validates endpoint availability.
         * @throws {EmailError} When the API endpoint is not available.
         */
        async initialize(): Promise<void> {
            await providerState.ensureInitialized(async () => {
                if (!(await this.isAvailable())) {
                    throw new EmailError(PROVIDER_NAME, "API endpoint not available");
                }
            }, PROVIDER_NAME);
        },

        /**
         * Checks if the HTTP endpoint is available.
         * @returns True if the endpoint is available, false otherwise.
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
         * Sends an email via the HTTP API endpoint.
         * @param emailOptions The email options to send.
         * @returns A result object containing the email result or an error.
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async sendEmail(emailOptions: HttpEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                await providerState.ensureInitialized(() => this.initialize(), PROVIDER_NAME);

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
                        error: new EmailError(
                            PROVIDER_NAME,
                            `Failed to send email: ${result.error instanceof Error ? result.error.message : "Unknown error"}`,
                            { cause: result.error },
                        ),
                        success: false,
                    };
                }

                let messageId: string | undefined;
                const responseBody = (result.data as { body?: Record<string, unknown> })?.body;

                if (responseBody && typeof responseBody === "object") {
                    const { id } = responseBody as { id?: unknown };
                    const messageIdValue = (responseBody as { messageId?: unknown }).messageId;
                    const { data } = responseBody as { data?: unknown };
                    const extractedId
                        = (typeof id === "string" ? id : undefined)
                            || (typeof messageIdValue === "string" ? messageIdValue : undefined)
                            || (data && typeof data === "object" && (typeof (data as { id?: unknown }).id === "string" ? (data as { id: string }).id : undefined))
                            || (typeof (data as { messageId?: unknown }).messageId === "string" ? (data as { messageId: string }).messageId : undefined);

                    if (typeof extractedId === "string") {
                        messageId = extractedId;
                    }
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
                    error: handleProviderError(PROVIDER_NAME, "send email", error, logger),
                    success: false,
                };
            }
        },

        /**
         * Validates the HTTP provider configuration.
         * @returns True if the configuration is valid, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            try {
                const result = await makeRequest(options.endpoint, {
                    headers: getStandardHeaders(),
                    method: "GET",
                    timeout: DEFAULT_TIMEOUT,
                });

                const isSuccess
                    = result.data
                        && typeof result.data === "object"
                        && "statusCode" in result.data
                        && typeof (result.data as { statusCode?: unknown }).statusCode === "number"
                        && (result.data as { statusCode: number }).statusCode >= 200
                        && (result.data as { statusCode: number }).statusCode < 300;

                return Boolean(isSuccess);
            } catch {
                return false;
            }
        },
    };
});

export default httpProvider;
