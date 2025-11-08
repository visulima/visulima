import type { EmailAddress, EmailOptions, EmailResult, Result } from "./types.js";
import type { Provider } from "./providers/provider.js";

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
    private attachments: Array<{
        filename: string;
        content: string | Buffer;
        contentType?: string;
        disposition?: string;
        cid?: string;
        path?: string;
    }> = [];
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
        const addresses = Array.isArray(address)
            ? address.map((addr) => (typeof addr === "string" ? { email: addr } : addr))
            : typeof address === "string"
              ? [{ email: address }]
              : [address];

        this.toAddresses.push(...addresses);
        return this;
    }

    /**
     * Set the CC recipient address(es)
     */
    cc(address: EmailAddress | EmailAddress[] | string | string[]): this {
        const addresses = Array.isArray(address)
            ? address.map((addr) => (typeof addr === "string" ? { email: addr } : addr))
            : typeof address === "string"
              ? [{ email: address }]
              : [address];

        this.ccAddresses.push(...addresses);
        return this;
    }

    /**
     * Set the BCC recipient address(es)
     */
    bcc(address: EmailAddress | EmailAddress[] | string | string[]): this {
        const addresses = Array.isArray(address)
            ? address.map((addr) => (typeof addr === "string" ? { email: addr } : addr))
            : typeof address === "string"
              ? [{ email: address }]
              : [address];

        this.bccAddresses.push(...addresses);
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
    headers(headers: Record<string, string>): this {
        Object.assign(this.headers, headers);
        return this;
    }

    /**
     * Attach a file
     */
    attach(filename: string, content: string | Buffer, options?: { contentType?: string; disposition?: string; cid?: string }): this {
        this.attachments.push({
            filename,
            content,
            contentType: options?.contentType,
            disposition: options?.disposition,
            cid: options?.cid,
        });
        return this;
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
        if (!this.textContent && !this.htmlContent) {
            throw new Error("Either text or html content is required");
        }

        return {
            from: this.fromAddress,
            to: this.toAddresses.length === 1 ? this.toAddresses[0] : this.toAddresses,
            subject: this.subjectText,
            text: this.textContent,
            html: this.htmlContent,
            cc: this.ccAddresses.length > 0 ? (this.ccAddresses.length === 1 ? this.ccAddresses[0] : this.ccAddresses) : undefined,
            bcc: this.bccAddresses.length > 0 ? (this.bccAddresses.length === 1 ? this.bccAddresses[0] : this.bccAddresses) : undefined,
            headers: Object.keys(this.headers).length > 0 ? this.headers : undefined,
            attachments: this.attachments.length > 0 ? this.attachments : undefined,
            replyTo: this.replyToAddress,
        };
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
