import type { EmailAddress, EmailOptions } from "../../types";

/**
 * Common payload building utilities for email providers
 */
export class PayloadBuilder {
    private payload: Record<string, unknown> = {};

    constructor(initialPayload: Record<string, unknown> = {}) {
        this.payload = { ...initialPayload };
    }

    /**
     * Set a field in the payload
     */
    set(key: string, value: unknown): this {
        if (value !== undefined && value !== null) {
            this.payload[key] = value;
        }

        return this;
    }

    /**
     * Set multiple fields conditionally
     */
    setMultiple(fields: Record<string, unknown>): this {
        for (const [key, value] of Object.entries(fields)) {
            this.set(key, value);
        }

        return this;
    }

    /**
     * Add recipients (to, cc, bcc) using a formatter function
     */
    addRecipients(emailOptions: EmailOptions, formatter: (addresses: EmailAddress | EmailAddress[]) => unknown): this {
        if (emailOptions.to) {
            this.set("to", formatter(emailOptions.to));
        }

        if (emailOptions.cc) {
            this.set("cc", formatter(emailOptions.cc));
        }

        if (emailOptions.bcc) {
            this.set("bcc", formatter(emailOptions.bcc));
        }

        return this;
    }

    /**
     * Add standard email fields (subject, html, text, replyTo)
     */
    addStandardFields(emailOptions: EmailOptions): this {
        return this.setMultiple({
            html: emailOptions.html,
            reply_to: emailOptions.replyTo,
            replyTo: emailOptions.replyTo, // Alternative key
            subject: emailOptions.subject,
            text: emailOptions.text,
        });
    }

    /**
     * Add template-related fields
     */
    addTemplateFields(emailOptions: EmailOptions, templateKey = "template_id"): this {
        if (emailOptions.templateId) {
            this.set(templateKey, emailOptions.templateId);
        }

        if (emailOptions.templateData) {
            this.set("template_data", emailOptions.templateData);
            this.set("dynamicTemplateData", emailOptions.templateData); // SendGrid format
            this.set("data", emailOptions.templateData); // Resend format
        }

        return this;
    }

    /**
     * Add scheduling fields
     */
    addSchedulingFields(emailOptions: EmailOptions): this {
        if (emailOptions.sendAt) {
            this.set("send_at", emailOptions.sendAt);
            this.set("scheduled_at", emailOptions.sendAt);
        }

        return this;
    }

    /**
     * Add tags
     */
    addTags(emailOptions: EmailOptions, formatter?: (tags: unknown[]) => unknown): this {
        if (emailOptions.tags && emailOptions.tags.length > 0) {
            const tags = formatter ? formatter(emailOptions.tags) : emailOptions.tags;

            this.set("tags", tags);
            this.set("o:tag", emailOptions.tags); // Mailgun format
            this.set("Tag", emailOptions.tags[0]); // Postmark format (single tag)
        }

        return this;
    }

    /**
     * Add custom headers
     */
    addHeaders(emailOptions: EmailOptions, formatter?: (headers: Record<string, string>) => unknown): this {
        if (emailOptions.headers) {
            const headers = formatter ? formatter(emailOptions.headers) : emailOptions.headers;

            this.set("headers", headers);
        }

        return this;
    }

    /**
     * Add batch ID
     */
    addBatchId(emailOptions: EmailOptions): this {
        if (emailOptions.batchId) {
            this.set("batch_id", emailOptions.batchId);
        }

        return this;
    }

    /**
     * Build the final payload
     */
    build(): Record<string, unknown> {
        return this.payload;
    }
}

/**
 * Create a payload builder instance
 */
export function createPayloadBuilder(initialPayload: Record<string, unknown> = {}): PayloadBuilder {
    return new PayloadBuilder(initialPayload);
}
