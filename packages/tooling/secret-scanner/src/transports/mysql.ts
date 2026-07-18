import type { ValidationStatus } from "../types";
import type { TransportHostResolver, TransportValidator } from "./context";
import { extractUri, hostFromUri, tryImport } from "./runtime";

interface MysqlModule {
    createConnection: (options: string | { connectTimeout?: number; uri?: string }) => Promise<{
        end: () => Promise<void>;
        ping: () => Promise<void>;
    }>;
}

const MYSQL_REJECTED_ERROR_PATTERN = /access denied|authentication failed/i;

export const resolveMysqlHosts: TransportHostResolver = ({ secret }) => {
    const uri = extractUri(secret, "mysql");

    if (!uri) {
        return undefined;
    }

    const host = hostFromUri(uri);

    return host === undefined ? undefined : [host];
};

export const validateMySQL: TransportValidator = async ({ secret, signal }): Promise<ValidationStatus> => {
    if (signal?.aborted) {
        return "error";
    }

    const uri = extractUri(secret, "mysql");

    if (!uri) {
        return "skipped";
    }

    const mod = await tryImport<MysqlModule>("mysql2/promise", "MySQL");

    if (!mod) {
        return "skipped";
    }

    let connection: Awaited<ReturnType<MysqlModule["createConnection"]>> | undefined;

    try {
        connection = await mod.createConnection({ connectTimeout: 3000, uri });
        await connection.ping();

        return "verified";
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (MYSQL_REJECTED_ERROR_PATTERN.test(message)) {
            return "rejected";
        }

        return "error";
    } finally {
        if (connection) {
            await connection.end().catch(() => undefined);
        }
    }
};
