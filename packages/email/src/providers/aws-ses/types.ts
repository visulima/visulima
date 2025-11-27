import type { BaseConfig, EmailOptions } from "../../types";

/**
 * AWS SES configuration
 */
export interface AwsSesConfig extends BaseConfig {
    accessKeyId: string;
    apiVersion?: string;
    endpoint?: string;
    maxAttempts?: number;
    region: string;
    secretAccessKey: string;
    sessionToken?: string;
}

/**
 * AWS SES-specific email options
 */
export interface AwsSesEmailOptions extends EmailOptions {
    /**
     * Configuration set name
     */
    configurationSetName?: string;

    /**
     * Message tags as key-value pairs
     */
    messageTags?: Record<string, string>;

    /**
     * Return path email address
     */
    returnPath?: string;

    /**
     * Return path ARN
     */
    returnPathArn?: string;

    /**
     * Source ARN for sending authorization
     */
    sourceArn?: string;
}
