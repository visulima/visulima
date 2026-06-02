import DraftMailMessage from "./draft-mail-message";
import EmailError from "./errors/email-error";
import MailMessage from "./mail-message";
import type { Middleware, SendFunction } from "./middleware/types";
import { composeMiddleware } from "./middleware/types";
import type { Provider } from "./providers/provider";
import type { EmailAddress, EmailHeaders, EmailOptions, EmailResult, MaybePromise, Receipt, Result } from "./types";
import buildMimeMessage from "./utils/build-mime-message";
import type { Logger } from "./utils/create-logger";
import { createLogger } from "./utils/create-logger";
import headersToRecord from "./utils/headers-to-record";
import checkFeatureSupport from "./utils/validation/check-feature-support";

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
 * Builds a single personalized {@link EmailOptions} from a base message and a personalization.
 * @param base The resolved base options.
 * @param personalization The per-recipient overrides.
 * @param render Optional renderer for templated subject/html/text.
 * @returns The merged email options.
 */
const buildPersonalized = async (base: EmailOptions, personalization: Personalization, render?: BatchRenderer): Promise<EmailOptions> => {
    const merged: EmailOptions = { ...base, to: personalization.to };

    if (personalization.cc) {
        merged.cc = personalization.cc;
    }

    if (personalization.bcc) {
        merged.bcc = personalization.bcc;
    }

    if (personalization.replyTo) {
        merged.replyTo = personalization.replyTo;
    }

    if (personalization.headers) {
        merged.headers = { ...headersToRecord(base.headers ?? {}), ...headersToRecord(personalization.headers) };
    }

    merged.subject = personalization.subject ?? base.subject;

    if (render && personalization.data) {
        merged.subject = await render(merged.subject, personalization.data);

        if (base.html !== undefined) {
            merged.html = await render(base.html, personalization.data);
        }

        if (base.text !== undefined) {
            merged.text = await render(base.text, personalization.data);
        }
    }

    return merged;
};

/**
 * Type alias for messages that can be sent via Mail.send().
 */
export type SendableMessage = MailMessage | EmailOptions;

/**
 * Renders a template string against per-recipient data (e.g. a Handlebars/Liquid renderer).
 */
export type BatchRenderer = (template: string, data: Record<string, unknown>) => MaybePromise<string>;

/**
 * A per-recipient override applied on top of the batch's base message.
 *
 * Anything left unset falls back to the base message. When a {@link BatchRenderer} is supplied and
 * `data` is present, the base `subject`/`html`/`text` templates are rendered with this recipient's data.
 */
export interface Personalization {
    /**
     * Blind carbon-copy recipients for this message.
     */
    bcc?: EmailAddress | EmailAddress[];

    /**
     * Carbon-copy recipients for this message.
     */
    cc?: EmailAddress | EmailAddress[];

    /**
     * Template variables for this recipient (used with the batch {@link BatchRenderer}).
     */
    data?: Record<string, unknown>;

    /**
     * Extra headers merged over the base headers for this message.
     */
    headers?: EmailHeaders;

    /**
     * Reply-to override for this message.
     */
    replyTo?: EmailAddress;

    /**
     * Subject override for this message (rendered with `data` when a renderer is supplied).
     */
    subject?: string;

    /**
     * Primary (`To`) recipients for this message.
     */
    to: EmailAddress | EmailAddress[];
}

/**
 * Options for {@link Mail.sendBatch}.
 */
export interface SendBatchOptions {
    /**
     * Renders the base `subject`/`html`/`text` templates against each personalization's `data`.
     */
    render?: BatchRenderer;

    /**
     * Abort signal to cancel the batch mid-flight.
     */
    signal?: AbortSignal;
}

/**
 * Controls the fail-fast capability guard that runs before a message is handed to the provider.
 *
 * `"error"` (default) rejects the send with a failed Result when the message uses a capability the provider has explicitly declared unsupported.
 * `"warn"` logs a warning and sends anyway. `"off"` skips the check entirely.
 */
export type FeatureCheckMode = "error" | "off" | "warn";

/**
 * Options for a {@link Mail} instance.
 */
