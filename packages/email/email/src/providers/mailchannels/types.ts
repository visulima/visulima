import type { BaseConfig, EmailOptions } from "../../types";

/**
 * MailChannels configuration.
 */
export interface MailChannelsConfig extends BaseConfig {
    /**
     * MailChannels API key (sent as the `X-Api-Key` header).
     */
    apiKey: string;

    /**
     * API endpoint override.
     */
    endpoint?: string;
}

/**
 * MailChannels-specific email options.
 */
export type MailChannelsEmailOptions = EmailOptions;
