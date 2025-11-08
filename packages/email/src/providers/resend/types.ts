import type { EmailOptions, EmailTag } from "../../types.js";

/**
 * Resend-specific email tag type with additional constraints
 */
export interface ResendEmailTag extends EmailTag {
    /**
     * Tag name - must only contain ASCII letters, numbers, underscores, or dashes
     * Max length: 256 characters
     */
    name: string;

    /**
     * Tag value - must only contain ASCII letters, numbers, underscores, or dashes
     */
    value: string;
}

/**
 * Resend-specific email options
 */
export interface ResendEmailOptions extends EmailOptions {
    /**
     * Template ID for template-based emails
     */
    templateId?: string;

    /**
     * Template data for template-based emails
     */
    templateData?: Record<string, unknown>;

    /**
     * Schedule email for delivery at a specific time
     */
    scheduledAt?: Date | string;

    /**
     * Tags for categorizing emails
     */
    tags?: ResendEmailTag[];
}
