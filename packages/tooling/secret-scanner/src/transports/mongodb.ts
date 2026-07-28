import type { ValidationStatus } from "../types";
import type { TransportHostResolver, TransportValidator } from "./context";
import { createUriHostResolver, extractUri, tryImport } from "./runtime";

interface MongoModule {
    MongoClient: new (
        uri: string,
        options?: { serverSelectionTimeoutMS?: number },
    ) => {
        close: () => Promise<void>;
        connect: () => Promise<unknown>;
        db: (name?: string) => { command: (command: Record<string, unknown>) => Promise<unknown> };
    };
}

const MONGO_REJECTED_ERROR_PATTERN = /authentication failed|unauthorized|bad auth/i;

export const resolveMongoHosts: TransportHostResolver = createUriHostResolver("mongodb");

export const validateMongoDB: TransportValidator = async ({ secret }): Promise<ValidationStatus> => {
    const uri = extractUri(secret, "mongodb");

    if (!uri) {
        return "skipped";
    }

    const mod = await tryImport<MongoModule>("mongodb", "MongoDB");

    if (!mod) {
        return "skipped";
    }

    const client = new mod.MongoClient(uri, { serverSelectionTimeoutMS: 3000 });

    try {
        await client.connect();
        await client.db().command({ ping: 1 });

        return "verified";
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (MONGO_REJECTED_ERROR_PATTERN.test(message)) {
            return "rejected";
        }

        return "error";
    } finally {
        await client.close().catch(() => undefined);
    }
};
