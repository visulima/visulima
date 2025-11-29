import MailMessage from "./mail-message";
import type { Provider } from "./providers/provider";
import type { EmailOptions, EmailResult, Receipt, Result } from "./types";
import type { Logger } from "./utils/create-logger";
import { createLogger } from "./utils/create-logger";

/**
 * Logs the result of sending an email.
 * @param logger Optional logger instance.
 * @param result Send result to log.
 * @param providerName Name of the provider used.
 */
const logSendResult = (logger: Logger | undefined, result: Result<EmailResult>, providerName: string): void => {
    if (result.success && result.data) {
        if (logger) {
            logger.info("Email sent successfully", {
                messageId: result.data.messageId,
                provider: result.data.provider,
            });
        }
    } else if (logger) {
        logger.error("Email send failed", {
            error: result.error,
            provider: providerName,
        });
    }
};

/**
 * Type alias for messages that can be sent via Mail.send().
 */
export type SendableMessage = MailMessage | EmailOptions;

/**
 * Mail class - instance-based email sending.
 */
export class Mail {
    /**
     * Extracts error messages from an error object.
     * @param error Error object to extract messages from.
     * @returns Array of error messages.
     * @private
     */
    private static extractErrorMessages(error: unknown): string[] {
        if (error instanceof Error) {
            return [error.message];
        }

        return [String(error || "Unknown error")];
    }

    private provider: Provider;

    private logger?: Logger;

    private loggerInstance?: Console;

    /**
     * Creates a new Mail instance with a provider.
     * @param provider The email provider instance.
     */
    public constructor(provider: Provider) {
        this.provider = provider;
    }

    /**
     * Sets the logger instance for this mail instance.
     * @param logger The logger instance (Console) to use for logging.
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * const mail = createMail(provider);
     * mail.setLogger(console);
     * ```
     */
    public setLogger(logger: Console): this {
        this.loggerInstance = logger;
        this.logger = createLogger("Mail", logger);

        return this;
    }

    /**
     * Sends an email message or email options.
     * @param message The message to send (MailMessage or EmailOptions).
     * @returns A result object containing the email result or error.
     * @example
     * ```ts
     * // Using MailMessage
     * const message = new MailMessage()
     *   .to("user@example.com")
     *   .from("sender@example.com")
     *   .subject("Hello")
     *   .html("<h1>Hello World</h1>");
     * await mail.send(message);
     *
     * // Using EmailOptions
     * await mail.send({
     *   to: "user@example.com",
     *   from: "sender@example.com",
     *   subject: "Hello",
     *   html: "<h1>Hello World</h1>"
     * });
     * ```
     */
    public async send(message: SendableMessage): Promise<Result<EmailResult>> {
        let emailOptions: EmailOptions;

        if (message instanceof MailMessage) {
            if (this.logger) {
                this.logger.debug("Sending MailMessage instance");
            }

            // Set logger on message if available
            if (this.loggerInstance) {
                message.setLogger(this.loggerInstance);
            }

            emailOptions = await message.build();
        } else {
            const options = message as EmailOptions;

            if (this.logger) {
                this.logger.debug("Sending email with options", {
                    subject: options.subject,
                    to: Array.isArray(options.to) ? options.to.length : 1,
                });
            }

            emailOptions = options;
        }

        const result = await this.provider.sendEmail(emailOptions);

        logSendResult(this.logger, result, this.provider.name || "unknown");

        return result;
    }

    /**
     * Sends multiple messages using the email service.
     * Returns an async iterable that yields receipts for each sent message.
     * @example
     * ```ts
     * const messages = [
     *   { from: "sender@example.com", to: "user1@example.com", subject: "Hello 1", html: "<h1>Hello</h1>" },
     *   { from: "sender@example.com", to: "user2@example.com", subject: "Hello 2", html: "<h1>Hello</h1>" },
     * ];
     *
     * for await (const receipt of mail.sendMany(messages)) {
     *   if (receipt.successful) {
     *     console.log("Sent:", receipt.messageId);
     *   } else {
     *     console.error("Failed:", receipt.errorMessages);
     *   }
     * }
     * ```
     * @param messages An iterable of MailMessage instances or email options to send.
     * @param options Optional parameters for sending.
     * @param options.signal Abort signal to cancel the operation.
     * @returns An async iterable that yields receipts for each sent message.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async* sendMany(messages: Iterable<SendableMessage> | AsyncIterable<SendableMessage>, options?: { signal?: AbortSignal }): AsyncIterable<Receipt> {
        const providerName = this.provider.name;
        let processedCount = 0;
        let successCount = 0;
        let failureCount = 0;

        if (this.logger) {
            this.logger.debug("Starting batch email send", { provider: providerName });
        }

        for await (const message of messages) {
            if (options?.signal?.aborted) {
                if (this.logger) {
                    this.logger.warn("Batch send operation was aborted", {
                        failed: failureCount,
                        processed: processedCount,
                        successful: successCount,
                    });
                }

                yield {
                    errorMessages: ["Send operation was aborted"],
                    provider: providerName,
                    successful: false,
                };

                return;
            }

            processedCount += 1;

            try {
                let emailOptions: EmailOptions;

                if (message instanceof MailMessage) {
                    // Set logger on message if available
                    if (this.loggerInstance) {
                        message.setLogger(this.loggerInstance);
                    }

                    emailOptions = await message.build();
                } else {
                    emailOptions = message as EmailOptions;
                }

                if (this.logger) {
                    this.logger.debug(`Sending email ${processedCount}`, {
                        subject: emailOptions.subject,
                        to: Array.isArray(emailOptions.to) ? emailOptions.to.length : 1,
                    });
                }

                const result = await this.provider.sendEmail(emailOptions);

                if (result.success && result.data) {
                    successCount += 1;

                    if (this.logger) {
                        this.logger.debug(`Email ${processedCount} sent successfully`, {
                            messageId: result.data.messageId,
                        });
                    }

                    yield {
                        messageId: result.data.messageId,
                        provider: result.data.provider || providerName,
                        response: result.data.response,
                        successful: true,
                        timestamp: result.data.timestamp,
                    };
                } else {
                    failureCount += 1;

                    if (this.logger) {
                        this.logger.error(`Email ${processedCount} send failed`, {
                            error: result.error,
                        });
                    }

                    yield {
                        errorMessages: Mail.extractErrorMessages(result.error),
                        provider: providerName,
                        successful: false,
                    };
                }
            } catch (error) {
                failureCount += 1;

                if (this.logger) {
                    this.logger.error(`Email ${processedCount} send failed with exception`, error);
                }

                yield {
                    errorMessages: Mail.extractErrorMessages(error),
                    provider: providerName,
                    successful: false,
                };
            }
        }

        if (this.logger) {
            this.logger.info("Batch email send completed", {
                failed: failureCount,
                successful: successCount,
                total: processedCount,
            });
        }
    }
}

/**
 * Creates a new Mail instance with a provider.
 * @param provider The email provider instance.
 * @returns A new Mail instance.
 */
export const createMail = (provider: Provider): Mail => new Mail(provider);