export interface MailOptions {
    /**
     * How to handle messages that use capabilities the provider has declared unsupported.
     * @default "error"
     */
    featureCheck?: FeatureCheckMode;
}

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

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return [String(error ?? "Unknown error")];
    }

    private provider: Provider;

    private logger?: Logger;

    private loggerInstance?: Console;

    private globalConfig?: MailGlobalConfig;

    private readonly featureCheck: FeatureCheckMode;

    private readonly middlewares: Middleware[] = [];

    private composedSend?: SendFunction;

    /**
     * Creates a new Mail instance with a provider.
     * @param provider The email provider instance.
     * @param options Optional Mail configuration.
     */
    public constructor(provider: Provider, options?: MailOptions) {
        this.provider = provider;
        this.featureCheck = options?.featureCheck ?? "error";
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
     * Registers a send middleware. Middlewares wrap the provider's `sendEmail` call and run in
     * registration order (first registered is the outermost wrapper), enabling retry, rate-limiting,
     * circuit-breaking, deduplication, logging, and credential injection.
     * @param middleware The middleware to add. See the `@visulima/email/middleware` entry point.
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * import { retryMiddleware, rateLimitMiddleware } from "@visulima/email/middleware";
     *
     * const mail = createMail(provider)
     *   .use(rateLimitMiddleware({ rate: 10 }))
     *   .use(retryMiddleware({ retries: 3 }));
     * ```
     */
    public use(middleware: Middleware): this {
        this.middlewares.push(middleware);
        // Invalidate the memoized chain so the new middleware is picked up on the next send.
        this.composedSend = undefined;

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
        this.globalConfig ??= {};

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
        this.globalConfig ??= {};

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
        this.globalConfig ??= {};

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
                : await this.buildDraftFromOptions(message);

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
            const options = message;

            if (this.logger) {
                this.logger.debug("Sending email with options", {
                    subject: options.subject,
                    to: Array.isArray(options.to) ? options.to.length : 1,
                });
            }

            emailOptions = options;
        }

        emailOptions = this.applyGlobalConfig(emailOptions);

        const featureError = this.assertFeatureSupport(emailOptions);

        if (featureError) {
            return { error: featureError, success: false };
        }

        const result = await this.dispatch(emailOptions);

        logSendResult(this.logger, result, this.provider.name ?? "unknown");

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
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        this.logger.debug(`Email ${processedCount} sent successfully`, {
                            messageId: result.data.messageId,
                        });
                    }

                    yield {
                        messageId: result.data.messageId,
                        provider: result.data.provider ?? providerName,
                        response: result.data.response,
                        successful: true,
                        timestamp: result.data.timestamp,
                    };
                } else {
                    failureCount += 1;

                    if (this.logger) {
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
     * Sends one message per personalization, built from a shared base message.
     *
     * Each {@link Personalization} overrides recipients/subject/headers on top of the base; when
     * `options.render` is supplied, the base `subject`/`html`/`text` are treated as templates and
     * rendered against each personalization's `data`. Results stream back as {@link Receipt}s, exactly
     * like {@link Mail.sendMany}.
     * @param base The shared base message (MailMessage or EmailOptions). Its `to` is ignored.
     * @param personalizations One entry per outgoing message.
     * @param options Optional renderer and abort signal. See {@link SendBatchOptions}.
     * @returns An async iterable of receipts, one per personalization.
     * @example
     * ```ts
     * import { renderHandlebars } from "@visulima/email/template/handlebars";
     *
     * for await (const receipt of mail.sendBatch(
     *   // `to` is required on EmailOptions but ignored here — each personalization supplies its own.
     *   { from: { email: "a@x.com" }, to: { email: "placeholder@x.com" }, subject: "Hi {{name}}", html: "<p>Hello {{name}}</p>" },
     *   [{ to: { email: "b@x.com" }, data: { name: "Bob" } }],
     *   { render: (tpl, data) => renderHandlebars(tpl, data) },
     * )) { /* ... *\/ }
     * ```
     */
    public sendBatch(base: SendableMessage, personalizations: Personalization[], options?: SendBatchOptions): AsyncIterable<Receipt> {
        const build = async function* (): AsyncIterable<SendableMessage> {
            const baseOptions = base instanceof MailMessage ? await base.build() : base;

            for (const personalization of personalizations) {
                // eslint-disable-next-line no-await-in-loop
                yield await buildPersonalized(baseOptions, personalization, options?.render);
            }
        };

        return this.sendMany(build(), { signal: options?.signal });
    }

    /**
     * Sends the resolved options through the middleware chain (or straight to the provider when no
     * middleware is registered). The composed chain is memoized and rebuilt whenever {@link Mail.use}
     * adds a middleware.
     * @param emailOptions The fully-resolved email options.
     * @returns The send result.
     * @private
     */
    private async dispatch(emailOptions: EmailOptions): Promise<Result<EmailResult>> {
        if (this.middlewares.length === 0) {
            return await this.provider.sendEmail(emailOptions);
        }

        this.composedSend ??= composeMiddleware(this.middlewares, (options) => Promise.resolve(this.provider.sendEmail(options)));

        return await this.composedSend(emailOptions);
    }

    /**
     * Runs the fail-fast capability guard for the configured {@link FeatureCheckMode}.
     * @param emailOptions The fully-resolved email options about to be sent.
     * @returns An {@link EmailError} when the send should be rejected, otherwise undefined.
     * @private
     */
    private assertFeatureSupport(emailOptions: EmailOptions): EmailError | undefined {
        if (this.featureCheck === "off") {
            return undefined;
        }

        const { supported, violations } = checkFeatureSupport(emailOptions, this.provider.features);

        if (supported) {
            return undefined;
        }

        const providerName = this.provider.name ?? "unknown";
        const fields = violations.map((violation) => violation.field);
        const reasons = violations.map((violation) => violation.message);

        if (this.featureCheck === "warn") {
            if (this.logger) {
                this.logger.warn("Message uses capabilities the provider does not support", {
                    fields,
                    provider: providerName,
                });
            }

            return undefined;
        }

        if (this.logger) {
            this.logger.error("Message rejected by capability guard", {
                fields,
                provider: providerName,
            });
        }

        return new EmailError(providerName, `Provider does not support the following message fields: ${fields.join(", ")}`, {
            code: "UNSUPPORTED_FEATURES",
            hint: reasons,
        });
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
    // eslint-disable-next-line @typescript-eslint/require-await
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
 * @param options Optional Mail configuration, e.g. the {@link FeatureCheckMode}.
 * @returns A new Mail instance.
 * @example
 * ```ts
 * const mail = createMail(provider);
 * mail.setFrom({ email: "noreply@example.com", name: "My App" });
 *
 * // Disable the fail-fast capability guard
 * const lenient = createMail(provider, { featureCheck: "off" });
 * ```
 */
export const createMail = (provider: Provider, options?: MailOptions): Mail => new Mail(provider, options);
