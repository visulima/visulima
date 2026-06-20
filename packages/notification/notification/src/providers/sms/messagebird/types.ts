import type { BaseConfig } from "../../../types";

export interface MessageBirdConfig extends BaseConfig {
    /** MessageBird (Bird) access key. */
    accessKey: string;
    /** Override the API base URL. */
    endpoint?: string;
    /** Default originator (sender id or number). */
    from?: string;
}
