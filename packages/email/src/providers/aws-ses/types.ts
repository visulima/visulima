import type { EmailOptions } from "../../types.js";

/**
 * AWS SES-specific email options
 */
export interface AwsSesEmailOptions extends EmailOptions {
    /**
     * Configuration set name
     */
    configurationSetName?: string;

    /**
     * Source ARN for sending authorization
     */
    sourceArn?: string;

    /**
     * Return path email address
     */
    returnPath?: string;

    /**
     * Return path ARN
     */
    returnPathArn?: string;

    /**
     * Message tags as key-value pairs
     */
    messageTags?: Record<string, string>;
}
