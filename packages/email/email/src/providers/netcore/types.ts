import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Netcore (Pepipost) configuration.
 */
export interface NetcoreConfig extends BaseConfig {
    /**
     * Netcore Email API key (sent as the `api_key` header).
     */
    apiKey: string;

    /**
     * API endpoint override.
     */
    endpoint?: string;
}

/**
 * Netcore-specific email options.
 */
export interface NetcoreEmailOptions extends EmailOptions {
    /**
     * Variables substituted into the Netcore template.
     */
    templateData?: Record<string, unknown>;

    /**
     * Stored template id to send instead of inline content.
     */
    templateId?: string;
}
