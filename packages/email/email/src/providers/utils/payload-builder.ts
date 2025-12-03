import type { EmailAddress, EmailOptions } from "../../types";
import headersToRecord from "../../utils/headers-to-record";

/**
 * Common payload building utilities for email providers
 */
export class PayloadBuilder {
    private payload: Record<string, unknown> = {};

    public constructor(initialPayload: Record<string, unknown> = {}) {
        this.payload = { ...initialPayload };
    }

    /**
     * Sets a field in the payload.
     * @param key The field key to set.
     * @param value The field value to set (undefined and null values are ignored).
     * @returns This instance for method chaining.
     */
    public set(key: string, value: unknown): this {
        if (value !== undefined && value !== null) {
            this.payload[key] = value;
        }

        return this;
    }

    /**
     * Sets multiple fields conditionally in the payload.
     * @param fields An object containing key-value pairs to set.
     * @returns This instance for method chaining.
     */
    public setMultiple(fields: Record<string, unknown>): this {
        for (const [key, value] of Object.entries(fields)) {
            this.set(key, value);
        }

        return this;
    }

    /**
     * Adds recipients (to, cc, bcc) to the payload using a formatter function.
     * @param emailOptions The email options containing recipient addresses.
     * @param formatter A function to format the addresses for the specific provider.
     * @returns This instance for method chaining.
     */
    public addRecipients(emailOptions: EmailOptions, formatter: (addresses: EmailAddress | EmailAddress[]) => unknown): this {
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
     * Adds standard email fields (subject, html, text, replyTo) to the payload.
     * @param emailOptions The email options containing the standard fields.
     * @returns This instance for method chaining.
     */
    public addStandardFields(emailOptions: EmailOptions): this {
        return this.setMultiple({
            html: emailOptions.html,
            reply_to: emailOptions.replyTo,
            replyTo: emailOptions.replyTo, // Alternative key
            subject: emailOptions.subject,
            text: emailOptions.text,
        });
    }

    /**
     * Adds template-related fields to the payload.
     * @param emailOptions The email options containing template information.
     * @param templateKey The key name to use for the template ID (default: "template_id").
     * @returns This instance for method chaining.
     */
    public addTemplateFields(emailOptions: EmailOptions, templateKey = "template_id"): this {
        if ("templateId" in emailOptions && emailOptions.templateId) {
            this.set(templateKey, emailOptions.templateId);
        }

        if ("templateData" in emailOptions && emailOptions.templateData) {
            this.set("template_data", emailOptions.templateData);
            this.set("dynamicTemplateData", emailOptions.templateData); // SendGrid format
            this.set("data", emailOptions.templateData); // Resend format
        }

        return this;
    }

    /**
     * Adds scheduling fields to the payload for delayed sending.
     * @param emailOptions The email options containing scheduling information.
     * @returns This instance for method chaining.
     */
    public addSchedulingFields(emailOptions: EmailOptions): this {
        if ("sendAt" in emailOptions && emailOptions.sendAt) {
            this.set("send_at", emailOptions.sendAt);
            this.set("scheduled_at", emailOptions.sendAt);
        }

        return this;
    }

    /**
     * Adds tags to the payload for email categorization.
     * @param emailOptions The email options containing tags.
     * @param formatter An optional function to format tags for the specific provider.
     * @returns This instance for method chaining.
     */
    public addTags(emailOptions: EmailOptions, formatter?: (tags: unknown[]) => unknown): this {
        if (emailOptions.tags && emailOptions.tags.length > 0) {
            const tags = formatter ? formatter(emailOptions.tags) : emailOptions.tags;

            this.set("tags", tags);
            this.set("o:tag", emailOptions.tags); // Mailgun format
            this.set("Tag", emailOptions.tags[0]); // Postmark format (single tag)
        }

        return this;
    }

    /**
     * Adds custom headers to the payload.
     * @param emailOptions The email options containing custom headers.
     * @param formatter An optional function to format headers for the specific provider.
     * @returns This instance for method chaining.
     */
    public addHeaders(emailOptions: EmailOptions, formatter?: (headers: Record<string, string>) => unknown): this {
        if (emailOptions.headers) {
            const headersRecord = headersToRecord(emailOptions.headers);
            const headers = formatter ? formatter(headersRecord) : headersRecord;

            this.set("headers", headers);
        }

        return this;
    }

    /**
     * Adds a batch ID to the payload for batch email operations.
     * @param emailOptions The email options containing the batch ID.
     * @returns This instance for method chaining.
     */
    public addBatchId(emailOptions: EmailOptions): this {
        if ("batchId" in emailOptions && emailOptions.batchId) {
            this.set("batch_id", emailOptions.batchId);
        }

        return this;
    }

    /**
     * Builds and returns the final payload object.
     * @returns The complete payload object ready for API submission.
     */
    public build(): Record<string, unknown> {
        return this.payload;
    }
}

/**
 * Creates a new payload builder instance.
 * @param initialPayload Optional initial payload object to start with.
 * @returns A new PayloadBuilder instance.
 */
export const createPayloadBuilder = (initialPayload: Record<string, unknown> = {}): PayloadBuilder => new PayloadBuilder(initialPayload);
