import { EmailError } from "../../errors/email-error";
import type { EmailResult, Receipt, Result } from "../../types";
import { createLogger } from "../../utils/create-logger";
import { generateMessageId } from "../../utils/generate-message-id";
import { validateEmailOptions } from "../../utils/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { MockConfig, MockEmailEntry, MockEmailOptions } from "./types";

const PROVIDER_NAME = "mock";

// Global storage for all mock providers (shared across instances)
const emailStorage = new Map<string, MockEmailEntry[]>();

/**
 * Create default mock config
 */
const createDefaultConfig = (): Pick<MockConfig, "logger" | "defaultResponse" | "randomDelayRange">
    & Required<Omit<MockConfig, "logger" | "defaultResponse" | "randomDelayRange">> => {
    return {
        debug: false,
        delay: 0,
        failureRate: 0,
        randomDelayRange: { max: 0, min: 0 },
        retries: 0,
        simulateFailure: false,
        timeout: 0,
    };
};

/**
 * Mock Provider for testing emails without actually sending them
 * Stores emails in memory for later retrieval and inspection
 */
export const mockProvider: ProviderFactory<MockConfig, MockEmailEntry[], MockEmailOptions> = defineProvider((options_: MockConfig = {} as MockConfig) => {
    // Use instance ID to separate storage for different provider instances
    const instanceId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    if (!emailStorage.has(instanceId)) {
        emailStorage.set(instanceId, []);
    }

    const storage = emailStorage.get(instanceId)!;
    let isInitialized = false;
    let nextResponse: Receipt | null = null;
    const config: Pick<MockConfig, "logger" | "defaultResponse" | "randomDelayRange">
        & Required<Omit<MockConfig, "logger" | "defaultResponse" | "randomDelayRange">> = {
            ...createDefaultConfig(),
            defaultResponse: options_.defaultResponse,
            logger: options_.logger,
            randomDelayRange: options_.randomDelayRange || { max: 0, min: 0 },
            ...options_,
        };

    const logger = createLogger(PROVIDER_NAME, config.debug, config.logger);

    return {
        /**
         * Clear all stored messages.
         * This removes all messages from the internal storage but does not
         * reset other configuration like delays or failure rates.
         */
        clearSentMessages(): void {
            storage.length = 0;
            logger.debug("Cleared all sent messages");
        },

        features: {
            attachments: true,
            batchSending: true,
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false,
            tagging: true,
            templates: false,
            tracking: false,
        },

        /**
         * Find the first message matching the given predicate.
         */
        findMessageBy(predicate: (message: MockEmailEntry) => boolean): MockEmailEntry | undefined {
            return storage.find(predicate);
        },

        /**
         * Find all messages matching the given predicate.
         */
        findMessagesBy(predicate: (message: MockEmailEntry) => boolean): ReadonlyArray<MockEmailEntry> {
            return storage.filter(predicate);
        },

        /**
         * Get email by ID
         * @param id Email ID to retrieve
         * @returns Email details
         */
        async getEmail(id: string): Promise<Result<unknown>> {
            try {
                if (!id) {
                    return {
                        error: new EmailError(PROVIDER_NAME, "Email ID is required to retrieve email details"),
                        success: false,
                    };
                }

                const email = storage.find((entry) => entry.id === id);

                if (!email) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Email with ID ${id} not found`),
                        success: false,
                    };
                }

                logger.debug("Retrieved email", { id });

                return {
                    data: email,
                    success: true,
                };
            } catch (error) {
                logger.debug("Exception retrieving email", error);

                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to retrieve email: ${(error as Error).message}`, { cause: error as Error }),
                    success: false,
                };
            }
        },

        /**
         * Get the storage array for this instance (useful for testing)
         */
        getInstance(): MockEmailEntry[] {
            return storage;
        },

        /**
         * Get the last message that was sent, or undefined if no messages have been sent.
         */
        getLastSentMessage(): MockEmailEntry | undefined {
            return storage[storage.length - 1];
        },

        /**
         * Get all messages with a specific subject.
         */
        getMessagesBySubject(subject: string): ReadonlyArray<MockEmailEntry> {
            return storage.filter((message) => message.options.subject === subject);
        },

        /**
         * Get all messages sent to a specific email address.
         * Searches through To, CC, and BCC recipients to find messages
         * that were sent to the specified email address.
         */
        getMessagesTo(email: string): ReadonlyArray<MockEmailEntry> {
            return storage.filter((message) => {
                const toAddresses = Array.isArray(message.options.to) ? message.options.to : [message.options.to];
                const ccAddresses = message.options.cc ? Array.isArray(message.options.cc) ? message.options.cc : [message.options.cc] : [];
                const bccAddresses = message.options.bcc ? Array.isArray(message.options.bcc) ? message.options.bcc : [message.options.bcc] : [];

                const allRecipients = [...toAddresses, ...ccAddresses, ...bccAddresses];

                return allRecipients.some((addr) => addr.email === email);
            });
        },

        /**
         * Get all sent emails for this instance
         */
        getSentEmails(): MockEmailEntry[] {
            return [...storage];
        },

        /**
         * Get all messages that have been "sent" through this transport.
         * Alias for getSentEmails() for consistency with reference implementation
         */
        getSentMessages(): ReadonlyArray<MockEmailEntry> {
            return [...storage];
        },

        /**
         * Get the total number of messages that have been sent.
         */
        getSentMessagesCount(): number {
            return storage.length;
        },

        /**
         * Initialize the mock provider
         */
        async initialize(): Promise<void> {
            if (isInitialized) {
                return;
            }

            if (config.delay > 0) {
                await new Promise((resolve) => {
                    setTimeout(resolve, config.delay);
                });
            }

            isInitialized = true;
            logger.debug("Mock provider initialized");
        },

        /**
         * Check if mock provider is available (always true)
         */
        async isAvailable(): Promise<boolean> {
            return true;
        },

        name: PROVIDER_NAME,

        options: config,

        /**
         * Clear all stored emails for this instance
         */
        reset(): void {
            storage.length = 0;
            nextResponse = null;
            const defaultConfig = createDefaultConfig();

            // Update config properties instead of reassigning to keep options reference
            config.debug = defaultConfig.debug;
            config.delay = defaultConfig.delay;
            config.failureRate = defaultConfig.failureRate;
            config.retries = defaultConfig.retries;
            config.simulateFailure = defaultConfig.simulateFailure;
            config.timeout = defaultConfig.timeout;
            config.randomDelayRange = { max: 0, min: 0 };
            config.defaultResponse = undefined;
            logger.debug("Mock provider reset to initial state");
        },

        /**
         * Send email (mock - stores in memory)
         * @param emailOptions The email options
         */
        async sendEmail(emailOptions: MockEmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return {
                        error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                        success: false,
                    };
                }

                if (!isInitialized) {
                    await this.initialize();
                }

                // Calculate delay (random delay range takes precedence over fixed delay)
                let delayMs = config.delay;

                if (config.randomDelayRange && config.randomDelayRange.max > 0) {
                    const { max, min } = config.randomDelayRange;

                    delayMs = Math.floor(Math.random() * (max - min + 1)) + min;
                }

                // Simulate delay if configured
                if (delayMs > 0) {
                    await new Promise((resolve) => {
                        setTimeout(resolve, delayMs);
                    });
                }

                // Check if nextResponse is set (takes precedence)
                if (nextResponse !== null) {
                    const response = nextResponse;

                    nextResponse = null; // Reset after use

                    // If it's a failure response, return error
                    if (!response.successful) {
                        logger.debug("Using next response (failure)", response);

                        return {
                            error: new EmailError(PROVIDER_NAME, response.errorMessages.join(", ")),
                            success: false,
                        };
                    }

                    // If it's a success response, create entry and return
                    const messageId = response.messageId || generateMessageId();
                    const timestamp = response.timestamp || new Date();

                    const result: EmailResult = {
                        messageId,
                        provider: response.provider || PROVIDER_NAME,
                        response: response.response,
                        sent: true,
                        timestamp,
                    };

                    const entry: MockEmailEntry = {
                        id: messageId,
                        options: emailOptions,
                        result,
                        timestamp,
                    };

                    storage.push(entry);

                    logger.debug("Email stored using next response", { messageId });

                    return {
                        data: result,
                        success: true,
                    };
                }

                // Check for random failure based on failure rate
                const shouldFail = config.simulateFailure || (config.failureRate > 0 && Math.random() < config.failureRate);

                if (shouldFail) {
                    logger.debug("Simulating email send failure");

                    return {
                        error: new EmailError(PROVIDER_NAME, "Simulated failure"),
                        success: false,
                    };
                }

                // Use default response if set, otherwise create success response
                const messageId = config.defaultResponse?.successful ? config.defaultResponse.messageId : generateMessageId();
                const timestamp = config.defaultResponse?.successful && config.defaultResponse.timestamp ? config.defaultResponse.timestamp : new Date();

                const result: EmailResult = {
                    messageId,
                    provider: PROVIDER_NAME,
                    response: config.defaultResponse?.response || {
                        mock: true,
                        stored: true,
                    },
                    sent: true,
                    timestamp,
                };

                // Store email in memory
                const entry: MockEmailEntry = {
                    id: messageId,
                    options: emailOptions,
                    result,
                    timestamp,
                };

                storage.push(entry);

                logger.debug("Email stored in mock provider", {
                    messageId,
                    subject: emailOptions.subject,
                    to: Array.isArray(emailOptions.to) ? emailOptions.to.map((t) => t.email) : emailOptions.to.email,
                });

                return {
                    data: result,
                    success: true,
                };
            } catch (error) {
                logger.debug("Exception sending email", error);

                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to send email: ${(error as Error).message}`, { cause: error as Error }),
                    success: false,
                };
            }
        },

        /**
         * Set the default response that will be returned for send operations.
         * This response is used when no next response is set and random failures
         * are not triggered.
         */
        setDefaultResponse(receipt: Receipt): void {
            config.defaultResponse = receipt;
            logger.debug("Set default response", { receipt });
        },

        /**
         * Set a fixed delay in milliseconds for all send operations.
         * This overrides any random delay range that was previously configured.
         */
        setDelay(milliseconds: number): void {
            if (milliseconds < 0) {
                throw new RangeError("Delay must be non-negative");
            }

            config.delay = milliseconds;
            config.randomDelayRange = { max: 0, min: 0 };
            logger.debug("Set fixed delay", { milliseconds });
        },

        /**
         * Set the failure rate (0.0 to 1.0). When set, sends will randomly fail
         * at the specified rate instead of using the configured responses.
         */
        setFailureRate(rate: number): void {
            if (rate < 0 || rate > 1) {
                throw new RangeError("Failure rate must be between 0.0 and 1.0");
            }

            config.failureRate = rate;
            logger.debug("Set failure rate", { rate });
        },

        /**
         * Set the response that will be returned for the next send operation.
         * After being used once, it will revert to the default response.
         * This is useful for testing specific success or failure scenarios.
         */
        setNextResponse(receipt: Receipt): void {
            nextResponse = receipt;
            logger.debug("Set next response", { receipt });
        },

        /**
         * Set a random delay range in milliseconds for send operations.
         * This overrides any fixed delay that was previously configured.
         */
        setRandomDelay(min: number, max: number): void {
            if (min < 0 || max < 0 || min > max) {
                throw new RangeError("Invalid delay range");
            }

            config.delay = 0;
            config.randomDelayRange = { max, min };
            logger.debug("Set random delay range", { max, min });
        },

        /**
         * Shutdown and cleanup
         */
        async shutdown(): Promise<void> {
            storage.length = 0;
            emailStorage.delete(instanceId);
            logger.debug("Mock provider shutdown");
        },

        /**
         * Validate credentials (always true for mock)
         */
        async validateCredentials(): Promise<boolean> {
            return true;
        },

        /**
         * Wait for a message matching the given predicate.
         * This method polls for a matching message until one is found or the timeout
         * expires. Useful for testing async email workflows where you need to wait
         * for specific messages.
         */
        async waitForMessage(predicate: (message: MockEmailEntry) => boolean, timeout: number = 5000): Promise<MockEmailEntry> {
            const startTime = Date.now();

            while (true) {
                const message = this.findMessageBy(predicate);

                if (message) {
                    return message;
                }

                if (Date.now() - startTime > timeout) {
                    throw new Error("Timeout waiting for message");
                }

                // Wait a bit before checking again
                await new Promise((resolve) => {
                    setTimeout(resolve, 10);
                });
            }
        },

        /**
         * Wait for a specific number of messages to be sent.
         * This method polls the message count until the target is reached or
         * the timeout expires. Useful for testing async email workflows where you
         * need to wait for messages to be sent.
         */
        async waitForMessageCount(count: number, timeout: number = 5000): Promise<void> {
            const startTime = Date.now();

            while (storage.length < count) {
                if (Date.now() - startTime > timeout) {
                    throw new Error(`Timeout waiting for ${count} messages (got ${storage.length})`);
                }

                // Wait a bit before checking again
                await new Promise((resolve) => {
                    setTimeout(resolve, 10);
                });
            }
        },
    };
});
