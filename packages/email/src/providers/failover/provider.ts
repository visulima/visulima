import EmailError from "../../errors/email-error.js";
import RequiredOptionError from "../../errors/required-option-error.js";
import { createLogger } from "../../index.js";
import type { EmailOptions, EmailResult, Result } from "../../types.js";
import generateMessageId from "../../utils/generate-message-id.js";
import type { Provider, ProviderFactory } from "../provider.js";
import { defineProvider } from "../provider.js";
import type { FailoverConfig, FailoverEmailOptions } from "./types.js";

// Type guard to check if something is a ProviderFactory
const isProviderFactory = (value: unknown): value is ProviderFactory<unknown, unknown, EmailOptions> => typeof value === "function";

// Type guard to check if something is a Provider
const isProvider = (value: unknown): value is Provider =>
    value !== null && typeof value === "object" && "sendEmail" in value && "initialize" in value && "isAvailable" in value;

// Constants
const PROVIDER_NAME = "failover";

/**
 * Failover Provider for sending emails with automatic failover to backup providers.
 */
// eslint-disable-next-line import/prefer-default-export -- Named export is intentional
export const failoverProvider: ProviderFactory<FailoverConfig, unknown, FailoverEmailOptions> = defineProvider(
    (config: FailoverConfig = {} as FailoverConfig) => {
        // Validate required options
        if (!config.mailers || config.mailers.length === 0) {
            throw new RequiredOptionError(PROVIDER_NAME, "mailers");
        }

        // Initialize with defaults
        const options: FailoverConfig & { debug: boolean; retryAfter: number } = {
            debug: config.debug || false,
            mailers: config.mailers,
            retryAfter: config.retryAfter ?? 60,
        };

        let isInitialized = false;

        const providers: Provider[] = [];
        const logger = createLogger(PROVIDER_NAME, config.logger);

        let initializationPromise: Promise<void> | undefined;

        /**
         * Initializes all providers.
         */
        const initializeProviders = async (): Promise<void> => {
            if (initializationPromise) {
                return initializationPromise;
            }

            initializationPromise = (async () => {
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
                            // eslint-disable-next-line no-await-in-loop -- Sequential initialization is required
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
            })();

            return initializationPromise;
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
             * Initializes the failover provider and all underlying providers.
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
             * Checks if at least one provider is available.
             */
            async isAvailable(): Promise<boolean> {
                try {
                    if (providers.length === 0) {
                        await initializeProviders();
                    }

                    // Check if at least one provider is available
                    for (const provider of providers) {
                        try {
                            // eslint-disable-next-line no-await-in-loop -- Sequential checking is required
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
             * Sends email through failover providers.
             * Tries each provider in order until one succeeds.
             */
            // eslint-disable-next-line sonarjs/cognitive-complexity -- Failover logic requires complexity
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
                    for (let i = 0; i < providers.length; i += 1) {
                        const provider = providers[i];

                        if (!provider) {
                            continue;
                        }

                        const providerName = provider.name || `provider-${i + 1}`;

                        logger.debug(`Attempting to send email via ${providerName} (${i + 1}/${providers.length})`);

                        try {
                            // Check if provider is available before attempting to send
                            // eslint-disable-next-line no-await-in-loop -- Sequential processing is required for failover
                            const isAvailable = await provider.isAvailable();

                            if (!isAvailable) {
                                logger.debug(`Provider ${providerName} is not available, skipping`);
                                errors.push(new EmailError(PROVIDER_NAME, `Provider ${providerName} is not available`));
                                continue;
                            }

                            // Try to send the email
                            // eslint-disable-next-line no-await-in-loop -- Sequential processing is required for failover
                            const result = await provider.sendEmail(emailOptions);

                            if (result.success && result.data) {
                                logger.debug(`Email sent successfully via ${providerName}`);

                                return {
                                    data: {
                                        ...result.data,
                                        messageId: result.data.messageId || generateMessageId(),
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
                            // eslint-disable-next-line no-await-in-loop -- Sequential delay is required for failover
                            await new Promise<void>((resolve) => {
                                setTimeout(() => {
                                    resolve();
                                }, options.retryAfter);
                            });
                        }
                    }

                    // All providers failed
                    const errorMessages = errors.map((error) => (error instanceof Error ? error.message : String(error))).join("; ");

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
             * Validates credentials by checking if at least one provider is available.
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);
