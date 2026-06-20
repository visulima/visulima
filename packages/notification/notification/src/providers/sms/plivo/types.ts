import type { BaseConfig } from "../../../types";

export interface PlivoConfig extends BaseConfig {
    /** Plivo Auth ID. */
    authId: string;
    /** Plivo Auth Token. */
    authToken: string;
    /** Override the API base URL. */
    endpoint?: string;
    /** Default source number or sender id. */
    from?: string;
}
