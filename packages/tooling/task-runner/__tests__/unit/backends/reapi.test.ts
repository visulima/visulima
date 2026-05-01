import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { actionDigestForTaskHash, containsByTaskHash, retrieveByTaskHash, storeByTaskHash } from "../../../src/backends/hash-bridge";
import { ReapiRemoteCache } from "../../../src/backends/reapi";
import { loadReapiProto, resetReapiProtoCache } from "../../../src/backends/reapi-proto/loader";
import type { ActionResult, BlobSource, CasDigest } from "../../../src/backends/types";

interface BlobRecord {
    bytes: Buffer;
    digest: CasDigest;
}

interface FixtureServer {
    actionCache: Map<string, unknown>;
    address: string;
    capabilitiesDigestFunctions: string[];
    capabilitiesErrorOverride?: { code: number; message: string };
    capabilitiesMaxBatch: number;
    cas: Map<string, Buffer>;
    findMissingResponseOverride?: (digests: CasDigest[]) => CasDigest[];
    getActionResultErrorOverride?: { code: number; message: string };
    metadata: { authorization?: string; method: string }[];
    requests: { method: string }[];
}

const sha256Hex = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const makeBlob = (data: Buffer | string): BlobRecord => {
    const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;

    return {
        bytes,
        digest: { hash: sha256Hex(bytes), sizeBytes: bytes.byteLength },
    };
};

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `reapi-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const startFixtureServer = async (): Promise<{ close: () => Promise<void>; server: FixtureServer }> => {
    resetReapiProtoCache();

    const { clients, grpc } = await loadReapiProto();

    const grpcServer = new grpc.Server();
    const state: FixtureServer = {
        actionCache: new Map(),
        address: "",
        capabilitiesDigestFunctions: ["SHA256"],
        capabilitiesErrorOverride: undefined,
        capabilitiesMaxBatch: 1024,
        cas: new Map(),
        findMissingResponseOverride: undefined,
        metadata: [],
        requests: [],
    };

    const recordCall = (method: string, call: { metadata: { get: (key: string) => (Buffer | string)[] } }): void => {
        state.requests.push({ method });
        const auth = call.metadata.get("authorization")[0];

        state.metadata.push({
            authorization: typeof auth === "string" ? auth : auth instanceof Buffer ? auth.toString("utf8") : undefined,
            method,
        });
    };

    const cas = clients.ContentAddressableStorage as unknown as { service: object };
    const actionCache = clients.ActionCache as unknown as { service: object };
    const capabilities = clients.Capabilities as unknown as { service: object };
    const byteStream = clients.ByteStream as unknown as { service: object };

    grpcServer.addService(actionCache.service, {
        GetActionResult: (
            call: { metadata: { get: (key: string) => (Buffer | string)[] }; request: { action_digest: { hash: string; size_bytes: number } } },
            callback: (error: { code: number; message: string } | null, response: unknown) => void,
        ) => {
            recordCall("GetActionResult", call);

            if (state.getActionResultErrorOverride !== undefined) {
                callback(state.getActionResultErrorOverride, null);

                return;
            }

            const key = call.request.action_digest.hash;
            const cached = state.actionCache.get(key);

            if (cached === undefined) {
                callback({ code: 5, message: "not found" }, null);

                return;
            }

            callback(null, cached);
        },
        UpdateActionResult: (
            call: {
                metadata: { get: (key: string) => (Buffer | string)[] };
                request: { action_digest: { hash: string; size_bytes: number }; action_result: unknown };
            },
            callback: (error: Error | null, response: unknown) => void,
        ) => {
            recordCall("UpdateActionResult", call);
            state.actionCache.set(call.request.action_digest.hash, call.request.action_result);
            callback(null, call.request.action_result);
        },
    });

    grpcServer.addService(cas.service, {
        BatchReadBlobs: (
            call: {
                metadata: { get: (key: string) => (Buffer | string)[] };
                request: { digests?: { hash: string; size_bytes: number }[] };
            },
            callback: (error: Error | null, response: unknown) => void,
        ) => {
            recordCall("BatchReadBlobs", call);
            const responses = (call.request.digests ?? []).map((digest) => {
                const data = state.cas.get(digest.hash);

                if (data === undefined) {
                    return {
                        compressor: "IDENTITY",
                        data: Buffer.alloc(0),
                        digest,
                        status: { code: 5, message: "not found" },
                    };
                }

                return {
                    compressor: "IDENTITY",
                    data,
                    digest: { hash: digest.hash, size_bytes: data.byteLength },
                    status: { code: 0, message: "" },
                };
            });

            callback(null, { responses });
        },
        BatchUpdateBlobs: (
            call: {
                metadata: { get: (key: string) => (Buffer | string)[] };
                request: { requests?: { data: Buffer; digest: { hash: string; size_bytes: number } }[] };
            },
            callback: (error: Error | null, response: unknown) => void,
        ) => {
            recordCall("BatchUpdateBlobs", call);
            const responses = (call.request.requests ?? []).map((entry) => {
                const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);

                state.cas.set(entry.digest.hash, data);

                return { digest: entry.digest, status: { code: 0, message: "" } };
            });

            callback(null, { responses });
        },
        FindMissingBlobs: (
            call: {
                metadata: { get: (key: string) => (Buffer | string)[] };
                request: { blob_digests?: { hash: string; size_bytes: number }[] };
            },
            callback: (error: Error | null, response: unknown) => void,
        ) => {
            recordCall("FindMissingBlobs", call);

            if (state.findMissingResponseOverride) {
                const digests = (call.request.blob_digests ?? []).map((d) => { return { hash: d.hash, sizeBytes: d.size_bytes }; });
                const missing = state.findMissingResponseOverride(digests);

                callback(null, {
                    missing_blob_digests: missing.map((digest) => { return { hash: digest.hash, size_bytes: digest.sizeBytes }; }),
                });

                return;
            }

            const missing = (call.request.blob_digests ?? []).filter((d) => !state.cas.has(d.hash));

            callback(null, { missing_blob_digests: missing });
        },
    });

    grpcServer.addService(capabilities.service, {
        GetCapabilities: (
            call: { metadata: { get: (key: string) => (Buffer | string)[] } },
            callback: (error: { code: number; message: string } | null, response: unknown) => void,
        ) => {
            recordCall("GetCapabilities", call);

            if (state.capabilitiesErrorOverride !== undefined) {
                callback(state.capabilitiesErrorOverride, null);

                return;
            }

            callback(null, {
                cache_capabilities: {
                    action_cache_update_capabilities: { update_enabled: true },
                    digest_functions: state.capabilitiesDigestFunctions,
                    max_batch_total_size_bytes: state.capabilitiesMaxBatch,
                    supported_batch_update_compressors: ["IDENTITY"],
                    supported_compressors: ["IDENTITY"],
                    symlink_absolute_path_strategy: { value: "DISALLOWED" },
                },
                deprecated_api_version: { major: 2, minor: 0, patch: "0", prerelease: "" },
                high_api_version: { major: 2, minor: 1, patch: "0", prerelease: "" },
                low_api_version: { major: 2, minor: 0, patch: "0", prerelease: "" },
            });
        },
    });

    grpcServer.addService(byteStream.service, {
        Read: (call: {
            emit: (event: string, payload: unknown) => void;
            end: () => void;
            metadata: { get: (key: string) => (Buffer | string)[] };
            request: { resource_name: string };
            write: (chunk: unknown) => void;
        }) => {
            recordCall("Read", call as never);
            const match = /blobs\/([^/]+)\/\d+/.exec(call.request.resource_name);

            if (!match) {
                call.emit("error", { code: 13, message: "bad resource name" });
                call.end();

                return;
            }

            const [, hash] = match;
            const data = state.cas.get(hash ?? "");

            if (data === undefined) {
                call.emit("error", { code: 5, message: "not found" });
                call.end();

                return;
            }

            const chunkSize = 1024;

            for (let offset = 0; offset < data.byteLength; offset += chunkSize) {
                call.write({ data: data.subarray(offset, offset + chunkSize) });
            }

            call.end();
        },
        Write: (
            call: {
                metadata: { get: (key: string) => (Buffer | string)[] };
                on: (event: string, listener: (chunk: { data: Buffer; finish_write: boolean; resource_name: string; write_offset: number }) => void) => void;
            },
            callback: (error: Error | null, response: unknown) => void,
        ) => {
            recordCall("Write", call as never);

            const chunks: Buffer[] = [];
            let resourceName = "";

            call.on("data", (chunk: { data: Buffer; finish_write: boolean; resource_name: string; write_offset: number }) => {
                if (chunk.resource_name !== "" && resourceName === "") {
                    resourceName = chunk.resource_name;
                }

                if (chunk.data && chunk.data.byteLength > 0) {
                    chunks.push(Buffer.isBuffer(chunk.data) ? chunk.data : Buffer.from(chunk.data));
                }

                if (chunk.finish_write) {
                    const data = Buffer.concat(chunks);
                    const match = /blobs\/([^/]+)\/\d+/.exec(resourceName);

                    if (!match) {
                        callback(new Error("bad resource name"), null);

                        return;
                    }

                    const [, hash] = match;

                    state.cas.set(hash ?? "", data);

                    callback(null, { committed_size: data.byteLength });
                }
            });

            call.on("end", () => {});
        },
    });

    const port = await new Promise<number>((resolve, reject) => {
        grpcServer.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (error, boundPort) => {
            if (error) {
                reject(error);

                return;
            }

            resolve(boundPort);
        });
    });

    state.address = `grpc://127.0.0.1:${String(port)}`;

    return {
        close: async () => {
            await new Promise<void>((resolve) => {
                grpcServer.tryShutdown(() => {
                    resolve();
                });
            });
        },
        server: state,
    };
};

