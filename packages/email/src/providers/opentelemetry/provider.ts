import type { Tracer } from "@opentelemetry/api";
import { context, SpanStatusCode, trace } from "@opentelemetry/api";

import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailOptions, EmailResult, Result } from "../../types";
import createLogger from "../../utils/create-logger";
import type { Provider, ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { OpenTelemetryConfig, OpenTelemetryEmailOptions } from "./types";

// Type guard to check if something is a ProviderFactory
const isProviderFactory = (value: unknown): value is ProviderFactory<unknown, unknown, EmailOptions> => typeof value === "function";

// Type guard to check if something is a Provider
const isProvider = (value: unknown): value is Provider =>
    value !== null && typeof value === "object" && "sendEmail" in value && "initialize" in value && "isAvailable" in value;

// Constants
const PROVIDER_NAME = "opentelemetry";
const DEFAULT_SERVICE_NAME = "email";
const DEFAULT_SPAN_NAME = "email.send";

/**
 * Formats an email address for logging and span attributes.
 * @param address The email address to format (string, EmailAddress, or array).
 * @returns A formatted string representation of the email address.
 */
const formatEmailAddress = (address: EmailOptions["from"] | EmailOptions["to"] | EmailOptions["cc"] | EmailOptions["bcc"] | undefined): string => {
    if (!address) {
        return "";
    }

    if (typeof address === "string") {
        return address;
    }

    if (Array.isArray(address)) {
        return address.map((addr) => (typeof addr === "string" ? addr : addr.email)).join(", ");
    }

    return address.email;
};

/**
 * Creates span attributes from email options for OpenTelemetry tracing.
 * @param emailOptions The email options to extract attributes from.
 * @param recordContent Whether to include email content in the attributes.
 * @returns A record of span attributes with string, number, or boolean values.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const createSpanAttributes = (emailOptions: EmailOptions, recordContent: boolean): Record<string, string | number | boolean> => {
    const attributes: Record<string, string | number | boolean> = {
        "email.from": formatEmailAddress(emailOptions.from),
        "email.subject": emailOptions.subject,
    };

    if (emailOptions.to) {
        attributes["email.to"] = formatEmailAddress(emailOptions.to);
    }

    if (emailOptions.cc) {
        attributes["email.cc"] = formatEmailAddress(emailOptions.cc);
    }

    if (emailOptions.bcc) {
        attributes["email.bcc"] = formatEmailAddress(emailOptions.bcc);
    }

    if (emailOptions.replyTo) {
        attributes["email.reply_to"] = formatEmailAddress(emailOptions.replyTo);
    }

    if (emailOptions.priority) {
        attributes["email.priority"] = emailOptions.priority;
    }

    if (emailOptions.tags && emailOptions.tags.length > 0) {
        attributes["email.tags"] = emailOptions.tags.join(", ");
    }

    if (emailOptions.attachments && emailOptions.attachments.length > 0) {
        attributes["email.attachments.count"] = emailOptions.attachments.length;
    }

    if (recordContent) {
        if (emailOptions.text) {
            attributes["email.text.length"] = emailOptions.text.length;
        }

        if (emailOptions.html) {
            attributes["email.html.length"] = emailOptions.html.length;
        }
    } else {
        if (emailOptions.text) {
            attributes["email.has_text"] = true;
        }

        if (emailOptions.html) {
            attributes["email.has_html"] = true;
        }
    }

    return attributes;
};

/**
 * OpenTelemetry Provider for instrumenting email sending with OpenTelemetry traces and metrics
 */
// @ts-expect-error - Type inference issue with ProviderFactory generic parameters
const opentelemetryProvider: ProviderFactory<OpenTelemetryConfig, Provider<unknown, unknown, EmailOptions>, EmailOptions> = defineProvider<
    OpenTelemetryConfig,
    Provider<unknown, unknown, EmailOptions>,
    EmailOptions
>((config: OpenTelemetryConfig) => {
    // Validate required options
    if (!config.provider) {
        throw new RequiredOptionError(PROVIDER_NAME, "provider");
    }

    // Initialize with defaults
    const options: Pick<OpenTelemetryConfig, "logger">
        & Required<Omit<OpenTelemetryConfig, "logger" | "provider" | "tracer">> & { provider: Provider | ProviderFactory; tracer?: Tracer } = {
            debug: config.debug || false,
            logger: config.logger,
            provider: config.provider,
            recordContent: config.recordContent || false,
            retries: config.retries || 3,
            serviceName: config.serviceName || DEFAULT_SERVICE_NAME,
            timeout: config.timeout || 30_000,
            tracer: config.tracer,
        };

    let isInitialized = false;
    let wrappedProvider: Provider;
    const logger = createLogger(PROVIDER_NAME, config.logger);

    /**
     * Gets or creates the OpenTelemetry tracer instance.
     * @returns The tracer instance to use for creating spans.
     */
    const getTracer = (): Tracer => {
        if (options.tracer) {
            return options.tracer;
        }

        return trace.getTracer(options.serviceName);
    };

    /**
     * Initializes the wrapped provider by creating it from the factory or using the provided instance.
     * @throws {EmailError} When provider initialization fails.
     */
    const initializeProvider = async (): Promise<void> => {
        try {
            // If provider is a factory, call it with empty config
            // If it's already a provider instance, use it directly
            if (isProviderFactory(options.provider)) {
                wrappedProvider = options.provider({} as never);
            } else if (isProvider(options.provider)) {
                wrappedProvider = options.provider;
            } else {
                throw new EmailError(PROVIDER_NAME, "Invalid provider: must be a Provider instance or ProviderFactory function");
            }

            // Initialize the wrapped provider
            await wrappedProvider.initialize();
            logger.debug(`Initialized wrapped provider: ${wrappedProvider.name || "unknown"}`);
        } catch (error) {
            throw new EmailError(PROVIDER_NAME, `Failed to initialize wrapped provider: ${(error as Error).message}`, { cause: error as Error });
        }
    };

    const getFeatures = (): Provider["features"] => {
        if (wrappedProvider?.features) {
            return wrappedProvider.features;
        }

        // Default conservative features
        return {
            attachments: true,
            batchSending: false,
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false,
            tagging: false,
            templates: false,
            tracking: false,
        };
    };

    return {
        get features() {
            return getFeatures();
        },

        /**
         * Gets the wrapped provider instance.
         * @returns The wrapped provider instance.
         * @throws {EmailError} When the provider is not initialized.
         */
        getInstance(): Provider {
            if (!wrappedProvider) {
                throw new EmailError(PROVIDER_NAME, "Provider not initialized. Call initialize() first.");
            }

            return wrappedProvider;
        },

        /**
         * Initializes the OpenTelemetry provider and wrapped provider.
         * @throws {EmailError} When initialization fails.
         */
        async initialize(): Promise<void> {
            if (isInitialized) {
                return;
            }

            try {
                await initializeProvider();
                isInitialized = true;
                logger.debug("OpenTelemetry provider initialized");
            } catch (error) {
                throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
            }
        },

        /**
         * Checks if the wrapped provider is available.
         * @returns True if the wrapped provider is available, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                if (!wrappedProvider) {
                    await initializeProvider();
                }

                return await wrappedProvider.isAvailable();
            } catch {
                return false;
            }
        },

        name: PROVIDER_NAME,

        options,

        /**
         * Sends an email with OpenTelemetry instrumentation.
         * Creates a span for the email sending operation and records attributes.
         * @param emailOptions The email options to send.
         * @returns A result object containing the email result or an error.
         */
        async sendEmail(emailOptions: OpenTelemetryEmailOptions): Promise<Result<EmailResult>> {
            const tracer = getTracer();
            const span = tracer.startSpan(DEFAULT_SPAN_NAME);

            try {
                // Make sure provider is initialized
                if (!wrappedProvider) {
                    await initializeProvider();
                }

                // Set span attributes
                const attributes = createSpanAttributes(emailOptions, options.recordContent);

                span.setAttributes(attributes);

                // Add provider name attribute
                if (wrappedProvider.name) {
                    span.setAttribute("email.provider", wrappedProvider.name);
                }

                // Execute the email send within the span context
                const result = await context.with(trace.setSpan(context.active(), span), async () => await wrappedProvider.sendEmail(emailOptions));

                if (result.success && result.data) {
                    // Record success
                    span.setStatus({ code: SpanStatusCode.OK });
                    span.setAttribute("email.message_id", result.data.messageId);
                    span.setAttribute("email.sent", true);

                    if (result.data.timestamp) {
                        span.setAttribute("email.timestamp", result.data.timestamp.toISOString());
                    }

                    logger.debug(`Email sent successfully via ${wrappedProvider.name || "unknown"}`);

                    return {
                        data: {
                            ...result.data,
                            provider: `${PROVIDER_NAME}(${wrappedProvider.name || "unknown"})`,
                        },
                        success: true,
                    };
                }

                // Record failure
                const errorMessage = result.error instanceof Error ? result.error.message : String(result.error || "Unknown error");

                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: errorMessage,
                });
                span.setAttribute("email.sent", false);
                span.recordException(result.error instanceof Error ? result.error : new Error(errorMessage));

                logger.debug(`Failed to send email via ${wrappedProvider.name || "unknown"}:`, errorMessage);

                return result;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);

                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: errorMessage,
                });
                span.setAttribute("email.sent", false);
                span.recordException(error instanceof Error ? error : new Error(errorMessage));

                logger.debug(`Exception sending email:`, errorMessage);

                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to send email: ${errorMessage}`, { cause: error as Error }),
                    success: false,
                };
            } finally {
                span.end();
            }
        },

        /**
         * Shuts down the wrapped provider and cleans up resources.
         */
        async shutdown(): Promise<void> {
            if (wrappedProvider && wrappedProvider.shutdown) {
                await wrappedProvider.shutdown();
            }

            isInitialized = false;
        },

        /**
         * Validates credentials by checking the wrapped provider.
         * @returns A promise that resolves to true if credentials are valid, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            try {
                if (!wrappedProvider) {
                    await initializeProvider();
                }

                if (wrappedProvider.validateCredentials) {
                    return await wrappedProvider.validateCredentials();
                }

                return await wrappedProvider.isAvailable();
            } catch {
                return false;
            }
        },
    };
});

export default opentelemetryProvider;
