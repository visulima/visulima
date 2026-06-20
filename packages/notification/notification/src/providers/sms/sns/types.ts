import type { BaseConfig } from "../../../types";

export interface SnsConfig extends BaseConfig {
    /** AWS access key id. */
    accessKeyId: string;
    /** Override the SNS endpoint (defaults to `https://sns.{region}.amazonaws.com/`). */
    endpoint?: string;
    /** AWS region (defaults to `us-east-1`). */
    region?: string;
    /** AWS secret access key. */
    secretAccessKey: string;
    /** Optional STS session token for temporary credentials. */
    sessionToken?: string;
}
