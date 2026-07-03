import type { ValidationStatus } from "../types";
import type { TransportValidator } from "./context";
import { tryImport } from "./runtime";

interface JwtModule {
    JWT: new (options: { email: string; key: string; scopes: string[] }) => {
        authorize: () => Promise<{ access_token?: string }>;
    };
}

const GCP_REJECTED_ERROR_PATTERN = /invalid_grant|unauthorized_client|invalid_client/i;

export const validateGcp: TransportValidator = async ({ secret }): Promise<ValidationStatus> => {
    let serviceAccount: { client_email?: string; private_key?: string };

    try {
        serviceAccount = JSON.parse(secret);
    } catch {
        return "rejected";
    }

    if (typeof serviceAccount.client_email !== "string" || typeof serviceAccount.private_key !== "string") {
        return "rejected";
    }

    const mod = await tryImport<JwtModule>("google-auth-library", "GCP");

    if (!mod) {
        return "skipped";
    }

    const client = new mod.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    try {
        const tokens = await client.authorize();

        return typeof tokens.access_token === "string" && tokens.access_token.length > 0 ? "verified" : "rejected";
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (GCP_REJECTED_ERROR_PATTERN.test(message)) {
            return "rejected";
        }

        return "error";
    }
};
