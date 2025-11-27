/* eslint-disable max-classes-per-file */
import { basename } from "node:path";

import type { AttachmentDataOptions, AttachmentOptions } from "./attachment-helpers";
import { detectMimeType, generateContentId, readFileAsBuffer } from "./attachment-helpers";
import type { EmailEncrypter, EmailSigner } from "./crypto";
import type { Provider } from "./providers/provider";
import htmlToText from "./template-engines/html-to-text";
import type { TemplateRenderer } from "./template-engines/types";
import type { Attachment, EmailAddress, EmailHeaders, EmailOptions, EmailResult, Priority, Receipt, Result } from "./types";
import type { Logger } from "./utils/create-logger";
import createLogger from "./utils/create-logger";
import headersToRecord from "./utils/headers-to-record";

type AddressInput = EmailAddress | EmailAddress[] | string | string[];

const normalizeAddresses = (address: AddressInput): EmailAddress[] => {
    if (Array.isArray(address)) {
        // eslint-disable-next-line arrow-body-style
        return address.map((addr) => {
            return typeof addr === "string" ? { email: addr } : addr;
        });
    }

    return typeof address === "string" ? [{ email: address }] : [address];
};

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
 * Mailable interface - represents an email that can be sent.
 */
export interface Mailable {
    /**
     * Builds the email message.
     */
    build: () => Promise<EmailOptions>;
}

/**
 * Mail message builder - provides fluent interface for building emails.
 */
export class MailMessage {
    private fromAddress?: EmailAddress;

    private toAddresses: EmailAddress[] = [];

    private ccAddresses: EmailAddress[] = [];

    private bccAddresses: EmailAddress[] = [];

    private subjectText = "";

    private textContent?: string;

    private htmlContent?: string;

    private headers: Record<string, string> = {};

    private attachments: Attachment[] = [];

    private replyToAddress?: EmailAddress;

    private priorityValue?: Priority;

    private tagsValue: string[] = [];

    private provider?: Provider;

    private signer?: EmailSigner;

    private encrypter?: EmailEncrypter;

    private logger?: Logger;

    /**
     * Sets the sender address.
     * @param address The sender email address (string or EmailAddress object).
     * @returns This instance for method chaining.
     */
    public from(address: EmailAddress | string): this {
        this.fromAddress = typeof address === "string" ? { email: address } : address;

        return this;
    }

    /**
     * Sets the recipient address(es).
     * @param address The recipient email address(es) (string, EmailAddress, or arrays of either).
     * @returns This instance for method chaining.
     */
    public to(address: AddressInput): this {
        this.toAddresses.push(...normalizeAddresses(address));

        return this;
    }

    /**
     * Sets the CC recipient address(es).
     * @param address The CC recipient email address(es) (string, EmailAddress, or arrays of either).
     * @returns This instance for method chaining.
     */
    public cc(address: AddressInput): this {
        this.ccAddresses.push(...normalizeAddresses(address));

        return this;
    }

    /**
     * Sets the BCC recipient address(es).
     * @param address The BCC recipient email address(es) (string, EmailAddress, or arrays of either).
     * @returns This instance for method chaining.
     */
    public bcc(address: AddressInput): this {
        this.bccAddresses.push(...normalizeAddresses(address));

        return this;
    }

    /**
     * Sets the subject line for the email message.
     * @param text The subject text to set.
     * @returns This instance for method chaining.
     */
    public subject(text: string): this {
        this.subjectText = text;

        return this;
    }

    /**
     * Sets the plain text content of the email.
     * @param content The plain text content to set.
     * @returns This instance for method chaining.
     */
    public text(content: string): this {
        this.textContent = content;

        return this;
    }

    /**
     * Sets the HTML content of the email.
     * @param content The HTML content to set.
     * @returns This instance for method chaining.
     */
    public html(content: string): this {
        this.htmlContent = content;

        return this;
    }

    /**
     * Sets a custom email header.
     * @param name The header name to set.
     * @param value The header value to set.
     * @returns This instance for method chaining.
     */
    public header(name: string, value: string): this {
        this.headers[name] = value;

        return this;
    }