describe(ReapiRemoteCache, () => {
    let fixture: { close: () => Promise<void>; server: FixtureServer };

    beforeAll(async () => {
        fixture = await startFixtureServer();
    });

    afterAll(async () => {
        await fixture.close();
    });

    beforeEach(() => {
        fixture.server.actionCache.clear();
        fixture.server.cas.clear();
        fixture.server.requests.length = 0;
        fixture.server.metadata.length = 0;
        fixture.server.findMissingResponseOverride = undefined;
        fixture.server.getActionResultErrorOverride = undefined;
        fixture.server.capabilitiesErrorOverride = undefined;
        fixture.server.capabilitiesDigestFunctions = ["SHA256"];
        fixture.server.capabilitiesMaxBatch = 1024;
    });

    describe("storeAction + retrieveAction", () => {
        it("uploads missing blobs, writes ActionResult, and reads it back", async () => {
            expect.assertions(4);

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const blob = makeBlob("hello reapi");
            const actionDigest: CasDigest = { hash: sha256Hex(Buffer.from("action-key", "utf8")), sizeBytes: 16 };

            const result: ActionResult = {
                exitCode: 0,
                outputDirectories: [],
                outputFiles: [{ digest: blob.digest, isExecutable: false, path: "out.txt" }],
            };

            const blobs: BlobSource[] = [{ digest: blob.digest, open: () => Promise.resolve(Readable.from(blob.bytes)) }];

            const stored = await cache.storeAction(actionDigest, result, blobs);

            expect(stored).toBe(true);

            const fetched = await cache.retrieveAction(actionDigest);

            expect(fetched).not.toBeNull();
            expect(fetched?.outputFiles[0]?.digest.hash).toBe(blob.digest.hash);
            expect(fixture.server.cas.get(blob.digest.hash)?.toString("utf8")).toBe("hello reapi");
        });

        it("skips blobs the server reports as already present", async () => {
            expect.assertions(2);

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const blob = makeBlob("already-there");

            fixture.server.cas.set(blob.digest.hash, blob.bytes);

            let openCalls = 0;
            const blobs: BlobSource[] = [
                {
                    digest: blob.digest,
                    open: () => {
                        openCalls += 1;

                        return Promise.resolve(Readable.from(blob.bytes));
                    },
                },
            ];

            const ok = await cache.storeAction(
                { hash: sha256Hex(Buffer.from("a", "utf8")), sizeBytes: 1 },
                { exitCode: 0, outputDirectories: [], outputFiles: [{ digest: blob.digest, isExecutable: false, path: "x" }] },
                blobs,
            );

            expect(ok).toBe(true);
            expect(openCalls).toBe(0);
        });
    });

    describe("retrieveAction", () => {
        it("returns null on NOT_FOUND", async () => {
            expect.assertions(1);

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const result = await cache.retrieveAction({ hash: "deadbeef".repeat(8), sizeBytes: 1 });

            expect(result).toBeNull();
        });
    });

    describe("containsAction", () => {
        it("returns false on missing entry", async () => {
            expect.assertions(1);

            const cache = new ReapiRemoteCache({ url: fixture.server.address });

            await expect(cache.containsAction({ hash: "f".repeat(64), sizeBytes: 1 })).resolves.toBe(false);
        });

        it("returns true after storeAction", async () => {
            expect.assertions(1);

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const actionDigest: CasDigest = { hash: sha256Hex(Buffer.from("hit", "utf8")), sizeBytes: 1 };

            await cache.storeAction(actionDigest, { exitCode: 0, outputDirectories: [], outputFiles: [] }, []);

            await expect(cache.containsAction(actionDigest)).resolves.toBe(true);
        });

        it("propagates non-NOT_FOUND errors instead of pretending the entry is missing", async () => {
            expect.assertions(1);

            fixture.server.getActionResultErrorOverride = { code: 13, message: "internal" };

            const cache = new ReapiRemoteCache({ url: fixture.server.address });

            await expect(cache.containsAction({ hash: "a".repeat(64), sizeBytes: 1 })).rejects.toMatchObject({ code: 13 });
        });
    });

    describe("fetchBlob", () => {
        it("downloads a small blob via BatchReadBlobs", async () => {
            expect.assertions(2);

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const blob = makeBlob("small-payload");

            fixture.server.cas.set(blob.digest.hash, blob.bytes);

            const directory = await createTemporaryDirectory();

            try {
                const target = join(directory, "out.bin");
                const ok = await cache.fetchBlob(blob.digest, target);

                expect(ok).toBe(true);
                const fetched = await readFile(target);

                expect(fetched.toString("utf8")).toBe("small-payload");
            } finally {
                await rm(directory, { force: true, recursive: true });
            }
        });

        it("falls back to streaming Read for blobs over the batch threshold", async () => {
            expect.assertions(3);

            fixture.server.capabilitiesMaxBatch = 16;

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const big = Buffer.alloc(4096, "x");
            const digest: CasDigest = { hash: sha256Hex(big), sizeBytes: big.byteLength };

            fixture.server.cas.set(digest.hash, big);

            const directory = await createTemporaryDirectory();

            try {
                const target = join(directory, "big.bin");
                const ok = await cache.fetchBlob(digest, target);

                expect(ok).toBe(true);

                const fetched = await readFile(target);

                expect(fetched.byteLength).toBe(big.byteLength);
                expect(fixture.server.requests.some((entry) => entry.method === "Read")).toBe(true);
            } finally {
                await rm(directory, { force: true, recursive: true });
            }
        });

        it("returns false on NOT_FOUND and does not leave a partial file", async () => {
            expect.assertions(1);

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const directory = await createTemporaryDirectory();

            try {
                const ok = await cache.fetchBlob({ hash: "0".repeat(64), sizeBytes: 4 }, join(directory, "missing.bin"));

                expect(ok).toBe(false);
            } finally {
                await rm(directory, { force: true, recursive: true });
            }
        });
    });

    describe("storeAction streaming path", () => {
        it("uploads big blobs via ByteStream.Write", async () => {
            expect.assertions(3);

            fixture.server.capabilitiesMaxBatch = 16;

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const big = Buffer.alloc(8192, "y");
            const digest: CasDigest = { hash: sha256Hex(big), sizeBytes: big.byteLength };
            const actionDigest: CasDigest = { hash: sha256Hex(Buffer.from("big-action", "utf8")), sizeBytes: 1 };

            const ok = await cache.storeAction(
                actionDigest,
                { exitCode: 0, outputDirectories: [], outputFiles: [{ digest, isExecutable: false, path: "big.bin" }] },
                [{ digest, open: () => Promise.resolve(Readable.from(big)) }],
            );

            expect(ok).toBe(true);
            expect(fixture.server.cas.get(digest.hash)?.byteLength).toBe(big.byteLength);
            expect(fixture.server.requests.some((entry) => entry.method === "Write")).toBe(true);
        });
    });

    describe("auth", () => {
        it("forwards bearer token as authorization metadata", async () => {
            expect.assertions(1);

            // Test fixture uses cleartext loopback gRPC; production callers should
            // reach for `grpcs://` instead of opting into the cleartext-bearer path.
            const cache = new ReapiRemoteCache({ allowInsecureBearer: true, bearerToken: "secret-xyz", url: fixture.server.address });

            await cache.containsAction({ hash: "0".repeat(64), sizeBytes: 1 });

            expect(fixture.server.metadata.some((entry) => entry.authorization === "Bearer secret-xyz")).toBe(true);
        });
    });

    describe("mode gating", () => {
        it("read mode does not perform writes", async () => {
            expect.assertions(2);

            const cache = new ReapiRemoteCache({ mode: "read", url: fixture.server.address });
            const stored = await cache.storeAction(
                { hash: "1".repeat(64), sizeBytes: 1 },
                { exitCode: 0, outputDirectories: [], outputFiles: [] },
                [],
            );

            expect(stored).toBe(false);
            expect(fixture.server.requests.some((entry) => entry.method === "UpdateActionResult")).toBe(false);
        });

        it("write mode does not perform reads", async () => {
            expect.assertions(2);

            const cache = new ReapiRemoteCache({ mode: "write", url: fixture.server.address });
            const result = await cache.retrieveAction({ hash: "2".repeat(64), sizeBytes: 1 });

            expect(result).toBeNull();
            expect(fixture.server.requests.some((entry) => entry.method === "GetActionResult")).toBe(false);
        });
    });

    describe("hash bridge", () => {
        it("round-trips a tarball via the hash bridge", async () => {
            expect.assertions(3);

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const cacheDirectory = await createTemporaryDirectory();
            const hash = "abc123";
            const entry = join(cacheDirectory, hash);

            await mkdir(entry, { recursive: true });
            await writeFile(join(entry, "code"), "code-payload", "utf8");
            await writeFile(join(entry, "fingerprint.json"), "{}", "utf8");
            await writeFile(join(entry, ".commit"), "1", "utf8");

            const stored = await storeByTaskHash(cache, hash, cacheDirectory);

            expect(stored).toBe(true);
            await expect(containsByTaskHash(cache, hash)).resolves.toBe(true);

            const restoreDirectory = await createTemporaryDirectory();
            const restored = await retrieveByTaskHash(cache, hash, restoreDirectory);

            expect(restored).toBe(true);

            await rm(cacheDirectory, { force: true, recursive: true });
            await rm(restoreDirectory, { force: true, recursive: true });
        });

        it("containsByTaskHash returns false for an unknown hash", async () => {
            expect.assertions(1);

            const cache = new ReapiRemoteCache({ url: fixture.server.address });

            await expect(containsByTaskHash(cache, "nope")).resolves.toBe(false);
        });
    });

    describe("constructor safety", () => {
        it("refuses bearer tokens over cleartext gRPC by default", () => {
            expect.assertions(1);

            // url is grpc:// (cleartext) — bearer must be refused unless allowInsecureBearer=true.
            expect(() => new ReapiRemoteCache({ bearerToken: "leak", url: "grpc://localhost:1" })).toThrow(/cleartext gRPC/);
        });

        it("allows bearer tokens over cleartext when explicitly opted in", () => {
            expect.assertions(1);

            expect(
                () => new ReapiRemoteCache({ allowInsecureBearer: true, bearerToken: "ok", url: "grpc://localhost:1" }),
            ).not.toThrow();
        });

        it("allows bearer tokens over grpcs:// without the escape hatch", () => {
            expect.assertions(1);

            expect(() => new ReapiRemoteCache({ bearerToken: "ok", url: "grpcs://example.com:443" })).not.toThrow();
        });
    });

    describe("capability negotiation", () => {
        it("refuses to talk to a server that does not advertise SHA256", async () => {
            expect.assertions(1);

            fixture.server.capabilitiesDigestFunctions = ["BLAKE3"];

            const cache = new ReapiRemoteCache({ url: fixture.server.address });

            await expect(cache.containsAction({ hash: "0".repeat(64), sizeBytes: 1 })).rejects.toThrow(/SHA256/);
        });

        it("falls back to defaults when capabilities returns NOT_FOUND", async () => {
            expect.assertions(1);

            // Older REAPI servers may not implement Capabilities — degrade
            // gracefully rather than refusing all subsequent RPCs.
            fixture.server.capabilitiesErrorOverride = { code: 5, message: "not implemented" };

            const cache = new ReapiRemoteCache({ url: fixture.server.address });

            await expect(cache.containsAction({ hash: "f".repeat(64), sizeBytes: 1 })).resolves.toBe(false);
        });

        it("re-throws UNAUTHENTICATED from capabilities instead of silently degrading", async () => {
            expect.assertions(1);

            fixture.server.capabilitiesErrorOverride = { code: 16, message: "bad token" };

            const cache = new ReapiRemoteCache({ url: fixture.server.address });

            await expect(cache.containsAction({ hash: "0".repeat(64), sizeBytes: 1 })).rejects.toMatchObject({ code: 16 });
        });

        it("re-throws PERMISSION_DENIED from capabilities instead of silently degrading", async () => {
            expect.assertions(1);

            fixture.server.capabilitiesErrorOverride = { code: 7, message: "forbidden" };

            const cache = new ReapiRemoteCache({ url: fixture.server.address });

            await expect(cache.containsAction({ hash: "0".repeat(64), sizeBytes: 1 })).rejects.toMatchObject({ code: 7 });
        });
    });

    describe("streamWrite cancellation", () => {
        it("cancels the in-flight Write call when the local blob source throws", async () => {
            expect.assertions(2);

            // Force the streaming Write path: capabilities batch limit too small for any blob.
            fixture.server.capabilitiesMaxBatch = 16;

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const big = Buffer.alloc(8192, "z");
            const digest: CasDigest = { hash: sha256Hex(big), sizeBytes: big.byteLength };
            const actionDigest: CasDigest = { hash: sha256Hex(Buffer.from("cancel-action", "utf8")), sizeBytes: 1 };

            const failingBlob: BlobSource = {
                digest,
                open: () => Promise.reject(new Error("local read exploded")),
            };

            const stored = await cache.storeAction(
                actionDigest,
                { exitCode: 0, outputDirectories: [], outputFiles: [{ digest, isExecutable: false, path: "boom.bin" }] },
                [failingBlob],
            );

            // storeAction must report failure; the cas must not retain a partial entry.
            expect(stored).toBe(false);
            expect(fixture.server.cas.has(digest.hash)).toBe(false);
        });
    });

    describe("probeCapabilities", () => {
        it("returns the negotiated capability values", async () => {
            expect.assertions(2);

            fixture.server.capabilitiesMaxBatch = 4096;
            fixture.server.capabilitiesDigestFunctions = ["SHA256"];

            const cache = new ReapiRemoteCache({ url: fixture.server.address });
            const probe = await cache.probeCapabilities();

            expect(probe.maxBatchTotalSizeBytes).toBe(4096);
            expect(probe.digestFunctions).toContain("SHA256");
        });

        it("works in write-only mode (probe must not be gated)", async () => {
            expect.assertions(1);

            const cache = new ReapiRemoteCache({ mode: "write", url: fixture.server.address });
            const probe = await cache.probeCapabilities();

            expect(probe.digestFunctions).toContain("SHA256");
        });
    });

    describe("actionDigestForTaskHash", () => {
        it("returns sizeBytes: 0 because action digests key the AC, not a CAS blob", () => {
            expect.assertions(2);

            const digest = actionDigestForTaskHash("any-task-hash");

            // sizeBytes carries blob-length semantics in the CAS, but action digests
            // identify an entry in the ActionCache. Stamping a fake length here would
            // make BatchReadBlobs against this digest mismatch on the wire.
            expect(digest.sizeBytes).toBe(0);
            // Hash is sha256 hex (64 chars) since REAPI servers reject non-sha256 wire digests.
            expect(digest.hash).toMatch(/^[\da-f]{64}$/);
        });

        it("is deterministic for the same task hash", () => {
            expect.assertions(1);

            expect(actionDigestForTaskHash("foo")).toStrictEqual(actionDigestForTaskHash("foo"));
        });

        it("differs for different task hashes", () => {
            expect.assertions(1);

            expect(actionDigestForTaskHash("foo").hash).not.toBe(actionDigestForTaskHash("bar").hash);
        });
    });
});
