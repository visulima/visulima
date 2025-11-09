import { EmailError, RequiredOptionError } from "../../errors/email-error";
import type { EmailOptions, EmailResult, Result } from "../../types";
import { createLogger } from "../../utils";
import type { Provider, ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { FailoverConfig, FailoverEmailOptions } from "./types";

// Type guard to check if something is a ProviderFactory
function isProviderFactory(value: unknown): value is ProviderFactory<unknown, unknown, EmailOptions> {
    return typeof value === "function";
}

// Type guard to check if something is a Provider
function isProvider(value: unknown): value is Provider {
    return value !== null && typeof value === "object" && "sendEmail" in value && "initialize" in value && "isAvailable" in value;
}

// Constants
const PROVIDER_NAME = "failover";

/**
 * Failover Provider for sending emails with automatic failover to backup providers
 */
export const failoverProvider: ProviderFactory<FailoverConfig, unknown, FailoverEmailOptions> = defineProvider(
    (options_: FailoverConfig = {} as FailoverConfig) => {
        // Validate required options
        if (!options_.mailers || options_.mailers.length === 0) {
            throw new RequiredOptionError(PROVIDER_NAME, "mailers");
        }

        // Initialize with defaults
        const options: Required<FailoverConfig> = {
            debug: options_.debug || false,
            mailers: options_.mailers,
            retryAfter: options_.retryAfter ?? 60,
        };

        let isInitialized = false;
        const providers: Provider[] = [];

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
        };

        return {
            features: {
                // Failover supports features that all providers support
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
             * Initialize the failover provider and all underlying providers
             */
            async initialize(): Promise<void> {
                if (isInitialized) {
                    return;
                }

                try {
                    await initializeProviders();
                    isInitialized = true;
                    logger.debug(`Failover provider initialized with ${providers.length} provider(s)`);
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
             * Send email through failover providers
             * Tries each provider in order until one succeeds
             */
            async sendEmail(emailOptions: FailoverEmailOptions): Promise<Result<EmailResult>> {
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

                    const errors: (Error | unknown)[] = [];
                    let lastError: Error | unknown | undefined;

                    // Try each provider in order
                    for (let i = 0; i < providers.length; i++) {
                        const provider = providers[i];
                        const providerName = provider.name || `provider-${i + 1}`;

                        logger.debug(`Attempting to send email via ${providerName} (${i + 1}/${providers.length})`);

                        try {
                            // Check if provider is available before attempting to send
                            const isAvailable = await provider.isAvailable();

                            if (!isAvailable) {
                                logger.debug(`Provider ${providerName} is not available, skipping`);
                                errors.push(new EmailError(PROVIDER_NAME, `Provider ${providerName} is not available`));
                                continue;
                            }

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

                            // If send failed, record the error
                            if (result.error) {
                                lastError = result.error;
                                errors.push(result.error);
                                const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);

                                logger.debug(`Failed to send via ${providerName}:`, errorMessage);
                            }
                        } catch (error) {
                            lastError = error instanceof Error ? error : new Error(String(error));
                            errors.push(lastError);
                            const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);

                            logger.debug(`Exception sending via ${providerName}:`, errorMessage);
                        }

                        // If this isn't the last provider, wait before trying the next one
                        if (i < providers.length - 1 && options.retryAfter > 0) {
                            logger.debug(`Waiting ${options.retryAfter}ms before trying next provider`);
                            await new Promise((resolve) => setTimeout(resolve, options.retryAfter));
                        }
                    }

                    // All providers failed
                    const errorMessages = errors.map((e) => (e instanceof Error ? e.message : String(e))).join("; ");

                    return {
                        error: new EmailError(PROVIDER_NAME, `All providers failed. Errors: ${errorMessages}`, { cause: lastError }),
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
