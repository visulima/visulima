import type { Tracer } from "@opentelemetry/api";
import { context, SpanStatusCode, trace } from "@opentelemetry/api";

import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailOptions, EmailResult, Result } from "../../types";
import createLogger from "../../utils/create-logger";
import type { Provider, ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { OpenTelemetryConfig, OpenTelemetryEmailOptions } from "./types";

// Type guard to check if something is a ProviderFactory
function isProviderFactory(value: unknown): value is ProviderFactory<unknown, unknown, EmailOptions> {
    return typeof value === "function";
}

// Type guard to check if something is a Provider
function isProvider(value: unknown): value is Provider {
    return value !== null && typeof value === "object" && "sendEmail" in value && "initialize" in value && "isAvailable" in value;
}

// Constants
const PROVIDER_NAME = "opentelemetry";
const DEFAULT_SERVICE_NAME = "email";
const DEFAULT_SPAN_NAME = "email.send";

/**
 * Format email address for logging/attributes
 */
function formatEmailAddress(address: EmailOptions["from"] | EmailOptions["to"] | EmailOptions["cc"] | EmailOptions["bcc"]): string {
    if (typeof address === "string") {
        return address;
    }

    if (Array.isArray(address)) {
        return address.map((addr) => (typeof addr === "string" ? addr : addr.email)).join(", ");
    }

    return address.email;
}

/**
 * Create span attributes from email options
 */
function createSpanAttributes(emailOptions: EmailOptions, recordContent: boolean): Record<string, string | number | boolean> {
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
}

/**
 * OpenTelemetry Provider for instrumenting email sending with OpenTelemetry traces and metrics
 */
export const opentelemetryProvider: ProviderFactory<OpenTelemetryConfig, unknown, OpenTelemetryEmailOptions> = defineProvider(
    (options_: OpenTelemetryConfig) => {
        // Validate required options
        if (!options_.provider) {
            throw new RequiredOptionError(PROVIDER_NAME, "provider");
        }

        // Initialize with defaults
        const options: Required<Omit<OpenTelemetryConfig, "provider" | "tracer">> & { provider: Provider | ProviderFactory; tracer?: Tracer } = {
            debug: options_.debug || false,
            provider: options_.provider,
            recordContent: options_.recordContent || false,
            serviceName: options_.serviceName || DEFAULT_SERVICE_NAME,
            tracer: options_.tracer,
        };

        let isInitialized = false;
        let wrappedProvider: Provider;
        const logger = createLogger(PROVIDER_NAME, options_.logger);

        /**
         * Get or create the tracer
         */
        const getTracer = (): Tracer => {
            if (options.tracer) {
                return options.tracer;
            }

            return trace.getTracer(options.serviceName);
        };

        /**
         * Initialize the wrapped provider
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
             * Get the wrapped provider instance
             */
            getInstance(): Provider {
                if (!wrappedProvider) {
                    throw new EmailError(PROVIDER_NAME, "Provider not initialized. Call initialize() first.");
                }

                return wrappedProvider;
            },

            /**
             * Initialize the OpenTelemetry provider and wrapped provider
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
             * Check if the wrapped provider is available
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
             * Send email with OpenTelemetry instrumentation
             * Creates a span for the email sending operation
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
             * Shutdown the wrapped provider
             */
            async shutdown(): Promise<void> {
                if (wrappedProvider && wrappedProvider.shutdown) {
                    await wrappedProvider.shutdown();
                }

                isInitialized = false;
            },

            /**
             * Validate credentials by checking the wrapped provider
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
    },
);
