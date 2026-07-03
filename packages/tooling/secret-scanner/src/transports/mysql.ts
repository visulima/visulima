import type { ValidationStatus } from "../types";
import type { TransportValidator } from "./context";
import { extractUri, tryImport } from "./runtime";

interface MysqlModule {
    createConnection: (options: string | { connectTimeout?: number; uri?: string }) => Promise<{
        end: () => Promise<void>;
        ping: () => Promise<void>;
    }>;
}

const MYSQL_REJECTED_ERROR_PATTERN = /access denied|authentication failed/i;

export const validateMySQL: TransportValidator = async ({ secret }): Promise<ValidationStatus> => {
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