    /**
     * Sets multiple headers.
     * Accepts both Record&lt;string, string> and ImmutableHeaders.
     * @param headers The headers to set (Record or ImmutableHeaders).
     * @returns This instance for method chaining.
     */
    public setHeaders(headers: EmailHeaders): this {
        const headersRecord = headersToRecord(headers);

        Object.assign(this.headers, headersRecord);

        return this;
    }

    /**
     * Attaches a file from path (reads file from filesystem).
     * Similar to Laravel's attach() method.
     * @param filePath The absolute or relative filesystem path to the file to attach.
     * @param options Optional attachment configuration (filename, contentType, etc.).
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * message.attachFromPath('/path/to/file.pdf')
     * message.attachFromPath('/path/to/file.pdf', { filename: 'custom-name.pdf' })
     * ```
     */
    public async attachFromPath(filePath: string, options?: AttachmentOptions): Promise<this> {
        try {
            const content = await readFileAsBuffer(filePath);
            const filename = options?.filename || basename(filePath) || "attachment";
            const contentType = options?.contentType || detectMimeType(filename);

            this.attachments.push({
                cid: options?.cid,
                content,
                contentDisposition: options?.contentDisposition || "attachment",
                contentType,
                encoding: options?.encoding,
                filename,
                headers: options?.headers,
            });

            if (this.logger) {
                this.logger.debug(`Attachment added from path: ${filePath}`, { contentType, filename });
            }
        } catch (error) {
            if (this.logger) {
                this.logger.error(`Failed to attach file from path: ${filePath}`, error);
            }

            throw error;
        }

        return this;
    }

    /**
     * Attaches raw data (string or Buffer).
     * Similar to Laravel's attachData() method.
     * @param content The content to attach (string or Buffer).
     * @param options Attachment options including filename.
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * message.attachData(Buffer.from('content'), 'file.txt')
     * message.attachData('content', 'file.txt', { contentType: 'text/plain' })
     * ```
     */
    public attachData(content: string | Buffer, options: AttachmentDataOptions): this {
        const contentType = options.contentType || detectMimeType(options.filename);

        this.attachments.push({
            cid: options.cid,
            content,
            contentDisposition: options.contentDisposition || "attachment",
            contentType,
            encoding: options.encoding,
            filename: options.filename,
            headers: options.headers,
        });

        if (this.logger) {
            this.logger.debug("Attachment added from data", { contentType, filename: options.filename });
        }

        return this;
    }

    /**
     * Embeds an inline attachment from file path (for images in HTML).
     * Similar to Laravel's embed() method.
     * Returns the Content-ID that can be used in HTML: &lt;img src="cid:{cid}">.
     * @param filePath The path to the file to embed.
     * @param options Optional attachment options (filename, contentType, etc.).
     * @returns The Content-ID string that can be used in HTML.
     * @example
     * ```ts
     * const cid = await message.embedFromPath('/path/to/logo.png')
     * message.html(`<img src="cid:${cid}">`)
     * ```
     */
    public async embedFromPath(filePath: string, options?: Omit<AttachmentOptions, "contentDisposition" | "cid">): Promise<string> {
        try {
            const content = await readFileAsBuffer(filePath);
            const filename = options?.filename || basename(filePath) || "inline";
            const contentType = options?.contentType || detectMimeType(filename);
            const cid = generateContentId(filename);

            this.attachments.push({
                cid,
                content,
                contentDisposition: "inline",
                contentType,
                filename,
            });

            if (this.logger) {
                this.logger.debug(`Inline attachment embedded from path: ${filePath}`, { cid, contentType, filename });
            }

            return cid;
        } catch (error) {
            if (this.logger) {
                this.logger.error(`Failed to embed file from path: ${filePath}`, error);
            }

            throw error;
        }
    }

