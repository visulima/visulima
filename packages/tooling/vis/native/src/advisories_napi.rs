//! NAPI bindings for the advisories module.
//!
//! Kept in a dedicated file (not folded into `advisories/`) so the pure-Rust
//! module stays NAPI-free and unit-testable without spinning up a JS engine.

use std::sync::{Arc, Mutex};

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;

use crate::advisories::{
    self, ingest::IngestProgress, query::NativeVulnerability, AdvisoryHit, DbStatus, EcosystemStatus, QueryInput,
    NATIVE_KNOWN_VERSION,
};

#[napi(object)]
pub struct AdvisoryIngestOptions {
    /// Path to a previously-downloaded OSV dump zip on disk.
    pub zip_path: String,
    pub db_path: String,
    pub ecosystem: String,
    /// HTTP ETag header to write into the `manifest_etag` meta row for this
    /// ecosystem. `null` when the server didn't send one.
    pub manifest_etag: Option<String>,
}

#[napi(object)]
pub struct AdvisoryIngestResult {
    pub advisories_ingested: u32,
    pub duration_ms: u32,
}

#[napi(object)]
pub struct AdvisoryQuery {
    pub ecosystem: String,
    pub name: String,
    pub version: String,
}

#[napi(object)]
pub struct NativeVulnerabilityJs {
    pub id: String,
    pub aliases: Vec<String>,
    /// Normalized severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "UNKNOWN".
    pub severity: String,
    pub summary: String,
    pub fixed_versions: Vec<String>,
    pub cvss_score: Option<f64>,
}

#[napi(object)]
pub struct AdvisoryQueryResult {
    pub name: String,
    pub version: String,
    pub vulnerabilities: Vec<NativeVulnerabilityJs>,
}

#[napi(object)]
pub struct AdvisoryEcosystemStatus {
    pub name: String,
    pub advisory_count: u32,
    pub last_sync_iso: String,
    pub manifest_etag: Option<String>,
}

#[napi(object)]
pub struct AdvisoryDbStatus {
    pub exists: bool,
    pub ecosystems: Vec<AdvisoryEcosystemStatus>,
    pub size_bytes: u32,
    pub schema_version: u32,
}

/// Ingest one OSV ecosystem dump into the local SQLite. Async because the
/// zip → JSON → INSERT pipeline can take seconds; we run it on a libuv worker
/// so the main JS thread is free.
#[napi]
pub async fn advisories_ingest(
    options: AdvisoryIngestOptions,
    #[napi(ts_arg_type = "(current: number, total: number) => void")] on_progress: ThreadsafeFunction<ProgressPayload>,
) -> Result<AdvisoryIngestResult> {
    let zip_path = options.zip_path;
    let db_path = options.db_path;
    let ecosystem = options.ecosystem;
    let etag = options.manifest_etag;

    // Move the threadsafe fn into a small struct that implements the pure-Rust
    // IngestProgress trait. Wrapping in Arc<Mutex<_>> lets the closure live for
    // 'static while still being called from any thread.
    struct Bridge {
        cb: Arc<Mutex<Option<ThreadsafeFunction<ProgressPayload>>>>,
    }
    impl IngestProgress for Bridge {
        fn emit(&mut self, current: usize, total: usize) {
            if let Ok(guard) = self.cb.lock() {
                if let Some(cb) = guard.as_ref() {
                    cb.call(
                        Ok(ProgressPayload { current: current as u32, total: total as u32 }),
                        ThreadsafeFunctionCallMode::NonBlocking,
                    );
                }
            }
        }
    }

    let bridge = Bridge { cb: Arc::new(Mutex::new(Some(on_progress))) };

    // The ingest pipeline (zip → JSON → INSERT) is blocking but we're already
    // on a napi async worker, not the JS thread. Call directly.
    let result = advisories::ingest(
        std::path::PathBuf::from(&db_path),
        std::path::PathBuf::from(&zip_path),
        &ecosystem,
        etag.as_deref(),
        bridge,
    )
    .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(AdvisoryIngestResult {
        advisories_ingested: result.advisories_ingested as u32,
        duration_ms: result.duration_ms as u32,
    })
}

/// Synchronous query path. Returns one `AdvisoryQueryResult` per input,
/// preserving order, so callers can zip back to their lockfile rows by index.
#[napi]
pub fn advisories_query(db_path: String, queries: Vec<AdvisoryQuery>) -> Result<Vec<AdvisoryQueryResult>> {
    let inputs: Vec<QueryInput> =
        queries.into_iter().map(|q| QueryInput { ecosystem: q.ecosystem, name: q.name, version: q.version }).collect();

    let hits: Vec<AdvisoryHit> = advisories::query(&db_path, &inputs).map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(hits.into_iter().map(hit_to_js).collect())
}

#[napi]
pub fn advisories_status(db_path: String) -> Result<AdvisoryDbStatus> {
    let status: DbStatus =
        advisories::status(&db_path).map_err(|e| Error::from_reason(format!("Advisory status read failed: {e}")))?;

    Ok(AdvisoryDbStatus {
        exists: status.exists,
        ecosystems: status.ecosystems.into_iter().map(eco_to_js).collect(),
        // Clamp to u32::MAX (~4 GB) so the value fits a JS Number without
        // precision loss. The advisory DB is single-digit MB in practice.
        size_bytes: status.size_bytes.min(u32::MAX as u64) as u32,
        schema_version: status.schema_version,
    })
}

#[napi(object)]
pub struct ProgressPayload {
    pub current: u32,
    pub total: u32,
}

fn hit_to_js(hit: AdvisoryHit) -> AdvisoryQueryResult {
    AdvisoryQueryResult {
        name: hit.name,
        version: hit.version,
        vulnerabilities: hit.vulnerabilities.into_iter().map(vuln_to_js).collect(),
    }
}

fn vuln_to_js(v: NativeVulnerability) -> NativeVulnerabilityJs {
    NativeVulnerabilityJs {
        id: v.id,
        aliases: v.aliases,
        severity: v.severity,
        summary: v.summary,
        fixed_versions: v.fixed_versions,
        cvss_score: v.cvss_score,
    }
}

fn eco_to_js(e: EcosystemStatus) -> AdvisoryEcosystemStatus {
    AdvisoryEcosystemStatus {
        name: e.name,
        // Clamp to u32::MAX for JS Number compatibility; per-ecosystem
        // advisory counts are in the low tens of thousands today.
        advisory_count: e.advisory_count.min(u32::MAX as u64) as u32,
        last_sync_iso: e.last_sync_iso,
        manifest_etag: e.manifest_etag,
    }
}

/// Re-export so doc tooling sees the value next to the binding constant.
pub const NATIVE_BINDING_VERSION_HINT: u32 = NATIVE_KNOWN_VERSION;
