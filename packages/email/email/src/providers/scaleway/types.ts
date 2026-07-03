import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Scaleway configuration
 */
export interface ScalewayConfig extends BaseConfig {
    /**
     * Scaleway API key
     */
    apiKey: string;

    /**
     * Scaleway API endpoint
     * Defaults to: https://api.scaleway.com/transactional-email/v1alpha1
     */
    endpoint?: string;

    /**
     * Scaleway region (e.g., "fr-par", "nl-ams")
     */
    region: string;
}

/**
 * Scaleway-specific email options
 */
export interface ScalewayEmailOptions extends EmailOptions {
    /**
     * Project ID (optional)
     */
    projectId?: string;

    /**
     * Scaleway template ID for template-based emails
     */
    templateId?: string;

    /**
     * Template variables for Scaleway templates
     */
    templateVariables?: Record<string, unknown>;
}
