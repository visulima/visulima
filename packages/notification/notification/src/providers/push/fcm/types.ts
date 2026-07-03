import type { BaseConfig, MaybePromise } from "../../../types";

export interface FcmConfig extends BaseConfig {
    /**
     * A static OAuth2 access token. Prefer {@link FcmConfig.getAccessToken} for tokens
     * that expire. One of `accessToken` / `getAccessToken` is required.
     */
    accessToken?: string;
    /** Override the API base URL. */
    endpoint?: string;

    /**
     * Returns a fresh OAuth2 access token. Lets you plug in `google-auth-library` /
     * `firebase-admin` without bundling Google's SDK or `node:crypto` — keeping the
     * provider edge-safe.
     */
    getAccessToken?: () => MaybePromise<string>;
    /** Firebase project id. Required. */
    projectId: string;
}
