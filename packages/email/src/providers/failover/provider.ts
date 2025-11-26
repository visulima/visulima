import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailOptions, EmailResult, Result } from "../../types";
import createLogger from "../../utils/create-logger";
import type { Provider, ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { FailoverConfig, FailoverEmailOptions } from "./types";

// Type guard to check if something is a ProviderFactory
const isProviderFactory = (value: unknown): value is ProviderFactory<unknown, unknown, EmailOptions> => typeof value === "function";

// Type guard to check if something is a Provider
const isProvider = (value: unknown): value is Provider =>
    value !== null && typeof value === "object" && "sendEmail" in value && "initialize" in value && "isAvailable" in value;

// Constants
const PROVIDER_NAME = "failover";

/**
 * Failover Provider for sending emails with automatic failover to backup providers
 */
const failoverProvider: ProviderFactory<FailoverConfig, unknown, FailoverEmailOptions> = defineProvider((config: FailoverConfig = {} as FailoverConfig) => {
    // Validate required options
    if (!config.mailers || config.mailers.length === 0) {
        throw new RequiredOptionError(PROVIDER_NAME, "mailers");
    }

    // Initialize with defaults
    const options: Pick<FailoverConfig, "logger"> & Required<Omit<FailoverConfig, "logger">> = {
        debug: config.debug || false,
        logger: config.logger,
        mailers: config.mailers,
        retries: config.retries || 3,
        retryAfter: config.retryAfter ?? 60,
        timeout: config.timeout || 30_000,
    };

    let isInitialized = false;
    const providers: Provider[] = [];

    const logger = createLogger(PROVIDER_NAME, config.logger);

    /**
     * Initializes all providers in the failover configuration.
     */
    const initializeProviders = async (): Promise<void> => {
        providers.length = 0;

        for await (const mailer of options.mailers) {
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
         * Initializes the failover provider and all underlying providers.
         * @throws {EmailError} When no providers could be initialized.
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
         * Sends an email through failover providers.
         * Tries each provider in order until one succeeds.
         * @param emailOptions The email options to send.
         * @returns A result object containing the email result or an error.
         */
        // eslint-disable-next-line sonarjs/cognitive-complexity
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
                        // eslint-disable-next-line no-await-in-loop
                        const isAvailable = await provider.isAvailable();

                        if (!isAvailable) {
                            logger.debug(`Provider ${providerName} is not available, skipping`);
                            errors.push(new EmailError(PROVIDER_NAME, `Provider ${providerName} is not available`));
                            continue;
                        }

                        // Try to send the email
                        // eslint-disable-next-line no-await-in-loop
                        const result = await provider.sendEmail(emailOptions);

                        if (result.success && result.data) {
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
                        // eslint-disable-next-line no-await-in-loop
                        await new Promise((resolve) => {
                            setTimeout(() => {
                                resolve(undefined);
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
         * @returns A promise that resolves to true if at least one provider is available, false otherwise.
         */
        async validateCredentials(): Promise<boolean> {
            return this.isAvailable();
        },
    };
});

export default failoverProvider;
