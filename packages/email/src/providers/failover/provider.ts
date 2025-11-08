import type { EmailOptions, EmailResult, Result } from "../../types.js";
import type { FailoverConfig } from "../../types.js";
import type { ProviderFactory } from "../provider.js";
import type { Provider } from "../provider.js";
import type { FailoverEmailOptions } from "./types.js";
import { createError, createRequiredError } from "../../utils.js";
import { defineProvider } from "../provider.js";

// Type guard to check if something is a ProviderFactory
function isProviderFactory(value: unknown): value is ProviderFactory<unknown, unknown, EmailOptions> {
    return typeof value === "function";
}

// Type guard to check if something is a Provider
function isProvider(value: unknown): value is Provider {
    return (
        value !== null &&
        typeof value === "object" &&
        "sendEmail" in value &&
        "initialize" in value &&
        "isAvailable" in value
    );
}

// Constants
const PROVIDER_NAME = "failover";

/**
 * Failover Provider for sending emails with automatic failover to backup providers
 */
export const failoverProvider: ProviderFactory<FailoverConfig, unknown, FailoverEmailOptions> = defineProvider(
    (opts: FailoverConfig = {} as FailoverConfig) => {
        // Validate required options
        if (!opts.mailers || opts.mailers.length === 0) {
            throw createRequiredError(PROVIDER_NAME, "mailers");
        }

        // Initialize with defaults
        const options: Required<FailoverConfig> = {
            mailers: opts.mailers,
            retryAfter: opts.retryAfter ?? 60,
            debug: opts.debug || false,
        };

        let isInitialized = false;
        const providers: Provider[] = [];

        // Debug helper
        const debug = (message: string, ...args: unknown[]): void => {
            if (options.debug) {
                console.log(`[${PROVIDER_NAME}] ${message}`, ...args);
            }
        };

        /**
         * Initialize all providers
         */
        const initializeProviders = async (): Promise<void> => {
            providers.length = 0;

            for (const mailer of options.mailers) {
                try {
                    // If mailer is a provider factory, call it with empty config
                    // If it's already a provider instance, use it directly
                    let provider: Provider;

                    if (isProviderFactory(mailer)) {
                        provider = mailer({} as never);
                    } else if (isProvider(mailer)) {
                        provider = mailer;
                    } else {
                        debug(`Skipping invalid mailer: ${mailer}`);
                        continue;
                    }

                    // Try to initialize the provider
                    try {
                        await provider.initialize();
                        providers.push(provider);
                        debug(`Initialized provider: ${provider.name || "unknown"}`);
                    } catch (error) {
                        debug(`Failed to initialize provider ${provider.name || "unknown"}:`, error);
                        // Continue with next provider
                    }
                } catch (error) {
                    debug(`Error processing mailer:`, error);
                    // Continue with next provider
                }
            }

            if (providers.length === 0) {
                throw createError(PROVIDER_NAME, "No providers could be initialized");
            }
        };

        return {
            name: PROVIDER_NAME,
            features: {
                // Failover supports features that all providers support
                attachments: true,
                html: true,
                templates: false, // Not all providers support templates
                tracking: false, // Not all providers support tracking
                customHeaders: true,
                batchSending: false,
                tagging: false, // Not all providers support tagging
                scheduling: false, // Not all providers support scheduling
                replyTo: true,
            },
            options,

            /**
             * Initialize the failover provider and all underlying providers
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    await initializeProviders();
                    isInitialized = true;
                    debug(`Failover provider initialized with ${providers.length} provider(s)`);
                } catch (error) {
                    throw createError(
                        PROVIDER_NAME,
                        `Failed to initialize: ${(error as Error).message}`,
                        { cause: error as Error },
                    );
                }
            },

            /**
             * Check if at least one provider is available
             */
            async isAvailable(): Promise<boolean> {
                try {
                    if (providers.length === 0) {
                        await initializeProviders();
                    }

                    // Check if at least one provider is available
                    for (const provider of providers) {
                        try {
                            if (await provider.isAvailable()) {
                                return true;
                            }
                        } catch {
                            // Continue checking other providers
                        }
                    }

                    return false;
                } catch {
                    return false;
                }
            },

            /**
             * Send email through failover providers
             * Tries each provider in order until one succeeds
             */
            async sendEmail(emailOpts: FailoverEmailOptions): Promise<Result<EmailResult>> {
                try {
                    // Make sure providers are initialized
                    if (providers.length === 0) {
                        await initializeProviders();
                    }

                    if (providers.length === 0) {
                        return {
                            success: false,
                            error: createError(PROVIDER_NAME, "No providers available"),
                        };
                    }

                    const errors: Error[] = [];
                    let lastError: Error | undefined;

                    // Try each provider in order
                    for (let i = 0; i < providers.length; i++) {
                        const provider = providers[i];
                        const providerName = provider.name || `provider-${i + 1}`;

                        debug(`Attempting to send email via ${providerName} (${i + 1}/${providers.length})`);

                        try {
                            // Check if provider is available before attempting to send
                            const isAvailable = await provider.isAvailable();
                            if (!isAvailable) {
                                debug(`Provider ${providerName} is not available, skipping`);
                                errors.push(createError(PROVIDER_NAME, `Provider ${providerName} is not available`));
                                continue;
                            }

                            // Try to send the email
                            const result = await provider.sendEmail(emailOpts);

                            if (result.success) {
                                debug(`Email sent successfully via ${providerName}`);
                                return {
                                    success: true,
                                    data: {
                                        ...result.data,
                                        provider: `${PROVIDER_NAME}(${providerName})`,
                                    },
                                };
                            }

                            // If send failed, record the error
                            if (result.error) {
                                lastError = result.error;
                                errors.push(result.error);
                                debug(`Failed to send via ${providerName}:`, result.error.message);
                            }
                        } catch (error) {
                            lastError = error instanceof Error ? error : new Error(String(error));
                            errors.push(lastError);
                            debug(`Exception sending via ${providerName}:`, lastError.message);
                        }

                        // If this isn't the last provider, wait before trying the next one
                        if (i < providers.length - 1 && options.retryAfter > 0) {
                            debug(`Waiting ${options.retryAfter}ms before trying next provider`);
                            await new Promise((resolve) => setTimeout(resolve, options.retryAfter));
                        }
                    }

                    // All providers failed
                    const errorMessages = errors.map((e) => e.message).join("; ");
                    return {
                        success: false,
                        error: createError(
                            PROVIDER_NAME,
                            `All providers failed. Errors: ${errorMessages}`,
                            { cause: lastError },
                        ),
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: createError(
                            PROVIDER_NAME,
                            `Failed to send email: ${(error as Error).message}`,
                            { cause: error as Error },
                        ),
                    };
                }
            },

            /**
             * Validate credentials by checking if at least one provider is available
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);
