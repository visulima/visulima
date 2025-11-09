import type { Attachment, EmailAddress, EmailOptions, EmailResult, Result } from "./types.js";
import type { Provider } from "./providers/provider.js";
import { basename } from "node:path";
import {
    type AttachmentDataOptions,
    type AttachmentOptions,
    detectMimeType,
    generateContentId,
    readFileAsBuffer,
} from "./attachment-helpers.js";
import {
    htmlToText,
    renderHandlebars,
    renderMjml,
    renderReactEmail,
    type TemplateEngine,
} from "./template-engines/index.js";

/**
 * Mailable interface - represents an email that can be sent
 */
export interface Mailable {
    /**
     * Build the email message
     */
    build(): EmailOptions | Promise<EmailOptions>;
}

/**
 * Normalize email address(es) to EmailAddress array
 */
const normalizeAddresses = (
    address: EmailAddress | EmailAddress[] | string | string[],
): EmailAddress[] => {
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
    private provider?: Provider;

    /**
     * Set the sender address
     */
    from(address: EmailAddress | string): this {
        if (typeof address === "string") {
            this.fromAddress = { email: address };
        } else {
            this.fromAddress = address;
        }
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
     */
    setHeaders(headers: Record<string, string>): this {
        Object.assign(this.headers, headers);
        return this;
    }

    /**
     * Attach a file from path (reads file from filesystem)
     * Similar to Laravel's attach() method
     *
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
            filename,
            content,
            contentType,
            contentDisposition: options?.contentDisposition || "attachment",
            cid: options?.cid,
            encoding: options?.encoding,
            headers: options?.headers,
        });

        return this;
    }

    /**
     * Attach raw data (string or Buffer)
     * Similar to Laravel's attachData() method
     *
     * @example
     * ```ts
     * message.attachData(Buffer.from('content'), 'file.txt')
     * message.attachData('content', 'file.txt', { contentType: 'text/plain' })
     * ```
     */
    attachData(content: string | Buffer, options: AttachmentDataOptions): this {
        const contentType = options.contentType || detectMimeType(options.filename);

        this.attachments.push({
            filename: options.filename,
            content,
            contentType,
            contentDisposition: options.contentDisposition || "attachment",
            cid: options.cid,
            encoding: options.encoding,
            headers: options.headers,
        });

        return this;
    }

    /**
     * Embed an inline attachment from file path (for images in HTML)
     * Similar to Laravel's embed() method
     * Returns the Content-ID that can be used in HTML: <img src="cid:{cid}">
     *
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
            filename,
            content,
            contentType,
            contentDisposition: "inline",
            cid,
        });

        return cid;
    }

    /**
     * Embed raw data as inline attachment (for images in HTML)
     * Similar to Laravel's embedData() method
     * Returns the Content-ID that can be used in HTML: <img src="cid:{cid}">
     *
     * @example
     * ```ts
     * const imageBuffer = Buffer.from('...')
     * const cid = message.embedData(imageBuffer, 'logo.png', { contentType: 'image/png' })
     * message.html(`<img src="cid:${cid}">`)
     * ```
     */
    embedData(
        content: string | Buffer,
        filename: string,
        options?: Omit<AttachmentDataOptions, "filename" | "contentDisposition" | "cid">,
    ): string {
        const contentType = options?.contentType || detectMimeType(filename);
        const cid = generateContentId(filename);

        this.attachments.push({
            filename,
            content,
            contentType,
            contentDisposition: "inline",
            cid,
        });

        return cid;
    }

    /**
     * Set the reply-to address
     */
    replyTo(address: EmailAddress | string): this {
        if (typeof address === "string") {
            this.replyToAddress = { email: address };
        } else {
            this.replyToAddress = address;
        }
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
     * Supports React Email, Handlebars, MJML, and plain HTML
     *
     * @example
     * ```ts
     * // Handlebars
     * message.view('welcome', { name: 'John' }, { engine: 'handlebars' })
     *
     * // MJML
     * message.view(mjmlTemplate, { name: 'John' }, { engine: 'mjml' })
     *
     * // React Email
     * message.view(<WelcomeEmail name="John" />, {}, { engine: 'react-email' })
     * ```
     */
    async view(
        template: string | unknown,
        data?: Record<string, unknown>,
        options?: { engine?: TemplateEngine; autoText?: boolean; [key: string]: unknown },
    ): Promise<this> {
        const engine = options?.engine || "html";
        let html: string;

        try {
            switch (engine) {
                case "react-email": {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    html = await renderReactEmail(template as any, {
                        plainText: options?.plainText as boolean | undefined,
                        pretty: options?.pretty as boolean | undefined,
                    });
                    break;
                }
                case "handlebars": {
                    if (typeof template !== "string") {
                        throw new Error("Handlebars template must be a string");
                    }
                    html = renderHandlebars(template, data, options as Record<string, unknown>);
                    break;
                }
                case "mjml": {
                    if (typeof template !== "string") {
                        throw new Error("MJML template must be a string");
                    }
                    html = renderMjml(template, {
                        fonts: options?.fonts as Record<string, string> | undefined,
                        keepComments: options?.keepComments as boolean | undefined,
                        beautify: options?.beautify as boolean | undefined,
                        minify: options?.minify as boolean | undefined,
                        validationLevel: options?.validationLevel as "strict" | "soft" | "skip" | undefined,
                    });
                    break;
                }
                case "html":
                default: {
                    if (typeof template !== "string") {
                        throw new Error("HTML template must be a string");
                    }
                    // If data is provided, treat as Handlebars template
                    if (data && Object.keys(data).length > 0) {
                        html = renderHandlebars(template, data, options as Record<string, unknown>);
                    } else {
                        html = template;
                    }
                    break;
                }
            }

            this.html(html);

            // Auto-generate text from HTML if requested
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
            throw new Error(`Failed to render ${engine} template: ${(error as Error).message}`);
        }

        return this;
    }

    /**
     * Render a text template and set as text content
     * Supports Handlebars for text templates
     *
     * @example
     * ```ts
     * message.viewText('Hello {{name}}!', { name: 'John' }, { engine: 'handlebars' })
     * ```
     */
    viewText(
        template: string,
        data?: Record<string, unknown>,
        options?: { engine?: TemplateEngine; [key: string]: unknown },
    ): this {
        const engine = options?.engine || "html";

        try {
            switch (engine) {
                case "handlebars": {
                    const text = renderHandlebars(template, data, options as Record<string, unknown>);
                    this.text(text);
                    break;
                }
                case "html":
                default: {
                    // If data is provided, treat as Handlebars template
                    if (data && Object.keys(data).length > 0) {
                        const text = renderHandlebars(template, data, options as Record<string, unknown>);
                        this.text(text);
                    } else {
                        this.text(template);
                    }
                    break;
                }
            }
        } catch (error) {
            throw new Error(`Failed to render ${engine} text template: ${(error as Error).message}`);
        }

        return this;
    }

    /**
     * Build the email options
     */
    build(): EmailOptions {
        if (!this.fromAddress) {
            throw new Error("From address is required");
        }
        if (this.toAddresses.length === 0) {
            throw new Error("At least one recipient is required");
        }
        if (!this.subjectText) {
            throw new Error("Subject is required");
        }
        // Auto-generate text from HTML if HTML exists but text doesn't
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
            to: this.toAddresses.length === 1 ? this.toAddresses[0] : this.toAddresses,
            subject: this.subjectText,
            text: this.textContent,
            html: this.htmlContent,
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

        return emailOptions;
    }

    /**
     * Send the email
     */
    async send(): Promise<Result<EmailResult>> {
        if (!this.provider) {
            throw new Error("No provider configured. Use mailer() method to set a provider.");
        }

        const emailOptions = this.build();
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
}

/**
 * Create a new Mail instance with a provider
 */
export const createMail = (provider: Provider): Mail => {
    return new Mail(provider);
};
