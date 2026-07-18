import type { ValidationStatus } from "../types";
import type { TransportHostResolver, TransportValidator } from "./context";
import { tryImport } from "./runtime";

interface StsModule {
    GetCallerIdentityCommand: new (input: Record<string, unknown>) => unknown;
    STSClient: new (config: { credentials: { accessKeyId: string; secretAccessKey: string }; region: string; requestHandler?: unknown }) => {
        destroy: () => void;
        send: (command: unknown, options?: { abortSignal?: AbortSignal }) => Promise<{ Account?: string }>;
    };
}

const AWS_REGION = "us-east-1";
const AWS_STS_HOST = `sts.${AWS_REGION}.amazonaws.com`;

const AWS_REJECTED_ERROR_PATTERN = /InvalidClientTokenId|SignatureDoesNotMatch|AccessDenied|ExpiredToken/i;

// STS is a fixed provider endpoint — the host never comes from scanned content,
// but the allowlist still gates it so a scan restricted to specific hosts
// doesn't fire off-list outbound traffic.
export const resolveAwsHosts: TransportHostResolver = () => [AWS_STS_HOST];

export const validateAws: TransportValidator = async ({ extras, secret, signal }): Promise<ValidationStatus> => {
    if (signal?.aborted) {
        return "error";
    }

    const accessKeyId = extras["AKID"];

    if (typeof accessKeyId !== "string" || accessKeyId.length === 0) {
        // Can't call STS without the AKID half — fall back to skipped. The
        // paired `depends_on_rule` machinery in the pipeline is what populates
        // `extras.AKID`; its absence usually means the partner finding wasn't
        // detected in the same file.
        return "skipped";
    }

    const mod = await tryImport<StsModule>("@aws-sdk/client-sts", "AWS");

    if (!mod) {
        return "skipped";
    }

    const client = new mod.STSClient({
        credentials: { accessKeyId, secretAccessKey: secret },
        region: AWS_REGION,
    });

    try {
        const response = await client.send(new mod.GetCallerIdentityCommand({}), signal ? { abortSignal: signal } : undefined);

        return typeof response.Account === "string" && response.Account.length > 0 ? "verified" : "rejected";
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (AWS_REJECTED_ERROR_PATTERN.test(message)) {
            return "rejected";
        }

        return "error";
    } finally {
        client.destroy();
    }
};
