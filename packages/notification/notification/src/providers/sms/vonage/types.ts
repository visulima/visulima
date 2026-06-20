import type { BaseConfig } from "../../../types";

export interface VonageConfig extends BaseConfig {
    /** Vonage (Nexmo) API key. */
    apiKey: string;
    /** Vonage (Nexmo) API secret. */
    apiSecret: string;
    /** Override the API base URL. */
    endpoint?: string;
    /** Default sender id or phone number. */
    from?: string;
}
