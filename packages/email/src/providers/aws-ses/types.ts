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
     * Tags for AWS SES
     */
    tags?: Array<{ name: string; value: string }>;
}
