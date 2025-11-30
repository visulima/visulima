import DraftMailMessage from "./draft-mail-message";
import MailMessage from "./mail-message";
import type { Provider } from "./providers/provider";
import type { EmailAddress, EmailHeaders, EmailOptions, EmailResult, Receipt, Result } from "./types";
import buildMimeMessage from "./utils/build-mime-message";
import type { Logger } from "./utils/create-logger";
import { createLogger } from "./utils/create-logger";
import headersToRecord from "./utils/headers-to-record";

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
 * Global email configuration that applies to all emails sent through a Mail instance.
 */
export interface MailGlobalConfig {
    /**
     * Default from address to use if not specified in the message.
     */
    from?: EmailAddress;

    /**
     * Global headers to add to all emails.
     * These will be merged with message-specific headers, with message headers taking precedence.
     */
    headers?: EmailHeaders;

    /**
     * Default reply-to address to use if not specified in the message.
     */
    replyTo?: EmailAddress;
}

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

    private globalConfig?: MailGlobalConfig;

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
     * Sets the default from address for all emails sent through this Mail instance.
     * @param from Default from address to use if not specified in the message.
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * const mail = createMail(provider);
     * mail.setFrom({ email: "noreply@example.com", name: "My App" });
     * ```
     */
    public setFrom(from: EmailAddress): this {
        if (!this.globalConfig) {
            this.globalConfig = {};
        }

        this.globalConfig.from = from;

        if (this.logger) {
            this.logger.debug("Default from address updated", { from: from.email });
        }

        return this;
    }

    /**
     * Sets the default reply-to address for all emails sent through this Mail instance.
     * @param replyTo Default reply-to address to use if not specified in the message.
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * const mail = createMail(provider);
     * mail.setReplyTo({ email: "support@example.com" });
     * ```
     */
    public setReplyTo(replyTo: EmailAddress): this {
        if (!this.globalConfig) {
            this.globalConfig = {};
        }

        this.globalConfig.replyTo = replyTo;

        if (this.logger) {
            this.logger.debug("Default reply-to address updated", { replyTo: replyTo.email });
        }

        return this;
    }

    /**
     * Sets default headers for all emails sent through this Mail instance.
     * These headers will be merged with message-specific headers, with message headers taking precedence.
     * @param headers Default headers to add to all emails.
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * const mail = createMail(provider);
     * mail.setHeaders({ "X-App-Name": "MyApp", "X-Version": "1.0.0" });
     * ```
     */
    public setHeaders(headers: EmailHeaders): this {
        if (!this.globalConfig) {
            this.globalConfig = {};
        }

        this.globalConfig.headers = headers;

        if (this.logger) {
            const headersRecord = headersToRecord(headers);

            this.logger.debug("Default headers updated", {
                count: Object.keys(headersRecord).length,
                headers: Object.keys(headersRecord),
            });
        }

        return this;
    }

    /**
     * Creates a draft email in EML (RFC 822) format without sending it.
     * This is useful for previewing, saving for later, or testing email content.
     * @param message The message to create a draft from (MailMessage or EmailOptions).
     * @returns The email in EML (RFC 822) format as a string with X-Unsent: 1 header.
     * @example
     * ```ts
     * // Create a draft from MailMessage
     * const message = new MailMessage()
     *   .to("user@example.com")
     *   .from("sender@example.com")
     *   .subject("Hello")
     *   .html("<h1>Hello World</h1>");
     *
     * const eml = await mail.draft(message);
     * console.log("Draft EML:", eml);
     *
     * // Save to file
     * await fs.writeFile("draft.eml", eml);
     *
     * // Or send later by parsing the EML back to EmailOptions
     * ```
     */
    public async draft(message: SendableMessage | DraftMailMessage): Promise<string> {
        let emailOptions: EmailOptions
            = message instanceof MailMessage || message instanceof DraftMailMessage
                ? await this.buildDraftFromMessage(message)
                : await this.buildDraftFromOptions(message as EmailOptions);

        // Apply global configuration (for EmailOptions or to override message-specific values)
        emailOptions = this.applyGlobalConfig(emailOptions);

        // Add X-Unsent header to indicate this is a draft
        const headersRecord = emailOptions.headers ? headersToRecord(emailOptions.headers) : {};

        emailOptions.headers = {
            ...headersRecord,
            "X-Unsent": "1",
        };

        // Build MIME message (EML format)
        const eml = await buildMimeMessage(emailOptions);

        if (this.logger) {
            this.logger.debug("Draft created successfully in EML format", {
                from: emailOptions.from.email,
                size: eml.length,
                subject: emailOptions.subject,
                to: Array.isArray(emailOptions.to) ? emailOptions.to.length : 1,
            });
        }

        return eml;
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
        if (message instanceof DraftMailMessage) {
            throw new TypeError("Cannot send draft messages. Convert to MailMessage first or remove X-Unsent header.");
        }

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

        emailOptions = this.applyGlobalConfig(emailOptions);

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
            if (message instanceof DraftMailMessage) {
                throw new TypeError("Cannot send draft messages. Convert to MailMessage first or remove X-Unsent header.");
            }

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
                const result = await this.send(message);

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
            this.logger.debug("Batch email send completed", {
                failureCount,
                processedCount,
                provider: providerName,
                successCount,
            });
        }
    }

    /**
     * Builds email options from a MailMessage instance for draft creation.
     * Applies global configuration before building to ensure required fields are set.
     * @param message The MailMessage or DraftMailMessage instance.
     * @returns Built email options.
     * @private
     */
    private async buildDraftFromMessage(message: MailMessage | DraftMailMessage): Promise<EmailOptions> {
        if (this.logger) {
            this.logger.debug("Creating draft from MailMessage instance");
        }

        // Set logger on message if available
        if (this.loggerInstance) {
            message.setLogger(this.loggerInstance);
        }

        // Apply global configuration to message before building
        this.applyGlobalConfigToMessage(message);

        return await message.build();
    }

    /**
     * Builds email options from EmailOptions for draft creation.
     * @param options The EmailOptions object.
     * @returns Email options.
     * @private
     */
    private async buildDraftFromOptions(options: EmailOptions): Promise<EmailOptions> {
        if (this.logger) {
            this.logger.debug("Creating draft from email options", {
                subject: options.subject,
                to: Array.isArray(options.to) ? options.to.length : 1,
            });
        }

        return options;
    }

    /**
     * Applies global configuration to a MailMessage instance.
     * @param message The MailMessage or DraftMailMessage instance.
     * @private
     */
    private applyGlobalConfigToMessage(message: MailMessage | DraftMailMessage): void {
        const globalFrom = this.globalConfig?.from;

        if (globalFrom && !message.getFrom()) {
            message.from(globalFrom);
        }

        const globalReplyTo = this.globalConfig?.replyTo;

        if (globalReplyTo && !message.getReplyTo()) {
            message.replyTo(globalReplyTo);
        }

        if (this.globalConfig?.headers) {
            const globalHeadersRecord = headersToRecord(this.globalConfig.headers);

            Object.entries(globalHeadersRecord).forEach(([key, value]) => {
                message.header(key, value);
            });
        }
    }

    /**
     * Applies global configuration to email options.
     * Global values are only applied if the corresponding field is not already set in the email options.
     * @param emailOptions The email options to apply global configuration to.
     * @returns Email options with global configuration applied.
     * @private
     */
    private applyGlobalConfig(emailOptions: EmailOptions): EmailOptions {
        if (!this.globalConfig) {
            return emailOptions;
        }

        const merged: EmailOptions = { ...emailOptions };

        // Apply default from if not set
        if (!merged.from && this.globalConfig.from) {
            merged.from = this.globalConfig.from;

            if (this.logger) {
                this.logger.debug("Applied global from address", { from: this.globalConfig.from.email });
            }
        }

        // Apply default reply-to if not set
        if (!merged.replyTo && this.globalConfig.replyTo) {
            merged.replyTo = this.globalConfig.replyTo;

            if (this.logger) {
                this.logger.debug("Applied global reply-to address", { replyTo: this.globalConfig.replyTo.email });
            }
        }

        // Merge global headers with message headers (message headers take precedence)
        if (this.globalConfig.headers) {
            const globalHeadersRecord = headersToRecord(this.globalConfig.headers);
            const messageHeadersRecord = merged.headers ? headersToRecord(merged.headers) : {};

            merged.headers = {
                ...globalHeadersRecord,
                ...messageHeadersRecord,
            };

            if (this.logger) {
                this.logger.debug("Merged global headers", {
                    globalCount: Object.keys(globalHeadersRecord).length,
                    messageCount: Object.keys(messageHeadersRecord).length,
                });
            }
        }

        return merged;
    }
}

/**
 * Creates a new Mail instance with a provider.
 * @param provider The email provider instance.
 * @returns A new Mail instance.
 * @example
 * ```ts
 * const mail = createMail(provider);
 * mail.setFrom({ email: "noreply@example.com", name: "My App" });
 * ```
 */
export const createMail = (provider: Provider): Mail => new Mail(provider);
