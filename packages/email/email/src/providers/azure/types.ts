import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Azure Communication Services configuration
 */
export interface AzureConfig extends BaseConfig {
    /**
     * Azure AD access token (for OAuth2 authentication)
     */
    accessToken?: string;

    /**
     * Azure Communication Services connection string or access token
     */
    connectionString?: string;

    /**
     * Azure Communication Services endpoint
     * Defaults to: https://{region}.communication.azure.com
     */
    endpoint?: string;

    /**
     * Azure region (e.g., "eastus", "westus")
     */
    region: string;
}

/**
 * Azure-specific email options
 */
export interface AzureEmailOptions extends EmailOptions {
    /**
     * Custom headers
     */
    headers?: Record<string, string>;

    /**
     * Importance level (normal, high)
     */
    importance?: "normal" | "high";

    /**
     * Azure template ID for template-based emails
     */
    templateId?: string;

    /**
     * Template variables for Azure templates
     */
    templateVariables?: Record<string, unknown>;
}
