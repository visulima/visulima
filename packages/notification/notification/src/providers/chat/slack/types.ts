import type { BaseConfig } from "../../../types";

export interface SlackConfig extends BaseConfig {
    /** Default channel id/name used when the payload omits `to` (Web API mode). */
    defaultChannel?: string;
    /** Override the API base URL (Web API mode). */
    endpoint?: string;
    /** Bot/User OAuth token (`xoxb-...`) for the Web API. Required unless `webhookUrl` is set. */
    token?: string;
    /** Incoming webhook URL. When set, takes precedence over the Web API. */
    webhookUrl?: string;
}
