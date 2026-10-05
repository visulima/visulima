import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AbstractBaseStorage } from "@visulima/storage";
import { Multipart, Rest, Tus } from "@visulima/storage/handler/http/node";
import { AwsLightStorage } from "@visulima/storage/provider/aws-light";
import { DiskStorage } from "@visulima/storage/provider/local";

/** Live tests run only with LIVE_TESTS=1, against the services of the storage package's docker-compose.live.yml. */
const LIVE = process.env.LIVE_TESTS === "1";

const env = (name: string, fallback: string): string => process.env[name] ?? fallback;

// The defaults match packages/storage/storage/docker-compose.live.yml.
const S3 = {
    accessKeyId: env("LIVE_S3_ACCESS_KEY", "live-access-key"),
    endpoint: env("LIVE_S3_ENDPOINT", "http://127.0.0.1:9000"),
    region: env("LIVE_S3_REGION", "us-east-1"),
    secretAccessKey: env("LIVE_S3_SECRET_KEY", "live-secret-key"),
};

/** S3's smallest non-final part, and the chunk size of the TUS and chunked REST adapters. */
const PART_SIZE = 5 * 1024 * 1024;

type Storage = AbstractBaseStorage;

/** A request the server received, with the body length its headers announced. */
interface ReceivedRequest {
    contentLength: number;
    method: string;
    url: string;
}

interface LiveServer {
    close: () => Promise<void>;
    /** Ids of the uploads a handler reported complete. */
    completed: string[];
    /** Called for every request before a handler sees it. */
    onRequest: ((request: IncomingMessage) => void) | undefined;
    origin: string;
    requests: ReceivedRequest[];
    storage: Storage;
}

/** A backend's storage over a fresh directory or bucket, and how to remove it. */
interface Backend {
    cleanup: () => Promise<void>;
    storage: Storage;
}

const BACKENDS: Record<string, () => Promise<Backend>> = {
    "aws-light (MinIO)": async () => {
        const bucket = `live-${randomUUID().slice(0, 8)}`;
        const storage = new AwsLightStorage({ ...S3, bucket, retryConfig: { maxRetries: 0 } });
        const created = await storage.raw.fetch(`${S3.endpoint}/${bucket}`, { method: "PUT" });

        if (!created.ok) {
            throw new Error(`Creating the bucket failed: ${String(created.status)}`);
        }

        return { cleanup: async () => {}, storage };
    },
    disk: async () => {
        const directory = await mkdtemp(join(tmpdir(), "storage-client-live-"));

        // An aborted upload's write can still be closing its files and saving its record when the
        // test ends, so the directory may not be empty on the first try (ENOTEMPTY in CI).
        return {
            cleanup: async () => rm(directory, { force: true, maxRetries: 10, recursive: true, retryDelay: 100 }),
            storage: new DiskStorage({ directory }),
        };
    },
};

/** A node:http server mounting the storage package's Tus, Rest and Multipart handlers on /tus, /rest and /multipart. */
const startServer = async (storage: Storage): Promise<LiveServer> => {
    const handlers = { multipart: new Multipart({ storage }), rest: new Rest({ storage }), tus: new Tus({ storage }) };
    const completed: string[] = [];

    for (const handler of Object.values(handlers)) {
        handler.on("completed", (file: { id: string }) => {
            completed.push(file.id);
        });
    }

    const live: Omit<LiveServer, "close" | "origin"> = { completed, onRequest: undefined, requests: [], storage };

    const server = createServer((request, response) => {
        live.requests.push({ contentLength: Number(request.headers["content-length"] ?? 0), method: request.method ?? "", url: request.url ?? "" });
        live.onRequest?.(request);

        const handler = handlers[(request.url ?? "").split("/")[1] as keyof typeof handlers] as (typeof handlers)[keyof typeof handlers] | undefined;

        if (handler) {
            handler.handle(request, response).catch(() => {
                // The handler answers its own errors.
            });
        } else {
            response.writeHead(404).end();
        }
    });

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    return Object.assign(live, {
        close: async () =>
            new Promise<void>((resolve) => {
                server.closeAllConnections();
                server.close(() => {
                    resolve();
                });
            }),
        origin: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    });
};

/** `size` bytes of a pattern, so a stored upload can be compared byte for byte. */
const pattern = (size: number, seed = 0): Uint8Array => {
    const bytes = new Uint8Array(size);

    for (let index = 0; index < size; index += 1) {
        bytes[index] = (index + seed) % 251;
    }

    return bytes;
};

/** The bytes stored for an upload. */
const storedBytes = async (storage: Storage, id: string): Promise<Uint8Array> => {
    const { content } = await storage.get({ id });

    return new Uint8Array(content);
};

export type { LiveServer };
export { BACKENDS, LIVE, PART_SIZE, pattern, startServer, storedBytes };
