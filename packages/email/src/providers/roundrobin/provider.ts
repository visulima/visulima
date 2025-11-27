import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailOptions, EmailResult, Result } from "../../types";
import createLogger from "../../utils/create-logger";
import type { Provider, ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { RoundRobinConfig, RoundRobinEmailOptions } from "./types";

// Type guard to check if something is a ProviderFactory
const isProviderFactory = (value: unknown): value is ProviderFactory<unknown, unknown, EmailOptions> => typeof value === "function";

// Type guard to check if something is a Provider
const isProvider = (value: unknown): value is Provider =>
    value !== undefined && value !== null && typeof value === "object" && "sendEmail" in value && "initialize" in value && "isAvailable" in value;

// Constants
const PROVIDER_NAME = "roundrobin";

/**
 * Round Robin Provider for distributing email sending across multiple providers
 */
const roundRobinProvider: ProviderFactory<RoundRobinConfig, unknown, RoundRobinEmailOptions> = defineProvider(
    (config: RoundRobinConfig = {} as RoundRobinConfig) => {
        // Validate required options
        if (!config.mailers || config.mailers.length === 0) {
            throw new RequiredOptionError(PROVIDER_NAME, "mailers");
        }

        // Initialize with defaults
        const options: Pick<RoundRobinConfig, "logger"> & Required<Omit<RoundRobinConfig, "logger">> = {
            debug: config.debug || false,
            logger: config.logger,
            mailers: config.mailers,
            retries: config.retries || 3,
            retryAfter: config.retryAfter ?? 60,
            timeout: config.timeout || 30_000,
        };

        let isInitialized = false;
        const providers: Provider[] = [];
        let currentIndex = 0;

        const logger = createLogger(PROVIDER_NAME, config.logger);

        /**
         * Initializes all providers in the round-robin configuration.
         * @throws {EmailError} When no providers could be initialized.
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
                        // eslint-disable-next-line no-await-in-loop
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
            // eslint-disable-next-line sonarjs/pseudo-random
            currentIndex = Math.floor(Math.random() * providers.length);
            logger.debug(`Round robin starting at index ${currentIndex} (${providers[currentIndex]?.name || "unknown"})`);
        };

        /**
         * Gets the next available provider in round-robin fashion.
         * @returns The next provider in the rotation, or undefined if no providers are available.
         */
        const getNextProvider = async (): Promise<Provider | undefined> => {
            if (providers.length === 0) {
                return undefined;
            }

            // Try to find an available provider starting from currentIndex
            const startIndex = currentIndex;
            let attempts = 0;

            while (attempts < providers.length) {
                const provider = providers[currentIndex];

                if (!provider) {
                    currentIndex = (currentIndex + 1) % providers.length;
                    attempts += 1;
                    continue;
                }

                const providerName = provider.name || `provider-${currentIndex + 1}`;

                // Check if provider is available
                try {
                    // eslint-disable-next-line no-await-in-loop
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
                attempts += 1;

                // If we've tried all providers, wait before retrying
                if (attempts < providers.length && options.retryAfter > 0) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(undefined);
                        }, options.retryAfter);
                    });
                }
            }

            // If we've tried all providers and none are available, return the one at startIndex
            logger.debug(`No available providers found, using provider at index ${startIndex}`);

            return providers[startIndex] || undefined;
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
             * Initializes the round robin provider and all underlying providers.
             * @throws {EmailError} When initialization fails.
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
             * Checks if at least one provider is available.
             * @returns True if at least one provider is available, false otherwise.
             */
            async isAvailable(): Promise<boolean> {
                try {
                    if (providers.length === 0) {
                        await initializeProviders();
                    }

                    // Check if at least one provider is available (check in parallel for efficiency)
                    const availabilityChecks = await Promise.allSettled(providers.map((provider) => provider.isAvailable()));

                    return availabilityChecks.some((result) => result.status === "fulfilled" && result.value === true);
                } catch {
                    return false;
                }
            },

            name: PROVIDER_NAME,

            options,

            /**
             * Sends an email through round robin providers.
             * Selects the next available provider in rotation.
             * @param emailOptions The email options to send.
             * @returns A result object containing the email result or an error.
             */
            // eslint-disable-next-line sonarjs/cognitive-complexity
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
                            } as EmailResult,
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
                    let attempts = 0;

                    while (attempts < providers.length - 1) {
                        // eslint-disable-next-line no-await-in-loop
                        const nextProvider = await getNextProvider();

                        if (!nextProvider || nextProvider === provider) {
                            break;
                        }

                        const nextProviderName = nextProvider.name || "unknown";

                        logger.debug(`Retrying with ${nextProviderName}`);

                        try {
                            // eslint-disable-next-line no-await-in-loop
                            const retryResult = await nextProvider.sendEmail(emailOptions);

                            if (retryResult.success) {
                                logger.debug(`Email sent successfully via ${nextProviderName} (after retry)`);

                                return {
                                    data: {
                                        ...retryResult.data,
                                        provider: `${PROVIDER_NAME}(${nextProviderName})`,
                                    } as EmailResult,
                                    success: true,
                                };
                            }

                            if (retryResult.error) {
                                errors.push(retryResult.error);
                            }
                        } catch (error) {
                            errors.push(error instanceof Error ? error : new Error(String(error)));
                        }

                        attempts += 1;
                    }

                    // All providers failed
                    const errorMessages = errors.map((error) => (error instanceof Error ? error.message : String(error))).join("; ");

                    return {
                        error: new EmailError(PROVIDER_NAME, `Failed to send email via all providers. Errors: ${errorMessages}`, {
                            cause: errors[0] instanceof Error ? errors[0] : new Error(String(errors[0])),
                        }),
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
             * @returns A promise that resolves to true if at least one provider is available, false otherwise.
             */
            async validateCredentials(): Promise<boolean> {
                return this.isAvailable();
            },
        };
    },
);

export default roundRobinProvider;
