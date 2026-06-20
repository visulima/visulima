import type { BaseConfig } from "../../../types";

export interface MsTeamsConfig extends BaseConfig {
    /** Microsoft Teams Incoming Webhook URL. Required. */
    webhookUrl: string;
}
