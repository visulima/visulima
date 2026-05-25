//! NAPI bindings for the `osv_bloom` module.
//!
//! Kept in a dedicated file (mirroring `advisories_napi.rs`) so the pure-
//! Rust `osv_bloom/` module stays NAPI-free and unit-testable without
//! spinning up a JS engine. JS calls the four `#[napi]` entry points
//! below; the bitset and decoded header live in a handle managed via
//! the napi-rs `External<T>` wrapper so we don't re-decode on every probe.

use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::osv_bloom::{contains, version_bucket, BloomFilter, WILDCARD_BUCKET};

/// Opaque handle wrapping a decoded `BloomFilter`. JS calls back into
/// `osv_bloom_probe` / `osv_bloom_probe_batch` with this handle. Arc so
/// the same filter can fan out to multiple probe calls without copying
/// the bitset.
#[napi]
pub struct OsvBloomHandle {
    pub(crate) inner: Arc<BloomFilter>,
}

#[napi]
impl OsvBloomHandle {
    /// `n` field from the filter header — entry count the upstream
    /// builder inserted. Exposed for `vis advisories bloom status`.
    #[napi(getter)]
    pub fn entries_inserted(&self) -> u32 {
        self.inner.n
    }

    /// `m` field — bit count. Returned as a decimal string so the full
    /// u64 round-trips without JS-Number precision loss; today's filter
    /// is ~3.1M bits but the wire format reserves 64-bit headroom.
    #[napi(getter)]
    pub fn bit_count_string(&self) -> String {
        self.inner.m.to_string()
    }

    /// `k` field — hash-function count per probe.
    #[napi(getter)]
    pub fn hash_count(&self) -> u32 {
        self.inner.k
    }

    /// `built_at_unix_seconds` — UNIX seconds the upstream builder
    /// recorded, as a decimal string. JS reconstructs via
    /// `new Date(Number(s) * 1000)`. Use this in status output rather
    /// than the local fetch time.
    #[napi(getter)]
    pub fn built_at_unix_seconds_string(&self) -> String {
        self.inner.built_at_unix_seconds.to_string()
    }

    /// `format_version` — currently 1. Surfaced so JS can flag a
    /// version-mismatch warning without re-decoding.
    #[napi(getter)]
    pub fn format_version(&self) -> u32 {
        self.inner.format_version
    }
}

/// Decode a v1 osv-bloom filter from `bytes` (the on-disk `filter.bin`).
/// Returns an opaque handle; reuse it for every probe call until the
/// JS-side cache invalidates.
#[napi]
pub fn osv_bloom_decode(bytes: Buffer) -> Result<OsvBloomHandle> {
    let filter =
        BloomFilter::decode(bytes.as_ref()).map_err(|e| Error::from_reason(format!("osv-bloom decode failed: {e}")))?;

    Ok(OsvBloomHandle { inner: Arc::new(filter) })
}

/// Probe a single `(name, version)` pair. Returns `true` when the pair
/// *might* be a known-malicious advisory — callers must escalate to an
/// authoritative source for `(name, version)` confirmation.
///
/// The version is encoded into a semver-major bucket per the upstream
/// scheme; the wildcard bucket is also probed so advisories with
/// unbounded ranges still match. Unparseable versions probe only the
/// wildcard bucket.
#[napi]
pub fn osv_bloom_probe(handle: &OsvBloomHandle, name: String, version: String) -> bool {
    probe_with_wildcard(&handle.inner, &name, &version)
}

#[napi(object)]
pub struct OsvBloomBatchQuery {
    pub name: String,
    pub version: String,
}

#[napi(object)]
pub struct OsvBloomBatchHit {
    /// Index into the input batch array. Lets JS reconstruct which
    /// lockfile row triggered the hit without re-walking the inputs.
    pub index: u32,
    pub name: String,
    pub version: String,
}

/// Batch variant. Returns only the hits, with their original index — the
/// expected hit rate is well under 1%, so allocating one bool per input
/// (`Vec<bool>` of length N) would dominate the cost. Order of returned
/// hits matches input order.
#[napi]
pub fn osv_bloom_probe_batch(handle: &OsvBloomHandle, queries: Vec<OsvBloomBatchQuery>) -> Vec<OsvBloomBatchHit> {
    let filter = handle.inner.as_ref();
    let mut hits = Vec::new();

    for (index, query) in queries.into_iter().enumerate() {
        if probe_with_wildcard(filter, &query.name, &query.version) {
            hits.push(OsvBloomBatchHit {
                index: u32::try_from(index).unwrap_or(u32::MAX),
                name: query.name,
                version: query.version,
            });
        }
    }

    hits
}

/// Probe both the version's major-bucket *and* the wildcard bucket.
/// Upstream emits wildcard entries for advisories whose `introduced: "0"`
/// covers every version, so callers that only probe the version bucket
/// would miss them. Unparseable versions fall back to wildcard-only.
fn probe_with_wildcard(filter: &BloomFilter, name: &str, version: &str) -> bool {
    if let Some(bucket) = version_bucket(version) {
        if contains(filter, name, &bucket) {
            return true;
        }
    }

    contains(filter, name, WILDCARD_BUCKET)
}