    /**
     * Embeds raw data as inline attachment (for images in HTML).
     * Similar to Laravel's embedData() method.
     * Returns the Content-ID that can be used in HTML: &lt;img src="cid:{cid}">.
     * @param content The content to embed (string or Buffer).
     * @param filename The filename for the embedded attachment.
     * @param options Optional attachment options (contentType, etc.).
     * @returns The Content-ID string that can be used in HTML.
     * @example
     * ```ts
     * const imageBuffer = Buffer.from('...')
     * const cid = message.embedData(imageBuffer, 'logo.png', { contentType: 'image/png' })
     * message.html(`<img src="cid:${cid}">`)
     * ```
     */
    public embedData(content: string | Buffer, filename: string, options?: Omit<AttachmentDataOptions, "filename" | "contentDisposition" | "cid">): string {
        const contentType = options?.contentType || detectMimeType(filename);
        const cid = generateContentId(filename);

        this.attachments.push({
            cid,
            content,
            contentDisposition: "inline",
            contentType,
            filename,
        });

        if (this.logger) {
            this.logger.debug("Inline attachment embedded from data", { cid, contentType, filename });
        }

        return cid;
    }

    /**
     * Sets the reply-to address.
     * @param address The reply-to email address (string or EmailAddress object).
     * @returns This instance for method chaining.
     */
    public replyTo(address: EmailAddress | string): this {
        this.replyToAddress = typeof address === "string" ? { email: address } : address;

        return this;
    }

    /**
     * Sets the email priority.
     * @param priority The priority level ('high', 'normal', or 'low').
     * @returns This instance for method chaining.
     */
    public priority(priority: Priority): this {
        this.priorityValue = priority;

        return this;
    }

    /**
     * Sets email tags for categorization.
     * @param tags The tags to set (string or array of strings).
     * @returns This instance for method chaining.
     */
    public tags(tags: string | string[]): this {
        this.tagsValue = Array.isArray(tags) ? tags : [tags];

        return this;
    }

    /**
     * Sets the provider to use for sending.
     * @param provider The email provider instance.
     * @returns This instance for method chaining.
     */
    public mailer(provider: Provider): this {
        this.provider = provider;

        return this;
    }

    /**
     * Signs the email message using a signer (DKIM or S/MIME).
     * @param signer The signer instance to use.
     * @example
     * ```ts
     * import { createDkimSigner } from '@visulima/email/crypto';
     * const signer = createDkimSigner({
     *   domainName: 'example.com',
     *   keySelector: 'default',
     *   privateKey: '-----BEGIN PRIVATE KEY-----...'
     * });
     * message.sign(signer)
     * ```
     */
    public sign(signer: EmailSigner): this {
        this.signer = signer;

        if (this.logger) {
            this.logger.debug("Email signer configured");
        }

        return this;
    }

    /**
     * Encrypts the email message using an encrypter (S/MIME).
     * @param encrypter The encrypter instance to use.
     * @example
     * ```ts
     * import { createSmimeEncrypter } from '@visulima/email/crypto';
     * const encrypter = createSmimeEncrypter({
     *   certificates: '/path/to/certificate.crt'
     * });
     * message.encrypt(encrypter)
     * ```
     */
    public encrypt(encrypter: EmailEncrypter): this {
        this.encrypter = encrypter;

        if (this.logger) {
            this.logger.debug("Email encrypter configured");
        }

        return this;
    }

    /**
     * Sets the logger instance for this message.
     * @param logger The logger instance (Console) to use for logging.
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * message.logger(console)
     * ```
     */
    public setLogger(logger: Console): this {
        this.logger = createLogger("MailMessage", logger);

        return this;
    }

    /**
     * Renders a template and sets as HTML content.
     * Accepts a render function for flexible template engine support.
     * @param render The template renderer function.
     * @param template The template content (string, React component, etc.).
     * @param data Optional data/variables to pass to the template.
     * @param options Optional renderer-specific options.
     * @param options.autoText Whether to auto-generate text version from HTML (default: true).
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * import { renderHandlebars } from '@visulima/email/template/handlebars';
     * message.view(renderHandlebars, '<h1>Hello {{name}}!</h1>', { name: 'John' })
     *
     * import { renderMjml } from '@visulima/email/template/mjml';
     * message.view(renderMjml, mjmlTemplate)
     *
     * import { renderReactEmail } from '@visulima/email/template/react-email';
     * message.view(renderReactEmail, <WelcomeEmail name="John" />)
     * ```
     */
    public async view(
        render: TemplateRenderer,
        template: unknown,
        data?: Record<string, unknown>,
        options?: { [key: string]: unknown; autoText?: boolean },
    ): Promise<this> {
        try {
            if (this.logger) {
                this.logger.debug("Rendering template", { autoText: options?.autoText !== false });
            }

            const html = await render(template, data, options);

            this.html(html);

            if (options?.autoText !== false && html) {
                this.tryAutoGenerateText(html);
            }

            if (this.logger) {
                this.logger.debug("Template rendered successfully");
            }
        } catch (error) {
            if (this.logger) {
                this.logger.error("Failed to render template", error);
            }

            throw new Error(`Failed to render template: ${(error as Error).message}`);
        }

        return this;
    }

