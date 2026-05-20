import type { TaskFingerprint } from "../fingerprint";

/**
 * Content-Addressable Storage digest. Mirrors REAPI's `Digest` message:
 * a content hash and the size in bytes of the addressed blob.
 *
 * The hash is the lowercase hex sha256 of the blob's raw bytes. Size is
 * the byte length of those bytes. Together they uniquely identify a CAS
 * entry across HTTP and gRPC (REAPI) backends.
 */
export interface CasDigest {
    /** Lowercase hex sha256 of the blob bytes. */
    hash: string;
    /** Size of the blob bytes, in bytes. */
    sizeBytes: number;
}

/**
 * Result of executing a single Action. Mirrors REAPI's `ActionResult`
 * shape, with a vis-specific `fingerprint` extension for auto-fingerprint
 * mode. Persisted as JSON locally; serialized as a protobuf over gRPC.
 *
 * Output paths are workspace-relative.
 */
export interface ActionResult {
    /** Process exit code from the cached run. */
    exitCode: number;

    /** Optional vis-specific fingerprint (auto-fingerprint mode). */
    fingerprint?: TaskFingerprint;

    /**
     * Per-output-directory entries. The `treeDigest` points to a CAS
     * blob that is itself a serialized REAPI `Tree` message describing
     * the directory hierarchy and its file digests.
     */
    outputDirectories: ReadonlyArray<{
        path: string;
        treeDigest: CasDigest;
    }>;

    /** Per-output-file entries. Workspace-relative paths. */
    outputFiles: ReadonlyArray<{
        digest: CasDigest;
        isExecutable: boolean;
        path: string;
    }>;

    /**
     * CAS digest of the captured stdout/stderr stream. Optional because
     * tasks with no output emit nothing. Most tasks emit at least
     * "Done in Xs", so dedup across tasks is real.
     */
    stdoutDigest?: CasDigest;
}

/**
 * Lazy handle for a CAS blob. Backends call `open()` only when they're
 * ready to stream the bytes — keeps memory flat for multi-hundred-MB
 * artifacts and avoids buffering blobs the server reports as already
 * present (REAPI `FindMissingBlobs`).
 */
export interface BlobSource {
    digest: CasDigest;
    open: () => Promise<NodeJS.ReadableStream>;
}

/**
 * Canonical cache-mode enum, replacing the original `read` / `write`
 * boolean pair. One flag, three values, no implicit env-detection.
 *
 * - `"read"`: Pull cache hits, never push. Default for local dev when
 *   developers shouldn't poison the shared cache.
 * - `"write"`: Push results, never read. Useful for refill / warm-up
 *   jobs that should always re-execute and re-upload.
 * - `"readwrite"`: Both. Default for CI.
 */
export type CacheMode = "read" | "readwrite" | "write";

/**
 * Compression algorithm used for artifact tarballs on the wire.
 *
 * - `"gzip"` (default): tar+gzip, matches Turborepo's protocol format
 *   and stays interop-safe with existing remote cache servers.
 * - `"brotli"`: tar + Node brotli (BROTLI_MODE_TEXT, quality 4) — a
 *   solid ratio/speed trade-off for source-tree tarballs. Both upload
 *   and download sides must agree; switching invalidates existing
 *   remote entries (they will simply re-populate on next run).
 *
 * HTTP-only — REAPI servers negotiate compression via the
 * `Capabilities` RPC + `grpc-encoding` metadata on the wire.
 */
export type RemoteCacheCompression = "brotli" | "gzip";

/**
 * HMAC signing configuration for the HTTP backend.
 *
 * When set, every upload carries an `X-Artifact-Signature` header
 * containing the HMAC-SHA256 digest of `hash | body`. On download,
 * the client recomputes the HMAC and rejects any artifact whose
 * signature doesn't match (constant-time comparison). REAPI servers
 * do not consume this — REAPI integrity rides on sha256
 * content-addressing instead.
 */
export interface RemoteCacheSigning {
    /** Shared secret. Must be at least 16 characters. */
    secret: string;

    /**
     * Reject downloads whose signature doesn't match or is missing.
     * Set to `true` once every upload on your server is signed.
     * @default false
     */
    verifyOnDownload?: boolean;
}

/**
 * Keyless artifact attestation hooks for the HTTP backend.
 *
 * Layered *above* {@link RemoteCacheSigning}: HMAC proves the bytes
 * weren't tampered with by anyone lacking the shared secret (integrity);
 * an attestation proves *who* produced them (authenticity — a Sigstore
 * keyless bundle in practice). Both can be active at once.
 *
 * task-runner stays dependency-free: it never imports Sigstore. The
 * caller (vis) supplies these callbacks; task-runner only moves the
 * opaque bundle string through the `X-Artifact-Attestation` header and
 * decides accept/reject from the boolean the verifier returns. REAPI
 * does not consume these — REAPI integrity rides on CAS content-
 * addressing, and authenticity is a server/transport concern there.
 */
