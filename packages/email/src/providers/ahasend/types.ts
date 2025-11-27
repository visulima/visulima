import type { BaseConfig, EmailOptions } from "../../types";

/**
 * AhaSend configuration
 */
export interface AhaSendConfig extends BaseConfig {
    /**
     * AhaSend API key
     */
    apiKey: string;

    /**
     * AhaSend API endpoint
     * Defaults to: https://api.ahasend.com
     */
    endpoint?: string;
}

/**
 * AhaSend-specific email options
 */
export interface AhaSendEmailOptions extends EmailOptions {
    /**
     * AhaSend template ID for template-based emails
     */
    templateId?: string;

    /**
     * Template variables for AhaSend templates
     */
    templateVariables?: Record<string, unknown>;
}
