import type { BaseConfig } from "../../../types";

export interface ExpoConfig extends BaseConfig {
    /** Expo access token (required for projects with enhanced security). */
    accessToken?: string;
    /** Override the API base URL. */
    endpoint?: string;
}
