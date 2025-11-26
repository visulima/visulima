/* eslint-disable max-classes-per-file */
import { basename } from "node:path";

import type { AttachmentDataOptions, AttachmentOptions } from "./attachment-helpers";
import { detectMimeType, generateContentId, readFileAsBuffer } from "./attachment-helpers";
import type { EmailEncrypter, EmailSigner } from "./crypto";
import type { Provider } from "./providers/provider";
import htmlToText from "./template-engines/html-to-text";
import type { TemplateRenderer } from "./template-engines/types";
import type { Attachment, EmailAddress, EmailHeaders, EmailOptions, EmailResult, Priority, Receipt, Result } from "./types";
import headersToRecord from "./utils/headers-to-record";

/**
 * Normalizes email address(es) to EmailAddress array.
 * @param address The email address(es) to normalize (can be string, EmailAddress, or arrays of either).
 * @returns Array of EmailAddress objects.
 */
const normalizeAddresses = (address: EmailAddress | EmailAddress[] | string | string[]): EmailAddress[] => {
    if (Array.isArray(address)) {
        return address.map((addr) => typeof addr === "string" ? { email: addr } : addr);
    }

    return typeof address === "string" ? [{ email: address }] : [address];
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

    /**
     * Sets the sender address.
     * @param address The sender email address (string or EmailAddress object).
     * @returns This instance for method chaining.
     */
    from(address: EmailAddress | string): this {
        this.fromAddress = typeof address === "string" ? { email: address } : address;

        return this;
    }

    /**
     * Sets the recipient address(es).
     * @param address The recipient email address(es) (string, EmailAddress, or arrays of either).
     * @returns This instance for method chaining.
     */
    to(address: EmailAddress | EmailAddress[] | string | string[]): this {
        this.toAddresses.push(...normalizeAddresses(address));

        return this;
    }

    /**
     * Sets the CC recipient address(es).
     * @param address The CC recipient email address(es) (string, EmailAddress, or arrays of either).
     * @returns This instance for method chaining.
     */
    cc(address: EmailAddress | EmailAddress[] | string | string[]): this {
        this.ccAddresses.push(...normalizeAddresses(address));

        return this;
    }

    /**
     * Sets the BCC recipient address(es).
     * @param address The BCC recipient email address(es) (string, EmailAddress, or arrays of either).
     * @returns This instance for method chaining.
     */
    bcc(address: EmailAddress | EmailAddress[] | string | string[]): this {
        this.bccAddresses.push(...normalizeAddresses(address));

        return this;
    }

    /**
     * Sets the email subject.
     * @param text The subject text.
     * @returns This instance for method chaining.
     */
    subject(text: string): this {
        this.subjectText = text;

        return this;
    }

    /**
     * Sets the plain text content.
     * @param content The plain text content.
     * @returns This instance for method chaining.
     */
    text(content: string): this {
        this.textContent = content;

        return this;
    }

    /**
     * Sets the HTML content.
     * @param content The HTML content.
     * @returns This instance for method chaining.
     */
    html(content: string): this {
        this.htmlContent = content;

        return this;
    }

    /**
     * Sets a custom header.
     * @param name The header name.
     * @param value The header value.
     * @returns This instance for method chaining.
     */
    header(name: string, value: string): this {
        this.headers[name] = value;

        return this;
    }

    /**
     * Sets multiple headers.
     * Accepts both Record&lt;string, string> and ImmutableHeaders.
     * @param headers The headers to set (Record or ImmutableHeaders).
     * @returns This instance for method chaining.
     */
    setHeaders(headers: EmailHeaders): this {
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
    async attachFromPath(filePath: string, options?: AttachmentOptions): Promise<this> {
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
    attachData(content: string | Buffer, options: AttachmentDataOptions): this {
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
    async embedFromPath(filePath: string, options?: Omit<AttachmentOptions, "contentDisposition" | "cid">): Promise<string> {
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

        return cid;
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
    embedData(content: string | Buffer, filename: string, options?: Omit<AttachmentDataOptions, "filename" | "contentDisposition" | "cid">): string {
        const contentType = options?.contentType || detectMimeType(filename);
        const cid = generateContentId(filename);

        this.attachments.push({
            cid,
            content,
            contentDisposition: "inline",
            contentType,
            filename,
        });

        return cid;
    }

    /**
     * Sets the reply-to address.
     * @param address The reply-to email address (string or EmailAddress object).
     * @returns This instance for method chaining.
     */
    replyTo(address: EmailAddress | string): this {
        this.replyToAddress = typeof address === "string" ? { email: address } : address;

        return this;
    }

    /**
     * Sets the email priority.
     * @param priority The priority level ('high', 'normal', or 'low').
     * @returns This instance for method chaining.
     */
    priority(priority: Priority): this {
        this.priorityValue = priority;

        return this;
    }

    /**
     * Sets email tags for categorization.
     * @param tags The tags to set (string or array of strings).
     * @returns This instance for method chaining.
     */
    tags(tags: string | string[]): this {
        this.tagsValue = Array.isArray(tags) ? tags : [tags];

        return this;
    }

    /**
     * Sets the provider to use for sending.
     * @param provider The email provider instance.
     * @returns This instance for method chaining.
     */
    mailer(provider: Provider): this {
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
    sign(signer: EmailSigner): this {
        this.signer = signer;

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
    encrypt(encrypter: EmailEncrypter): this {
        this.encrypter = encrypter;

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
    async view(
        render: TemplateRenderer,
        template: unknown,
        data?: Record<string, unknown>,
        options?: { [key: string]: unknown; autoText?: boolean },
    ): Promise<this> {
        try {
            const html = await render(template, data, options);

            this.html(html);

            if (options?.autoText !== false && html) {
                try {
                    const text = htmlToText(html);

                    if (text && !this.textContent) {
                        this.text(text);
                    }
                } catch {
                    // Ignore errors in text conversion
                }
            }
        } catch (error) {
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
    async viewText(render: TemplateRenderer, template: string, data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<this> {
        try {
            const text = await render(template, data, options);

            if (typeof text === "string") {
                this.text(text);
            } else {
                throw new TypeError("Text renderer must return a string");
            }
        } catch (error) {
            throw new Error(`Failed to render text template: ${(error as Error).message}`);
        }

        return this;
    }

    /**
     * Builds the email options.
     * @returns The built email options ready for sending.
     * @throws {Error} When required fields (from, to, subject, content) are missing.
     */
    async build(): Promise<EmailOptions> {
        if (!this.fromAddress) {
            throw new Error("From address is required");
        }

        if (this.toAddresses.length === 0) {
            throw new Error("At least one recipient is required");
        }

        if (!this.subjectText) {
            throw new Error("Subject is required");
        }

        if (this.htmlContent && !this.textContent) {
            try {
                this.textContent = htmlToText(this.htmlContent);
            } catch {
                // Ignore errors in text conversion
            }
        }

        if (!this.textContent && !this.htmlContent) {
            throw new Error("Either text or html content is required");
        }

        let emailOptions: EmailOptions = {
            from: this.fromAddress,
            html: this.htmlContent,
            subject: this.subjectText,
            text: this.textContent,
            to: this.toAddresses.length === 1 ? this.toAddresses[0] : this.toAddresses,
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

        // Apply signing before encryption (sign then encrypt)
        if (this.signer) {
            emailOptions = await this.signer.sign(emailOptions);
        }

        // Apply encryption (encrypts the signed message if signing was applied)
        if (this.encrypter) {
            emailOptions = await this.encrypter.encrypt(emailOptions);
        }

        return emailOptions;
    }

    /**
     * Sends the email.
     * @returns A result object containing the email result or error.
     * @throws {Error} When no provider is configured.
     */
    async send(): Promise<Result<EmailResult>> {
        if (!this.provider) {
            throw new Error("No provider configured. Use mailer() method to set a provider.");
        }

        const emailOptions = await this.build();

        return this.provider.sendEmail(emailOptions);
    }
}

/**
 * Mail class - instance-based email sending.
 */
export class Mail {
    private provider: Provider;

    /**
     * Creates a new Mail instance with a provider.
     * @param provider The email provider instance.
     */
    constructor(provider: Provider) {
        this.provider = provider;
    }

    /**
     * Creates a new mail message.
     * @returns A new MailMessage instance configured with this provider.
     */
    message(): MailMessage {
        const message = new MailMessage();

        message.mailer(this.provider);

        return message;
    }

    /**
     * Sends a mailable instance.
     * @param mailable The mailable instance to send.
     * @returns A result object containing the email result or error.
     */
    async send(mailable: Mailable): Promise<Result<EmailResult>> {
        const emailOptions = await mailable.build();

        return this.provider.sendEmail(emailOptions);
    }

    /**
     * Sends email using email options directly.
     * @param options The email options to send.
     * @returns A result object containing the email result or error.
     */
    async sendEmail(options: EmailOptions): Promise<Result<EmailResult>> {
        return this.provider.sendEmail(options);
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
    async* sendMany(
        messages: Iterable<EmailOptions | Mailable> | AsyncIterable<EmailOptions | Mailable>,
        options?: { signal?: AbortSignal },
    ): AsyncIterable<Receipt> {
        const providerName = this.provider.name;

        for await (const message of messages) {
            // Check for abort signal
            if (options?.signal?.aborted) {
                yield {
                    errorMessages: ["Send operation was aborted"],
                    provider: providerName,
                    successful: false,
                };

                return;
            }

            try {
                // Convert mailable to email options if needed
                const emailOptions: EmailOptions = "build" in message && typeof message.build === "function" ? await message.build() : message;

                // Send the email
                const result = await this.provider.sendEmail(emailOptions);

                if (result.success && result.data) {
                    yield {
                        messageId: result.data.messageId,
                        provider: result.data.provider || providerName,
                        response: result.data.response,
                        successful: true,
                        timestamp: result.data.timestamp,
                    };
                } else {
                    const errorMessages = result.error instanceof Error ? [result.error.message] : [String(result.error || "Unknown error")];

                    yield {
                        errorMessages,
                        provider: providerName,
                        successful: false,
                    };
                }
            } catch (error) {
                const errorMessages = error instanceof Error ? [error.message] : [String(error)];

                yield {
                    errorMessages,
                    provider: providerName,
                    successful: false,
                };
            }
        }
    }
}

/**
 * Creates a new Mail instance with a provider.
 * @param provider The email provider instance.
 * @returns A new Mail instance.
 */
export const createMail = (provider: Provider): Mail => new Mail(provider);
