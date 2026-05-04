/**
 * Benchmark: HTTP remote-cache backend.
 *
 * Establishes a baseline for `containsAction` / `storeAction` /
 * `retrieveAction` round-trip cost against a localhost HTTP server.
 * The numbers aren't a regression gate (the pre-refactor backend was
 * deleted in the REAPI rollout, so there's no apples-to-apples
 * comparison) — they're a reference point so future regressions show
 * up as relative slowdowns vs. these committed baselines.
 *
 * The Turborepo wire format is intentionally minimal: HEAD/GET/PUT
 * on `/v8/artifacts/{hash}` with one tarball per action. We exercise
 * the bridge entry points (`containsByTaskHash` / `storeByTaskHash` /
 * `retrieveByTaskHash`) so the bench measures what real callers pay.
 *
 * REAPI is intentionally not benchmarked here: a meaningful gRPC
 * baseline requires a real server (bazel-remote) and would conflate
 * the client cost with the server's throughput on the test box. The
 * BAZEL_REMOTE_GRPC_URL integration test covers correctness; a future
 * REAPI bench would gate on the same env var.
 */
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, Server } from "node:http";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, bench, describe } from "vitest";

import { containsByTaskHash, retrieveByTaskHash, storeByTaskHash } from "../src/backends/hash-bridge";
import { HttpRemoteCache } from "../src/backends/http";

interface MockServerHandle {
    artifacts: Map<string, Buffer>;
    server: Server;
    url: string;
}

const collectBody = (request: IncomingMessage): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    return new Promise((resolve) => {
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () => { resolve(Buffer.concat(chunks)); });
    });
};

const ARTIFACT_PREFIX = "/v8/artifacts/";

const parseArtifactHash = (url: string | undefined): string | undefined => {
    if (!url?.startsWith(ARTIFACT_PREFIX)) {
        return undefined;
    }

    const tail = url.slice(ARTIFACT_PREFIX.length);
    const queryAt = tail.indexOf("?");

    return queryAt === -1 ? tail : tail.slice(0, queryAt);
};

/**
 * Spins up a Turborepo-wire-compatible mock on 127.0.0.1:0. HEAD/GET
 * read from the in-memory `artifacts` map; PUT writes to it. No auth,
 * no signing — this benchmarks the client overhead, not server work.
 */
const startMockServer = (): Promise<MockServerHandle> =>
    new Promise((resolve) => {
        const artifacts = new Map<string, Buffer>();
        const server = createServer((request, response) => {
            const hash = parseArtifactHash(request.url);

            if (hash === undefined) {
                response.writeHead(404).end();

                return;
            }

            if (request.method === "HEAD") {
                response.writeHead(artifacts.has(hash) ? 200 : 404).end();

                return;
            }

            if (request.method === "GET") {
                const blob = artifacts.get(hash);

                if (blob === undefined) {
                    response.writeHead(404).end();

                    return;
                }

                response.writeHead(200, { "content-type": "application/octet-stream" });
                response.end(blob);

                return;
            }

            if (request.method === "PUT") {
                collectBody(request)
                    .then((body) => {
                        artifacts.set(hash, body);
                        response.writeHead(200).end();

                        return undefined;
                    })
                    .catch(() => {
                        response.writeHead(500).end();
                    });

                return;
            }

            response.writeHead(405).end();
        });

        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port = typeof address === "object" && address ? address.port : 0;

            resolve({ artifacts, server, url: `http://127.0.0.1:${port}` });
        });
    });

const closeMockServer = (server: Server): Promise<void> =>
    new Promise((resolve) => {
        server.close(() => { resolve(); });
    });