export interface RemoteCacheAttestation {
    /**
     * Expected keyless signer identity. Serializable so it can live in
     * `vis.config.ts`. task-runner does not consume this — it is config
     * passthrough for the vis-side `verifyArtifact` hook, which must
     * enforce it. Without an expected identity a valid bundle from *any*
     * Fulcio identity over the same digest verifies (integrity, not
     * authenticity), so the vis hook treats "verify requested without an
     * expected identity" as a misconfiguration.
     *
     * Three forms (pick one):
     * - `{ github }` — GitHub Actions preset. Expands to the Fulcio
     *   issuer + an escaped, anchored SAN. The ergonomic default.
     * - `{ oidcIssuer, san }` — a *literal* signer identity. vis escapes
     *   and anchors it for you; pass the plain URI, not a regex.
     * - `{ oidcIssuer, sanRegex }` — advanced: a raw, unescaped regex.
     *   You own anchoring (sigstore-js matches via `String.match`).
     */
    expectedIdentity?:
        | {
            /**
             * GitHub Actions preset. Expands to issuer
             * `https://token.actions.githubusercontent.com` and the
             * anchored SAN `https://github.com/{repo}/{workflow}@{ref}`.
             */
            github: {
                /** Git ref the workflow ran on, e.g. `refs/heads/main` or `refs/tags/v1.2.3`. */
                ref: string;
                /** `owner/name`, e.g. `visulima/visulima`. */
                repo: string;
                /** Workflow path, e.g. `.github/workflows/release.yml`. */
                workflow: string;
            };
        }
        | {
            /** Fulcio cert issuer extension, matched exactly. */
            oidcIssuer: string;

            /**
             * Literal signer identity (certificate SAN). vis
             * regex-escapes and anchors this — pass the plain URI,
             * e.g. `https://github.com/org/repo/.github/workflows/ci.yml@refs/heads/main`.
             */
            san: string;
        }
        | {
            /** Fulcio cert issuer extension, matched exactly. */
            oidcIssuer: string;

            /**
             * Advanced: raw, unescaped SAN regex. You own anchoring
             * (`^…$`); an unanchored value is substring-matched.
             */
            sanRegex: string;
        };

    /**
     * Called when a download is rejected (or downgraded to a cache miss)
     * because its attestation is missing or failed verification. Without
     * this hook the rejection is silent. Mirrors `onUploadError`.
     */
    onReject?: (hash: string, reason: "invalid" | "missing") => void;

    /**
     * Reject downloads whose attestation is missing or fails
     * verification. With `verifyArtifact` set but this `false`, a bad
     * attestation is treated as a cache miss (re-execute) rather than a
     * hard failure.
     * @default false
     */
    requireOnDownload?: boolean;

    /**
     * Produce an opaque attestation bundle for the staged artifact,
     * called after the body is staged and before the PUT. Return `null`
     * to upload without an attestation (e.g. no ambient OIDC outside
     * CI). Any returned string is sent verbatim in the
     * `X-Artifact-Attestation` header.
     */
    signArtifact?: (input: { archivePath: string; hash: string }) => Promise<string | null>;

    /**
     * Verify a received attestation bundle against the staged artifact.
     * Resolve `false` to reject the cached entry. Only called when the
     * download carried an `X-Artifact-Attestation` header.
     */
    verifyArtifact?: (input: { archivePath: string; attestation: string; hash: string }) => Promise<boolean>;
}

/**
 * Canonical remote-cache configuration consumed by
 * `createRemoteCacheBackend`. Both `HttpRemoteCache` and
 * `ReapiRemoteCache` accept this shape directly — backend-specific
 * fields (e.g. `signing`, `compression` for HTTP; `bearerToken`,
 * `instanceName` for REAPI) are read by the corresponding constructor
 * and ignored by the other.
 *
 * Living in `backends/types.ts` rather than each backend file keeps a
 * single source of truth for `TaskRunnerOptions.remoteCache` and the
 * `vis-config` typed surface.
 */
export interface RemoteCacheOptions {
    /**
     * Opt out of the REAPI safety check that refuses to send a bearer
     * token over cleartext gRPC. Required only when the connection
     * terminates inside a trusted boundary (loopback dev cache, mesh
     * mTLS sidecar that strips/re-encrypts on the next hop). Default
     * `false` — production callers should reach for `grpcs://` first.
     *
     * REAPI-only.
     */
    allowInsecureBearer?: boolean;

    /**
     * HTTP-only: keyless artifact attestation hooks (Sigstore in
     * practice). Layered above `signing` — integrity vs authenticity.
     */
    attestation?: RemoteCacheAttestation;

