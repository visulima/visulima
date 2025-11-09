import { EmailError, RequiredOptionError } from "../../errors/email-error.js";
import type { EmailOptions, EmailResult, Result, RoundRobinConfig } from "../../types.js";
import { createLogger } from "../../utils.js";
import type { Provider, ProviderFactory } from "../provider.js";
import { defineProvider } from "../provider.js";
import type { RoundRobinEmailOptions } from "./types.js";

// Type guard to check if something is a ProviderFactory
function isProviderFactory(value: unknown): value is ProviderFactory<unknown, unknown, EmailOptions> {
    return typeof value === "function";
}

// Type guard to check if something is a Provider
function isProvider(value: unknown): value is Provider {
    return value !== null && typeof value === "object" && "sendEmail" in value && "initialize" in value && "isAvailable" in value;
}

// Constants
const PROVIDER_NAME = "roundrobin";

/**
 * Round Robin Provider for distributing email sending across multiple providers
 */
export const roundRobinProvider: ProviderFactory<RoundRobinConfig, unknown, RoundRobinEmailOptions> = defineProvider(
    (options_: RoundRobinConfig = {} as RoundRobinConfig) => {
        // Validate required options
        if (!options_.mailers || options_.mailers.length === 0) {
            throw new RequiredOptionError(PROVIDER_NAME, "mailers");
        }

        // Initialize with defaults
        const options: Required<RoundRobinConfig> = {
            debug: options_.debug || false,
            mailers: options_.mailers,
            retryAfter: options_.retryAfter ?? 60,
        };

        let isInitialized = false;
        const providers: Provider[] = [];
        let currentIndex = 0;

        const logger = createLogger(PROVIDER_NAME, options.debug, options_.logger);

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
                        logger.debug(`Skipping invalid mailer: ${mailer}`);
                        continue;
                    }

                    // Try to initialize the provider
                    try {
                        await provider.initialize();
                        providers.push(provider);
                        logger.debug(`Initialized provider: ${provider.name || "unknown"}`);
                    } catch (error) {
                        logger.debug(`Failed to initialize provider ${provider.name || "unknown"}:`, error);
                        // Continue with next provider
                    }
                } catch (error) {
                    logger.debug(`Error processing mailer:`, error);
                    // Continue with next provider
                }
            }

            if (providers.length === 0) {
                throw new EmailError(PROVIDER_NAME, "No providers could be initialized");
            }

            // Initialize currentIndex to a random provider
            currentIndex = Math.floor(Math.random() * providers.length);
            logger.debug(`Round robin starting at index ${currentIndex} (${providers[currentIndex]?.name || "unknown"})`);
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
                        logger.debug(`Selected provider: ${providerName} (index ${currentIndex === 0 ? providers.length - 1 : currentIndex - 1})`);

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
            logger.debug(`No available providers found, using provider at index ${startIndex}`);

            return providers[startIndex] || null;
        };

        return {
            features: {
                // Round robin supports features that all providers support
                attachments: true,
                batchSending: false,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false, // Not all providers support scheduling
                tagging: false, // Not all providers support tagging
                templates: false, // Not all providers support templates
                tracking: false, // Not all providers support tracking
            },

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
                    logger.debug(`Round robin provider initialized with ${providers.length} provider(s)`);
                } catch (error) {
                    throw new EmailError(PROVIDER_NAME, `Failed to initialize: ${(error as Error).message}`, { cause: error as Error });
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

            name: PROVIDER_NAME,

            options,

            /**
             * Send email through round robin providers
             * Selects the next available provider in rotation
             */
            async sendEmail(emailOptions: RoundRobinEmailOptions): Promise<Result<EmailResult>> {
                try {
                    // Make sure providers are initialized
                    if (providers.length === 0) {
                        await initializeProviders();
                    }

                    if (providers.length === 0) {
                        return {
                            error: new EmailError(PROVIDER_NAME, "No providers available"),
                            success: false,
                        };
                    }

                    // Get the next available provider
                    const provider = await getNextProvider();

                    if (!provider) {
                        return {
                            error: new EmailError(PROVIDER_NAME, "No available providers found"),
                            success: false,
                        };
                    }

                    const providerName = provider.name || "unknown";

                    logger.debug(`Sending email via ${providerName}`);

                    // Try to send the email
                    const result = await provider.sendEmail(emailOptions);

                    if (result.success) {
                        logger.debug(`Email sent successfully via ${providerName}`);

                        return {
                            data: {
                                ...result.data,
                                provider: `${PROVIDER_NAME}(${providerName})`,
                            },
                            success: true,
                        };
                    }

                    // If send failed, try the next provider (failover behavior)
                    logger.debug(`Failed to send via ${providerName}, trying next provider`);
                    const errors: (Error | unknown)[] = [];

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

                        logger.debug(`Retrying with ${nextProviderName}`);

                        try {
                            const retryResult = await nextProvider.sendEmail(emailOptions);

                            if (retryResult.success) {
                                logger.debug(`Email sent successfully via ${nextProviderName} (after retry)`);

                                return {
                                    data: {
                                        ...retryResult.data,
                                        provider: `${PROVIDER_NAME}(${nextProviderName})`,
                                    },
                                    success: true,
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
                        error: new EmailError(PROVIDER_NAME, `Failed to send email via all providers. Errors: ${errorMessages}`, { cause: errors[0] }),
                        success: false,
                    };
                } catch (error) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Failed to send email: ${(error as Error).message}`, { cause: error as Error }),
                        success: false,
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
