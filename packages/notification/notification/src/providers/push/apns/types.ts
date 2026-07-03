import type { BaseConfig } from "../../../types";

export interface ApnsConfig extends BaseConfig {
    /** The app bundle id, sent as the `apns-topic` header. */
    bundleId: string;
    /** The 10-character Key ID of the signing key, used as the JWT `kid`. */
    keyId: string;
    /** Send to the production gateway when `true`, otherwise the sandbox gateway (default `false`). */
    production?: boolean;
    /** The ES256 signing key in PEM format (contents of the `.p8` file). */
    signingKey: string;
    /** The 10-character Apple Developer Team ID, used as the JWT `iss`. */
    teamId: string;
}
