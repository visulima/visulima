import type { ValidationStatus } from "../types";
import type { TransportHostResolver, TransportValidator } from "./context";
import { createUriHostResolver, extractUri, tryImport } from "./runtime";

interface PostgresModule {
    default: {
        Client: new (options: { connectionString: string; connectionTimeoutMillis?: number }) => {
            connect: () => Promise<void>;
            end: () => Promise<void>;
            query: (text: string) => Promise<unknown>;
        };
    };
}

const POSTGRES_REJECTED_ERROR_PATTERN = /password authentication failed|role .* does not exist|no pg_hba\.conf entry/i;

export const resolvePostgresHosts: TransportHostResolver = createUriHostResolver("postgres", "postgresql");

export const validatePostgres: TransportValidator = async ({ secret }): Promise<ValidationStatus> => {
    const uri = extractUri(secret, "postgres") ?? extractUri(secret, "postgresql");

    if (!uri) {
        return "skipped";
    }

    const mod = await tryImport<PostgresModule>("pg", "Postgres");

    if (!mod) {
        return "skipped";
    }

    const client = new mod.default.Client({ connectionString: uri, connectionTimeoutMillis: 3000 });

    try {
        await client.connect();
        await client.query("SELECT 1");

        return "verified";
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (POSTGRES_REJECTED_ERROR_PATTERN.test(message)) {
            return "rejected";
        }

        return "error";
    } finally {
        await client.end().catch(() => undefined);
    }
};
