import { basename } from "node:path";

import type { AttachmentDataOptions, AttachmentOptions } from "./attachment-helpers";
import { detectMimeType, generateContentId, readFileAsBuffer } from "./attachment-helpers";
import type { Provider } from "./providers/provider";
import { htmlToText } from "./template-engines/html-to-text";
import type { TemplateRenderer } from "./template-engines/types";
import type { Attachment, EmailAddress, EmailHeaders, EmailOptions, EmailResult, Priority, Receipt, Result } from "./types";
import { headersToRecord } from "./utils";

/**
 * Mailable interface - represents an email that can be sent
 */
export interface Mailable {
    /**
     * Build the email message
     */
    build: () => Promise<EmailOptions>;
}

/**
 * Normalize email address(es) to EmailAddress array
 */
const normalizeAddresses = (address: EmailAddress | EmailAddress[] | string | string[]): EmailAddress[] => {
    if (Array.isArray(address)) {
        return address.map((addr) => (typeof addr === "string" ? { email: addr } : addr));
    }

    return typeof address === "string" ? [{ email: address }] : [address];
};

/**
 * Mail message builder - provides fluent interface for building emails
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

    /**
     * Set the sender address
     */
    from(address: EmailAddress | string): this {
        this.fromAddress = typeof address === "string" ? { email: address } : address;

        return this;
    }

    /**
     * Set the recipient address(es)
     */
    to(address: EmailAddress | EmailAddress[] | string | string[]): this {
        this.toAddresses.push(...normalizeAddresses(address));

        return this;
    }

    /**
     * Set the CC recipient address(es)
     */
    cc(address: EmailAddress | EmailAddress[] | string | string[]): this {
        this.ccAddresses.push(...normalizeAddresses(address));

        return this;
    }

    /**
     * Set the BCC recipient address(es)
     */
    bcc(address: EmailAddress | EmailAddress[] | string | string[]): this {
        this.bccAddresses.push(...normalizeAddresses(address));

        return this;
    }

    /**
     * Set the email subject
     */
    subject(text: string): this {
        this.subjectText = text;

        return this;
    }

    /**
     * Set the plain text content
     */
    text(content: string): this {
        this.textContent = content;

        return this;
    }

    /**
     * Set the HTML content
     */
    html(content: string): this {
        this.htmlContent = content;

        return this;
    }

    /**
     * Set a custom header
     */
    header(name: string, value: string): this {
        this.headers[name] = value;

        return this;
    }

    /**
     * Set multiple headers
     * Accepts both Record<string, string> and ImmutableHeaders
     */
    setHeaders(headers: EmailHeaders): this {
        const headersRecord = headersToRecord(headers);

        Object.assign(this.headers, headersRecord);

        return this;
    }

    /**
     * Attach a file from path (reads file from filesystem)
     * Similar to Laravel's attach() method
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
     * Attach raw data (string or Buffer)
     * Similar to Laravel's attachData() method
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
     * Embed an inline attachment from file path (for images in HTML)
     * Similar to Laravel's embed() method
     * Returns the Content-ID that can be used in HTML: &lt;img src="cid:{cid}">
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
     * Embed raw data as inline attachment (for images in HTML)
     * Similar to Laravel's embedData() method
     * Returns the Content-ID that can be used in HTML: &lt;img src="cid:{cid}">
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
     * Set the reply-to address
     */
    replyTo(address: EmailAddress | string): this {
        this.replyToAddress = typeof address === "string" ? { email: address } : address;

        return this;
    }

    /**
     * Set the email priority
     */
    priority(priority: Priority): this {
        this.priorityValue = priority;

        return this;
    }

    /**
     * Set email tags
     */
    tags(tags: string | string[]): this {
        this.tagsValue = Array.isArray(tags) ? tags : [tags];

        return this;
    }

    /**
     * Set the provider to use for sending
     */
    mailer(provider: Provider): this {
        this.provider = provider;

        return this;
    }

    /**
     * Render a template and set as HTML content
     * Accepts a render function for flexible template engine support
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
     * Render a text template and set as text content
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
     * Build the email options
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

        const emailOptions: EmailOptions = {
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

        return emailOptions;
    }

    /**
     * Send the email
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
 * Mail class - instance-based email sending
 */
export class Mail {
    private provider: Provider;

    /**
     * Create a new Mail instance with a provider
     */
    constructor(provider: Provider) {
        this.provider = provider;
    }

    /**
     * Create a new mail message
     */
    message(): MailMessage {
        const message = new MailMessage();

        message.mailer(this.provider);

        return message;
    }

    /**
     * Send a mailable instance
     */
    async send(mailable: Mailable): Promise<Result<EmailResult>> {
        const emailOptions = await mailable.build();

        return this.provider.sendEmail(emailOptions);
    }

    /**
     * Send email using email options directly
     */
    async sendEmail(options: EmailOptions): Promise<Result<EmailResult>> {
        return this.provider.sendEmail(options);
    }

    /**
     * Sends multiple messages using the email service.
     * Returns an async iterable that yields receipts for each sent message.
     *
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
     *
     * @param messages - An iterable of email options or mailables to send
     * @param options - Optional parameters for sending (e.g., abort signal)
     * @returns An async iterable that yields receipts for each sent message
     */
    async *sendMany(
        messages: Iterable<EmailOptions | Mailable> | AsyncIterable<EmailOptions | Mailable>,
        options?: { signal?: AbortSignal },
    ): AsyncIterable<Receipt> {
        const providerName = this.provider.name;

        for await (const message of messages) {
            // Check for abort signal
            if (options?.signal?.aborted) {
                yield {
                    successful: false,
                    errorMessages: ["Send operation was aborted"],
                    provider: providerName,
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
                        successful: true,
                        messageId: result.data.messageId,
                        provider: result.data.provider || providerName,
                        response: result.data.response,
                        timestamp: result.data.timestamp,
                    };
                } else {
                    const errorMessages = result.error instanceof Error ? [result.error.message] : [String(result.error || "Unknown error")];

                    yield {
                        successful: false,
                        errorMessages,
                        provider: providerName,
                    };
                }
            } catch (error) {
                const errorMessages = error instanceof Error ? [error.message] : [String(error)];

                yield {
                    successful: false,
                    errorMessages,
                    provider: providerName,
                };
            }
        }
    }
}

/**
 * Create a new Mail instance with a provider
 */
export const createMail = (provider: Provider): Mail => new Mail(provider);
