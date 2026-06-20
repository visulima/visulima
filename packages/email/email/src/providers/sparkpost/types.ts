import type { BaseConfig, EmailOptions } from "../../types";

/**
 * SparkPost configuration.
 */
export interface SparkPostConfig extends BaseConfig {
    /**
     * SparkPost API key (sent as the `Authorization` header).
     */
    apiKey: string;

    /**
     * API endpoint override. Use `https://api.eu.sparkpost.com/api/v1` for the EU region.
     */
    endpoint?: string;
}

/**
 * SparkPost-specific email options.
 */
export interface SparkPostEmailOptions extends EmailOptions {
    /**
     * Campaign id applied to the transmission.
     */
    campaignId?: string;

    /**
     * Stored template id to send instead of inline content.
     */
    templateId?: string;

    /**
     * Whether click tracking is enabled.
     */
    trackClicks?: boolean;

    /**
     * Whether engagement tracking (opens/clicks) is enabled.
     */
    trackOpens?: boolean;
}