const createTempDir = async (label: string): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `task-runner-bench-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

/** Populate `&lt;cacheDir>/&lt;taskHash>/` with a committed cache entry of the requested size. */
const seedLocalEntry = async (cacheDirectory: string, taskHash: string, payloadBytes: number): Promise<void> => {
    const entry = join(cacheDirectory, taskHash);

    await mkdir(entry, { recursive: true });
    await writeFile(join(entry, ".commit"), taskHash);
    await writeFile(join(entry, "code"), "0");
    await writeFile(join(entry, "terminalOutput"), "x".repeat(payloadBytes));
};

const artifactKey = (taskHash: string): string => createHash("sha256").update(`vis-task:${taskHash}`).digest("hex");

describe("http backend - HEAD probe", () => {
    let handle: MockServerHandle;

    beforeAll(async () => {
        handle = await startMockServer();
        // Pre-populate the hit path so HEAD returns 200 deterministically.
        handle.artifacts.set(artifactKey("hit-hash"), Buffer.from("seeded"));
    });

    afterAll(async () => {
        await closeMockServer(handle.server);
    });

    bench("containsAction (hit)", async () => {
        const cache = new HttpRemoteCache({ url: handle.url });

        await containsByTaskHash(cache, "hit-hash");
    });

    bench("containsAction (miss)", async () => {
        const cache = new HttpRemoteCache({ url: handle.url });

        await containsByTaskHash(cache, "miss-hash");
    });
});

describe("http backend - storeAction", () => {
    let handle: MockServerHandle;
    let smallCacheDir: string;
    let largeCacheDir: string;

    beforeAll(async () => {
        handle = await startMockServer();
        smallCacheDir = await createTempDir("store-small");
        largeCacheDir = await createTempDir("store-large");
        await seedLocalEntry(smallCacheDir, "small-hash", 1024); // ~1KB output
        await seedLocalEntry(largeCacheDir, "large-hash", 1024 * 1024); // 1MB output
    });

    afterAll(async () => {
        await closeMockServer(handle.server);
        await rm(smallCacheDir, { force: true, recursive: true });
        await rm(largeCacheDir, { force: true, recursive: true });
    });

    bench("storeAction (1KB payload)", async () => {
        const cache = new HttpRemoteCache({ url: handle.url });

        await storeByTaskHash(cache, "small-hash", smallCacheDir);
    });

    bench("storeAction (1MB payload)", async () => {
        const cache = new HttpRemoteCache({ url: handle.url });

        await storeByTaskHash(cache, "large-hash", largeCacheDir);
    });
});

describe("http backend - retrieveAction", () => {
    let handle: MockServerHandle;
    let restoreDir: string;
    let cacheDirectoryForUpload: string;

    beforeAll(async () => {
        handle = await startMockServer();
        cacheDirectoryForUpload = await createTempDir("retrieve-seed");
        restoreDir = await createTempDir("retrieve-target");

        // Seed the server by uploading a real entry once. This produces a
        // wire-format-correct tarball blob that retrieveAction will then
        // download + extract on every iteration.
        await seedLocalEntry(cacheDirectoryForUpload, "round-trip", 16 * 1024); // 16KB
        const uploader = new HttpRemoteCache({ url: handle.url });

        await storeByTaskHash(uploader, "round-trip", cacheDirectoryForUpload);
    });

    afterAll(async () => {
        await closeMockServer(handle.server);
        await rm(cacheDirectoryForUpload, { force: true, recursive: true });
        await rm(restoreDir, { force: true, recursive: true });
    });

    bench("retrieveAction (16KB hit, fresh local)", async () => {
        // Use a unique-per-iteration directory so we always exercise the
        // full extract path (cache.get short-circuits if the entry is
        // already on disk).
        // eslint-disable-next-line sonarjs/pseudo-random
        const target = join(restoreDir, `iter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

        await mkdir(target, { recursive: true });
        const downloader = new HttpRemoteCache({ localCasRoot: target, url: handle.url });

        await retrieveByTaskHash(downloader, "round-trip", target);
    });

    bench("retrieveAction (miss)", async () => {
        const downloader = new HttpRemoteCache({ localCasRoot: restoreDir, url: handle.url });

        await retrieveByTaskHash(downloader, "miss-hash", restoreDir);
    });
});
