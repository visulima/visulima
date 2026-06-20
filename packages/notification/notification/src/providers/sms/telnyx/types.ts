import type { BaseConfig } from "../../../types";

export interface TelnyxConfig extends BaseConfig {
    /** Telnyx API key (v2). */
    apiKey: string;
    /** Override the API base URL. */
    endpoint?: string;
    /** Default sender phone number. */
    from?: string;
    /** Messaging profile id (alternative to `from`). */
    messagingProfileId?: string;
}
