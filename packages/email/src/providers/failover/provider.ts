import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailOptions, EmailResult, Result } from "../../types";
import createLogger from "../../utils/create-logger";
import generateMessageId from "../../utils/generate-message-id";
import type { Provider, ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { FailoverConfig, FailoverEmailOptions } from "./types";

const isProviderFactory = (value: unknown): value is ProviderFactory<unknown, unknown, EmailOptions> => typeof value === "function";

const isProvider = (value: unknown): value is Provider =>
    value !== null && typeof value === "object" && "sendEmail" in value && "initialize" in value && "isAvailable" in value;

const PROVIDER_NAME = "failover";

/**
 * Failover Provider for sending emails with automatic failover to backup providers.
 */
const provider: ProviderFactory<FailoverConfig, unknown, FailoverEmailOptions> = defineProvider((config: FailoverConfig = {} as FailoverConfig) => {
    if (!config.mailers || config.mailers.length === 0) {
        throw new RequiredOptionError(PROVIDER_NAME, "mailers");
    }

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
                    let mailerProvider: Provider;

                    if (isProviderFactory(mailer)) {
                        mailerProvider = mailer({} as never);
                    } else if (isProvider(mailer)) {
                        mailerProvider = mailer;
                    } else {
                        logger.debug(`Skipping invalid mailer: ${mailer}`);
                        continue;
                    }

                    try {
                        // eslint-disable-next-line no-await-in-loop -- Sequential initialization is required
                        await mailerProvider.initialize();
                        providers.push(mailerProvider);
                        logger.debug(`Initialized provider: ${mailerProvider.name || "unknown"}`);
                    } catch (error) {
                        logger.debug(`Failed to initialize provider ${mailerProvider.name || "unknown"}:`, error);
                    }
                } catch (error) {
                    logger.debug(`Error processing mailer:`, error);
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
            attachments: true,
            batchSending: false,
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false,
            tagging: false,
            templates: false,
            tracking: false,
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

                for (const providerToCheck of providers) {
                    try {
                        // eslint-disable-next-line no-await-in-loop -- Sequential checking is required
                        if (await providerToCheck.isAvailable()) {
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

                for (let i = 0; i < providers.length; i += 1) {
                    const currentProvider = providers[i];

                    if (!currentProvider) {
                        continue;
                    }

                    const providerName = currentProvider.name || `provider-${i + 1}`;

                    logger.debug(`Attempting to send email via ${providerName} (${i + 1}/${providers.length})`);

                    try {
                        // eslint-disable-next-line no-await-in-loop -- Sequential processing is required for failover
                        const isAvailable = await currentProvider.isAvailable();

                        if (!isAvailable) {
                            logger.debug(`Provider ${providerName} is not available, skipping`);
                            errors.push(new EmailError(PROVIDER_NAME, `Provider ${providerName} is not available`));
                            continue;
                        }

                        // eslint-disable-next-line no-await-in-loop -- Sequential processing is required for failover
                        const result = await currentProvider.sendEmail(emailOptions);

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
});

export default provider;
