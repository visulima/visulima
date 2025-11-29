import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import type { ICalCalendar } from "ical-generator";
import ical from "ical-generator";

import type { AttachmentDataOptions, AttachmentOptions } from "./attachment-helpers";
import { detectMimeType, generateContentId, readFileAsBuffer } from "./attachment-helpers";
import type { EmailEncrypter, EmailSigner } from "./crypto";
import htmlToText from "./template-engines/html-to-text";
import type { TemplateRenderer } from "./template-engines/types";
import type { Attachment, CalendarEventOptions, EmailAddress, EmailHeaders, EmailOptions, Priority } from "./types";
import type { Logger } from "./utils/create-logger";
import { createLogger } from "./utils/create-logger";
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
 * Mail message builder - provides fluent interface for building emails.
 */
export class MailMessage {
    private fromAddress?: EmailAddress;

    private toAddresses: EmailAddress[] = [];

    private ccAddresses: EmailAddress[] = [];

    private bccAddresses: EmailAddress[] = [];

    private subjectText = "";

    private textContent?: string;

    // Controls whether text should be auto-generated from HTML.
    private autoTextEnabled = true;

    private htmlContent?: string;

    private headers: Record<string, string> = {};

    private attachments: Attachment[] = [];

    private replyToAddress?: EmailAddress;

    private priorityValue?: Priority;

    private tagsValue: string[] = [];

    private signer?: EmailSigner;

    private encrypter?: EmailEncrypter;

    private logger?: Logger;

    private icalEventData?: CalendarEventOptions & { content?: string; href?: string; path?: string };

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
     * Attach a calendar event and define contents as string or function.
     * @param contents The calendar content as a string or a function that receives an ICalCalendar instance.
     * @param options Optional calendar event options (method, alternativeText).
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * message.icalEvent((calendar) => {
     *   calendar.createEvent({
     *     start: new Date(),
     *     summary: 'Meeting'
     *   });
     * })
     * message.icalEvent('BEGIN:VCALENDAR...')
     * ```
     */
    public icalEvent(contents: ((calendar: ICalCalendar) => void) | string, options?: CalendarEventOptions): this {
        if (typeof contents === "function") {
            const calendar = ical();

            contents(calendar);

            this.icalEventData = { content: calendar.toString(), ...options };
        } else {
            this.icalEventData = { content: contents, ...options };
        }

        if (this.logger) {
            this.logger.debug("Calendar event attached", { method: options?.method });
        }

        return this;
    }

    /**
     * Attach a calendar event and load contents from a file.
     * @param file The file path (string or URL) to load the calendar event from.
     * @param options Optional calendar event options (method, alternativeText).
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * message.icalEventFromFile('/path/to/event.ics')
     * message.icalEventFromFile(new URL('file:///path/to/event.ics'))
     * ```
     */
    public icalEventFromFile(file: string | URL, options?: CalendarEventOptions): this {
        const filePath = typeof file === "string" ? file : fileURLToPath(file);

        this.icalEventData = { path: filePath, ...options };

        if (this.logger) {
            this.logger.debug(`Calendar event attached from file: ${filePath}`, { method: options?.method });
        }

        return this;
    }

    /**
     * Attach a calendar event and load contents from a URL.
     * @param url The URL to fetch the calendar event from.
     * @param options Optional calendar event options (method, alternativeText).
     * @returns This instance for method chaining.
     * @example
     * ```ts
     * message.icalEventFromUrl('https://example.com/event.ics')
     * ```
     */
    public icalEventFromUrl(url: string, options?: CalendarEventOptions): this {
        this.icalEventData = { href: url, ...options };

        if (this.logger) {
            this.logger.debug(`Calendar event attached from URL: ${url}`, { method: options?.method });
        }

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
            const autoTextEnabled = options?.autoText !== false;

            this.autoTextEnabled = autoTextEnabled;

            if (this.logger) {
                this.logger.debug("Rendering template", { autoText: autoTextEnabled });
            }

            const html = await render(template, data, options);

            this.html(html);

            if (autoTextEnabled && html) {
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

        if (this.htmlContent && !this.textContent && this.autoTextEnabled) {
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

        if (this.icalEventData) {
            emailOptions.icalEvent = this.icalEventData;

            if (this.logger) {
                this.logger.debug("Email includes calendar event");
            }
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

export default MailMessage;
