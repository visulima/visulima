import type { EmailOptions, EmailResult, Result } from "../../types.js";
import type { RoundRobinConfig } from "../../types.js";
import type { ProviderFactory } from "../provider.js";
import type { Provider } from "../provider.js";
import type { RoundRobinEmailOptions } from "./types.js";
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
const PROVIDER_NAME = "roundrobin";

/**
 * Round Robin Provider for distributing email sending across multiple providers
 */
export const roundRobinProvider: ProviderFactory<RoundRobinConfig, unknown, RoundRobinEmailOptions> = defineProvider(
    (opts: RoundRobinConfig = {} as RoundRobinConfig) => {
        // Validate required options
        if (!opts.mailers || opts.mailers.length === 0) {
            throw createRequiredError(PROVIDER_NAME, "mailers");
        }

        // Initialize with defaults
        const options: Required<RoundRobinConfig> = {
            mailers: opts.mailers,
            retryAfter: opts.retryAfter ?? 60,
            debug: opts.debug || false,
        };

        let isInitialized = false;
        const providers: Provider[] = [];
        let currentIndex = 0;

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

            // Initialize currentIndex to a random provider
            currentIndex = Math.floor(Math.random() * providers.length);
            debug(`Round robin starting at index ${currentIndex} (${providers[currentIndex]?.name || "unknown"})`);
        };

        /**
         * Get the next available provider in round-robin fashion
         */
        const getNextProvider = async (): Promise<Provider | null> => {
            if (providers.length === 0) {
                return null;
            }

            // Try to find an available provider starting from currentIndex
            const startIndex = currentIndex;
            let attempts = 0;

            while (attempts < providers.length) {
                const provider = providers[currentIndex];
                const providerName = provider.name || `provider-${currentIndex + 1}`;

                // Check if provider is available
                try {
                    const isAvailable = await provider.isAvailable();
                    if (isAvailable) {
                        // Move to next provider for next call
                        currentIndex = (currentIndex + 1) % providers.length;
                        debug(`Selected provider: ${providerName} (index ${currentIndex === 0 ? providers.length - 1 : currentIndex - 1})`);
                        return provider;
                    }
                } catch {
                    // Provider check failed, try next one
                }

                // Move to next provider
                currentIndex = (currentIndex + 1) % providers.length;
                attempts++;

                // If we've tried all providers, wait before retrying
                if (attempts < providers.length && options.retryAfter > 0) {
                    await new Promise((resolve) => setTimeout(resolve, options.retryAfter));
                }
            }

            // If we've tried all providers and none are available, return the one at startIndex
            debug(`No available providers found, using provider at index ${startIndex}`);
            return providers[startIndex] || null;
        };

        return {
            name: PROVIDER_NAME,
            features: {
                // Round robin supports features that all providers support
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
             * Initialize the round robin provider and all underlying providers
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    await initializeProviders();
                    isInitialized = true;
                    debug(`Round robin provider initialized with ${providers.length} provider(s)`);
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
             * Send email through round robin providers
             * Selects the next available provider in rotation
             */
            async sendEmail(emailOpts: RoundRobinEmailOptions): Promise<Result<EmailResult>> {
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

                    // Get the next available provider
                    const provider = await getNextProvider();

                    if (!provider) {
                        return {
                            success: false,
                            error: createError(PROVIDER_NAME, "No available providers found"),
                        };
                    }

                    const providerName = provider.name || "unknown";

                    debug(`Sending email via ${providerName}`);

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

                    // If send failed, try the next provider (failover behavior)
                    debug(`Failed to send via ${providerName}, trying next provider`);
                    const errors: Error[] = [];
                    if (result.error) {
                        errors.push(result.error);
                    }

                    // Try remaining providers in order
                    const startIndex = currentIndex;
                    let attempts = 0;

                    while (attempts < providers.length - 1) {
                        const nextProvider = await getNextProvider();
                        if (!nextProvider || nextProvider === provider) {
                            break;
                        }

                        const nextProviderName = nextProvider.name || "unknown";
                        debug(`Retrying with ${nextProviderName}`);

                        try {
                            const retryResult = await nextProvider.sendEmail(emailOpts);
                            if (retryResult.success) {
                                debug(`Email sent successfully via ${nextProviderName} (after retry)`);
                                return {
                                    success: true,
                                    data: {
                                        ...retryResult.data,
                                        provider: `${PROVIDER_NAME}(${nextProviderName})`,
                                    },
                                };
                            }

                            if (retryResult.error) {
                                errors.push(retryResult.error);
                            }
                        } catch (error) {
                            errors.push(error instanceof Error ? error : new Error(String(error)));
                        }

                        attempts++;
                    }

                    // All providers failed
                    const errorMessages = errors.map((e) => e.message).join("; ");
                    return {
                        success: false,
                        error: createError(
                            PROVIDER_NAME,
                            `Failed to send email via all providers. Errors: ${errorMessages}`,
                            { cause: errors[0] },
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
