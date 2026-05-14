//! Bloom-filter prefilter for OSV `MAL-*` (malicious-package) advisories.
//!
//! Decodes the v1 wire format produced by `endevco/osv-bloom`
//! (<https://github.com/endevco/osv-bloom>) and probes `(name, semver-major-bucket)`
//! pairs against it. Bloom hits are *probable* matches — callers must
//! escalate to an authoritative source (the offline OSV DB or the live
//! `/v1/querybatch` API) for `(name, version)` confirmation. False-positive
//! rate at the current dataset is ~0.1%.
//!
//! This module is NAPI-free so unit tests can run under plain `cargo test`.
//! The JS-facing bindings live in `osv_bloom_napi.rs`.

pub mod bucket;
pub mod decoder;
pub mod probe;

pub use bucket::{version_bucket, WILDCARD_BUCKET};
pub use decoder::BloomFilter;
pub use probe::contains;