    /**
     * Renders a text template and sets as text content.
     * @param render The template renderer function.
     * @param template The text template content.
     * @param data Optional data/variables to pass to the template.
     * @param options Optional renderer-specific options.
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * import { renderHandlebars } from '@visulima/email/template/handlebars';
     * message.viewText(renderHandlebars, 'Hello {{name}}!', { name: 'John' })
     * ```
     */
    public async viewText(render: TemplateRenderer, template: string, data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<this> {
        try {
            if (this.logger) {
                this.logger.debug("Rendering text template");
            }

            const text = await render(template, data, options);

            if (typeof text === "string") {
                this.text(text);

                if (this.logger) {
                    this.logger.debug("Text template rendered successfully");
                }
            } else {
                throw new TypeError("Text renderer must return a string");
            }
        } catch (error) {
            if (this.logger) {
                this.logger.error("Failed to render text template", error);
            }

            throw new Error(`Failed to render text template: ${(error as Error).message}`);
        }

        return this;
    }

    /**
     * Builds the email options.
     * @returns The built email options ready for sending.
     * @throws {Error} When required fields (from, to, subject, content) are missing.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async build(): Promise<EmailOptions> {
        if (this.logger) {
            this.logger.debug("Building email message");
        }

        if (!this.fromAddress) {
            this.throwAndLogError("From address is required", "Build failed: from address is required");
        }

        if (this.toAddresses.length === 0) {
            this.throwAndLogError("At least one recipient is required", "Build failed: at least one recipient is required");
        }

        if (!this.subjectText) {
            this.throwAndLogError("Subject is required", "Build failed: subject is required");
        }

        if (this.htmlContent && !this.textContent) {
            try {
                this.textContent = htmlToText(this.htmlContent);

                if (this.logger) {
                    this.logger.debug("Auto-generated text content from HTML");
                }
            } catch {
                if (this.logger) {
                    this.logger.debug("Failed to convert HTML to text; proceeding without text content.");
                }
            }
        }

        if (!this.textContent && !this.htmlContent) {
            this.throwAndLogError("Either text or html content is required", "Build failed: either text or html content is required");
        }

        let emailOptions: EmailOptions = {
            from: this.fromAddress,
            html: this.htmlContent,
            subject: this.subjectText,
            text: this.textContent,
            to: this.toAddresses.length === 1 ? (this.toAddresses[0] as EmailAddress) : this.toAddresses,
        };

        if (this.ccAddresses.length > 0) {
            emailOptions.cc = this.ccAddresses.length === 1 ? this.ccAddresses[0] : this.ccAddresses;
        }

        if (this.bccAddresses.length > 0) {
            emailOptions.bcc = this.bccAddresses.length === 1 ? this.bccAddresses[0] : this.bccAddresses;
        }

        if (Object.keys(this.headers).length > 0) {
            emailOptions.headers = this.headers;
        }

        if (this.attachments.length > 0) {
            emailOptions.attachments = this.attachments;

            if (this.logger) {
                this.logger.debug(`Email includes ${this.attachments.length} attachment(s)`);
            }
        }

        if (this.replyToAddress) {
            emailOptions.replyTo = this.replyToAddress;
        }

        if (this.priorityValue) {
            emailOptions.priority = this.priorityValue;
        }

        if (this.tagsValue.length > 0) {
            emailOptions.tags = this.tagsValue;
        }

        if (this.signer) {
            if (this.logger) {
                this.logger.debug("Signing email message");
            }

            emailOptions = await this.signer.sign(emailOptions);

            if (this.logger) {
                this.logger.debug("Email message signed successfully");
            }
        }

        if (this.encrypter) {
            if (this.logger) {
                this.logger.debug("Encrypting email message");
            }

            emailOptions = await this.encrypter.encrypt(emailOptions);

            if (this.logger) {
                this.logger.debug("Email message encrypted successfully");
            }
        }

        if (this.logger) {
            this.logger.debug("Email message built successfully", {
                bcc: this.bccAddresses.length,
                cc: this.ccAddresses.length,
                hasHtml: !!this.htmlContent,
                hasText: !!this.textContent,
                to: this.toAddresses.length,
            });
        }

        return emailOptions;
    }

    /**
     * Sends the email.
     * @returns A result object containing the email result or error.
     * @throws {Error} When no provider is configured.
     */
    public async send(): Promise<Result<EmailResult>> {
        if (!this.provider) {
            this.throwAndLogError("No provider configured. Use mailer() method to set a provider.", "Send failed: no provider configured");
        }

        if (this.logger) {
            this.logger.debug("Sending email", { subject: this.subjectText, to: this.toAddresses.length });
        }

        const emailOptions = await this.build();
        const result = await this.provider.sendEmail(emailOptions);

        logSendResult(this.logger, result, this.provider.name || "unknown");

        return result;
    }

    /**
     * Attempts to auto-generate text content from HTML.
     * @param html The HTML content to convert.
     * @private
     */
    private tryAutoGenerateText(html: string): void {
        try {
            const text = htmlToText(html);

            if (text && !this.textContent) {
                this.text(text);
            }

            if (this.logger) {
                this.logger.debug("Auto-generated text content from HTML template");
            }
        } catch (error) {
            if (this.logger) {
                this.logger.warn("Failed to auto-generate text from HTML template", error);
            }
        }
    }

    /**
     * Creates an error, logs it, and throws it.
     * @param message Error message to throw.
     * @param logMessage Optional log message (defaults to message).
     * @private
     */
    private throwAndLogError(message: string, logMessage?: string): never {
        const error = new Error(message);

        if (this.logger) {
            this.logger.error(logMessage || message);
        }

        throw error;
    }
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

    /**
     * Creates a new Mail instance with a provider.
     * @param provider The email provider instance.
     */
    public constructor(provider: Provider) {
        this.provider = provider;
    }

    /**
     * Sets the logger instance for this mail instance.
     * The logger will be passed to all MailMessage instances created via message().
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
     * Creates a new mail message.
     * @returns A new MailMessage instance configured with this provider.
     */
    public message(): MailMessage {
        if (this.logger) {
            this.logger.debug("Creating new mail message");
        }

        const message = new MailMessage();

        message.mailer(this.provider);

        if (this.loggerInstance) {
            message.setLogger(this.loggerInstance);
        }

        return message;
    }

    /**
     * Sends a mailable instance.
     * @param mailable The mailable instance to send.
     * @returns A result object containing the email result or error.
     */
    public async send(mailable: Mailable): Promise<Result<EmailResult>> {
        if (this.logger) {
            this.logger.debug("Sending mailable instance");
        }

        const emailOptions = await mailable.build();
        const result = await this.provider.sendEmail(emailOptions);

        logSendResult(this.logger, result, this.provider.name || "unknown");

        return result;
    }

    /**
     * Sends email using email options directly.
     * @param options The email options to send.
     * @returns A result object containing the email result or error.
     */
    public async sendEmail(options: EmailOptions): Promise<Result<EmailResult>> {
        if (this.logger) {
            this.logger.debug("Sending email with options", {
                subject: options.subject,
                to: Array.isArray(options.to) ? options.to.length : 1,
            });
        }

        const result = await this.provider.sendEmail(options);

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
     * @param messages An iterable of email options or mailables to send.
     * @param options Optional parameters for sending.
     * @param options.signal Abort signal to cancel the operation.
     * @returns An async iterable that yields receipts for each sent message.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async* sendMany(
        messages: Iterable<EmailOptions | Mailable> | AsyncIterable<EmailOptions | Mailable>,
        options?: { signal?: AbortSignal },
    ): AsyncIterable<Receipt> {
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
                const emailOptions: EmailOptions
                    = "build" in message && typeof message.build === "function" ? await (message as Mailable).build() : (message as EmailOptions);

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
