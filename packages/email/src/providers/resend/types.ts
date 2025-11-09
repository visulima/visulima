import type { EmailOptions, EmailTag } from "../../types";

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
     * Schedule email for delivery at a specific time
     */
    scheduledAt?: Date | string;

    /**
     * Tags for categorizing emails
     */
    tags?: ResendEmailTag[];

    /**
     * Template data for template-based emails
     */
    templateData?: Record<string, unknown>;

    /**
     * Template ID for template-based emails
     */
    templateId?: string;
}
