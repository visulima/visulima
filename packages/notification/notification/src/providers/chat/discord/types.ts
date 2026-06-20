import type { BaseConfig } from "../../../types";

export interface DiscordConfig extends BaseConfig {
    /** Override the bot username for the message. */
    username?: string;
    /** Discord webhook URL. Required. */
    webhookUrl: string;
}
