import type { BaseConfig, EmailOptions } from "../../types";

/**
 * AutoSend configuration.
 */
export interface AutoSendConfig extends BaseConfig {
    /**
     * AutoSend API key (sent as a Bearer token).
     */
    apiKey: string;

    /**
     * API endpoint override (default `https://api.autosend.com/v1`).
     */
    endpoint?: string;
}

/**
 * AutoSend-specific email options.
 *
 * See the [send reference](https://docs.autosend.com/api-reference/mails/send). AutoSend's
 * `/mails/send` takes exactly one `to` recipient — pass a single address, and use `cc`/`bcc`
 * for additional ones.
 */
export interface AutoSendEmailOptions extends EmailOptions {
    /**
     * Sends even if the recipient is on the suppression list. Use sparingly: suppressions exist
     * to protect the sending domain's reputation.
     */
    bypassSuppressions?: boolean;

    /**
     * Values substituted into Handlebars placeholders (`{{ name }}`) in the template or `html`.
     */
    dynamicData?: Record<string, unknown>;

    /**
     * An AutoSend template id, used instead of `html` / `text`.
     */
    templateId?: string;

    /**
     * Enables click tracking for this message.
     */
    trackingClick?: boolean;

    /**
     * Enables open tracking for this message.
     */
    trackingOpen?: boolean;

    /**
     * The unsubscribe group this message belongs to.
     */
    unsubscribeGroupId?: string;
}