    /**
     * Wire-protocol selector. `"http"` is the Turborepo-compatible
     * single-tarball cache; `"reapi"` switches to the Bazel Remote
     * Execution API gRPC client, unlocking `bazel-remote`,
     * BuildBuddy, BuildBarn, EngFlow as drop-in backends.
     * @default "http"
     */
    backend?: "http" | "reapi";

    /**
     * Bearer token sent in REAPI's `authorization: Bearer {token}`
     * gRPC metadata header. REAPI-only — HTTP backend uses `token`.
     */
    bearerToken?: string;

    /** HTTP-only: tarball compression on the wire. @default "gzip" */
    compression?: RemoteCacheCompression;

    /**
     * REAPI-only `instance_name` for multi-tenant servers (a single
     * gRPC endpoint can host multiple logical caches keyed on the
     * `instance_name` prefix).
     */
    instanceName?: string;

    /**
     * Local CAS root used by the per-blob {@link RemoteCacheBackend}
     * methods. The HTTP wire format is still single-tarball; on
     * retrieve the bridge extracts blobs into this root so a follow-up
     * `fetchBlob` is just a local read.
     */
    localCasRoot?: string;

    /**
     * Canonical cache mode flag.
     *
     * - `"read"`: Pull cache hits, never push. Sensible default for
     *   local dev so a developer doesn't poison the shared cache while
     *   their workspace is dirty.
     * - `"write"`: Push results, never read. Useful for refill /
     *   warm-up jobs that should always re-execute and re-upload.
     * - `"readwrite"`: Both. Default for CI.
     * @default "readwrite"
     */
    mode?: CacheMode;

    /**
     * Called when a fire-and-forget upload fails. Uploads are
     * non-blocking, so without this hook errors are silently dropped.
     * Provide it to log or report upload failures.
     */
    onUploadError?: (hash: string, error: unknown) => void;

    /** HTTP-only: HMAC-SHA256 signing for upload integrity. */
    signing?: RemoteCacheSigning;

    /** Team / namespace for cache isolation. */
    teamId?: string;

    /** Per-call request timeout in milliseconds. @default 30000 */
    timeout?: number;

    /**
     * HTTP authentication token sent as `Authorization: Bearer …`.
     * For REAPI, use `bearerToken` instead — same wire mechanic, but
     * a separate field so REAPI's cleartext-bearer guard can distinguish
     * "user explicitly opted into a gRPC token" from "user set HTTP
     * auth and accidentally selected the REAPI backend".
     */
    token?: string;

    /**
     * Cache server URL.
     *
     * - HTTP: `https://cache.example.com`
     * - REAPI: `grpcs://host:port` (TLS, recommended) or `grpc://host:port`
     *   (cleartext — bearer tokens are refused unless `allowInsecureBearer`).
     */
    url: string;
}

/**
 * Pluggable backend boundary for the remote cache. Implementations:
 * - `HttpRemoteCache`: Turborepo wire-protocol-compatible HTTP cache.
 *   Bridges the single-tarball protocol to per-blob semantics by
 *   synthesizing an `ActionResult` from the extracted tarball contents.
 * - `ReapiRemoteCache`: Bazel Remote Execution API gRPC client.
 *   Speaks `ActionCache` + `ContentAddressableStorage` services
 *   natively, unlocking bazel-remote / BuildBuddy / BuildBarn / EngFlow.
 */
export interface RemoteCacheBackend {
    /**
     * Release any persistent resources held by the backend (gRPC
     * channels, HTTP keep-alive agents). Safe to call multiple times
     * and safe to call when no work has been issued. Implementations
     * must not throw — close failures are best-effort.
     */
    close: () => Promise<void>;

    /**
     * HEAD-equivalent existence check. REAPI: `GetActionResult` with
     * `inline_*` fields disabled. HTTP: `HEAD /v8/artifacts/{hash}`.
     */
    containsAction: (actionDigest: CasDigest) => Promise<boolean>;

    /**
     * Stream a single CAS blob to disk. Returns `true` on success.
     * Used to materialize output files referenced by an `ActionResult`.
     */
    fetchBlob: (digest: CasDigest, destinationPath: string) => Promise<boolean>;

    /**
     * Look up an Action's cached result. Resolves to `null` on miss.
     * Implementations are responsible for fetching any CAS blobs the
     * caller needs to materialize the outputs (or returning enough
     * metadata for the caller to fetch them via `fetchBlob`).
     */
    retrieveAction: (actionDigest: CasDigest) => Promise<ActionResult | null>;

    /**
     * Persist an `ActionResult` and any blobs it references. Backends
     * must enforce blobs-before-AC ordering on the wire so a partial
     * failure cannot leave a cached result pointing at missing bytes.
     */
    storeAction: (actionDigest: CasDigest, result: ActionResult, blobs: ReadonlyArray<BlobSource>) => Promise<boolean>;
}
