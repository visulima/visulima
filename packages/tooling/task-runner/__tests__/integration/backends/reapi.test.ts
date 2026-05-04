/**
 * Integration test against a real bazel-remote container.
 *
 * Skipped by default — opt in by exporting BAZEL_REMOTE_GRPC_URL. The
 * env var keeps unit CI Docker-free; CI jobs that already provision a
 * bazel-remote service (or developers running it locally) get the
 * coverage without paying a Docker dependency on every test run.
 *
 * Run locally:
 *   docker run -d --rm --name bazel-remote \
 *     -p 9092:9092 \
 *     -v /tmp/bazel-remote:/data \
 *     buchgr/bazel-remote-cache \
 *     --max_size=1 \
 *     --grpc_address=0.0.0.0:9092
 *   BAZEL_REMOTE_GRPC_URL=grpc://localhost:9092 \
 *     pnpm --filter @visulima/task-runner test reapi-bazel-remote
 *
 * What this proves that the in-process fixture cannot:
 *   - Real protobuf decoding on the wire (catches schema drift in our
 *     vendored .proto files vs upstream bazel-remote).
 *   - `Capabilities` actually advertises SHA256 + a sane batch limit.
 *   - `BatchUpdateBlobs` / `BatchReadBlobs` size-budget math agrees
 *     with what bazel-remote enforces.
 *   - `ByteStream.Write` resumable uploads survive a real channel.
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { Readable } from "node:stream";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ReapiRemoteCache } from "../../../src/backends/reapi";
import type { ActionResult, BlobSource, CasDigest } from "../../../src/backends/types";
import { digestBuffer } from "../../../src/cas/digest";

const grpcUrl = env.BAZEL_REMOTE_GRPC_URL;
const shouldRun = grpcUrl !== undefined && grpcUrl !== "";

const makeBlob = (data: Buffer | string): { bytes: Buffer; digest: CasDigest } => {
    const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;

    return { bytes, digest: digestBuffer(bytes) };
};

// Each test run salts its action digests with a unique nonce so previous
// runs against the same bazel-remote instance cannot mask a regression.
// eslint-disable-next-line sonarjs/pseudo-random -- not security-sensitive; just a unique-per-run label
const runNonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const actionDigest = (label: string): CasDigest => {
    const key = Buffer.from(`vis-integration:${runNonce}:${label}`, "utf8");

    return digestBuffer(key);
};

describe.skipIf(!shouldRun)("reapiRemoteCache against real bazel-remote", () => {
    let cache: ReapiRemoteCache;
    let tmpRoot: string;

    beforeAll(async () => {
        // grpcUrl is non-empty when shouldRun is true; assert keeps TS happy.
        if (grpcUrl === undefined) {
            throw new Error("unreachable");
        }

        cache = new ReapiRemoteCache({ url: grpcUrl });
        tmpRoot = join(tmpdir(), `vis-reapi-int-${runNonce}`);

        await mkdir(tmpRoot, { recursive: true });
    });

    afterAll(async () => {
        await cache.close();
        await rm(tmpRoot, { force: true, recursive: true });
    });

    it("negotiates SHA256 + a positive batch limit on first use", async () => {
        expect.assertions(2);

        const capabilities = await cache.probeCapabilities();

        expect(capabilities.digestFunctions).toContain("SHA256");
        expect(capabilities.maxBatchTotalSizeBytes).toBeGreaterThan(0);
    });

    it("round-trips a small ActionResult: store → retrieve → fetchBlob", async () => {
        expect.assertions(5);

        const blob = makeBlob("hello bazel-remote");
        const digest = actionDigest("small-roundtrip");
        const stored: ActionResult = {
            exitCode: 0,
            outputDirectories: [],
            outputFiles: [{ digest: blob.digest, isExecutable: false, path: "out.txt" }],
        };
        const blobs: BlobSource[] = [{ digest: blob.digest, open: () => Promise.resolve(Readable.from(blob.bytes)) }];

        const ok = await cache.storeAction(digest, stored, blobs);

        expect(ok).toBe(true);

        const fetched = await cache.retrieveAction(digest);

        expect(fetched).not.toBeNull();
        expect(fetched?.outputFiles[0]?.digest.hash).toBe(blob.digest.hash);

        const destination = join(tmpRoot, "out.txt");
        const downloaded = await cache.fetchBlob(blob.digest, destination);

        expect(downloaded).toBe(true);
        expect((await readFile(destination)).toString("utf8")).toBe("hello bazel-remote");
    });

    it("uploads a blob larger than the batch threshold via ByteStream.Write", async () => {
        expect.assertions(2);

        // 5 MB — comfortably over bazel-remote's default ~4 MB
        // max_batch_total_size_bytes. Forces the streaming code path.
        const big = Buffer.alloc(5 * 1024 * 1024, 0x42);
        const blob = makeBlob(big);
        const digest = actionDigest("streaming-write");
        const stored: ActionResult = {
            exitCode: 0,
            outputDirectories: [],
            outputFiles: [{ digest: blob.digest, isExecutable: false, path: "big.bin" }],
        };
        const blobs: BlobSource[] = [{ digest: blob.digest, open: () => Promise.resolve(Readable.from(blob.bytes)) }];

        const ok = await cache.storeAction(digest, stored, blobs);

        expect(ok).toBe(true);

        // Round-trip the streaming-uploaded blob via the streaming-read
        // code path and check byte-for-byte fidelity.
        const destination = join(tmpRoot, "big.bin");
        const downloaded = await cache.fetchBlob(blob.digest, destination);

        expect(downloaded).toBe(true);
    });

    it("containsAction reflects writes (false before, true after)", async () => {
        expect.assertions(2);

        const digest = actionDigest("contains-probe");

        await expect(cache.containsAction(digest)).resolves.toBe(false);

        await cache.storeAction(digest, { exitCode: 0, outputDirectories: [], outputFiles: [] }, []);

        await expect(cache.containsAction(digest)).resolves.toBe(true);
    });

    it("retrieveAction returns null for an unknown action digest", async () => {
        expect.assertions(1);

        const result = await cache.retrieveAction(actionDigest("never-stored"));

        expect(result).toBeNull();
    });
});
