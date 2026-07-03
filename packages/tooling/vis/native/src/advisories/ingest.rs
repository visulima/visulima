use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::time::Instant;

use rusqlite::{params, Connection};
use zip::ZipArchive;

use super::osv;
use super::schema::ensure_schema;

/// Per-entry uncompressed cap. Real OSV records are < 64 KiB; the cap is
/// generous to allow upstream growth without rebuild but tight enough to stop
/// a zip-bomb mirror.
pub const MAX_ENTRY_BYTES: u64 = 16 * 1024 * 1024;
/// Total uncompressed cap across all entries in one ingest call.
pub const MAX_TOTAL_BYTES: u64 = 4 * 1024 * 1024 * 1024;
/// Emit progress every N parsed advisories. Picked to keep the threadsafe
/// callback rate well under 1 kHz on a slow machine.
const PROGRESS_EVERY: usize = 5_000;

#[derive(Debug)]
pub struct IngestStats {
    pub advisories_ingested: usize,
    pub duration_ms: u128,
}

pub trait IngestProgress: Send {
    fn emit(&mut self, current: usize, total: usize);
}

impl<F> IngestProgress for F
where
    F: FnMut(usize, usize) + Send,
{
    fn emit(&mut self, current: usize, total: usize) {
        self(current, total)
    }
}

#[derive(Debug)]
pub enum IngestError {
    Io(std::io::Error),
    Zip(zip::result::ZipError),
    Sqlite(rusqlite::Error),
    Schema(super::schema::AdvisorySchemaError),
    OversizedEntry { name: String, observed: u64 },
    TotalSizeExceeded { observed: u64 },
    BadJson { entry: String, message: String },
}

impl std::fmt::Display for IngestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(e) => write!(f, "io error: {e}"),
            Self::Zip(e) => write!(f, "zip error: {e}"),
            Self::Sqlite(e) => write!(f, "sqlite error: {e}"),
            Self::Schema(e) => write!(f, "schema error: {e}"),
            Self::OversizedEntry { name, observed } => write!(
                f,
                "advisory zip entry '{name}' decompresses to {observed} bytes, exceeds MAX_ENTRY_BYTES ({MAX_ENTRY_BYTES}). Refusing to ingest (possible zip-bomb).",
            ),
            Self::TotalSizeExceeded { observed } => write!(
                f,
                "advisory zip total uncompressed size {observed} bytes exceeds MAX_TOTAL_BYTES ({MAX_TOTAL_BYTES}). Refusing to ingest.",
            ),
            Self::BadJson { entry, message } => {
                write!(f, "advisory '{entry}' failed JSON parse: {message}")
            }
        }
    }
}

impl std::error::Error for IngestError {}

impl From<std::io::Error> for IngestError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e)
    }
}
impl From<zip::result::ZipError> for IngestError {
    fn from(e: zip::result::ZipError) -> Self {
        Self::Zip(e)
    }
}
impl From<rusqlite::Error> for IngestError {
    fn from(e: rusqlite::Error) -> Self {
        Self::Sqlite(e)
    }
}
impl From<super::schema::AdvisorySchemaError> for IngestError {
    fn from(e: super::schema::AdvisorySchemaError) -> Self {
        Self::Schema(e)
    }
}

pub fn ingest<P: AsRef<Path>>(
    db_path: P,
    zip_path: P,
    ecosystem: &str,
    manifest_etag: Option<&str>,
    mut progress: impl IngestProgress,
) -> Result<IngestStats, IngestError> {
    let started = Instant::now();

    let mut conn = Connection::open(db_path.as_ref())?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    ensure_schema(&conn)?;

    let file = File::open(zip_path.as_ref())?;
    let mut archive = ZipArchive::new(file)?;
    let total = archive.len();

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;

    // §D step (d): delete this ecosystem's rows first, then GC orphan
    // advisories. Reversing the order would cascade-drop other ecosystems'
    // `affected` rows for the same advisory id.
    tx.execute("DELETE FROM affected WHERE ecosystem = ?1", params![ecosystem])?;
    tx.execute("DELETE FROM advisory WHERE id NOT IN (SELECT advisory_id FROM affected)", [])?;

    let mut ingested = 0usize;
    let mut total_bytes = 0u64;

    {
        let mut insert_adv = tx.prepare(
            "INSERT OR REPLACE INTO advisory (id, summary, severity, cvss_score, published, modified) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )?;
        let mut insert_alias =
            tx.prepare("INSERT OR IGNORE INTO advisory_alias (advisory_id, alias) VALUES (?1, ?2)")?;
        let mut insert_affected = tx.prepare(
            "INSERT OR REPLACE INTO affected (advisory_id, ecosystem, package, introduced, fixed, range_index) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )?;

        for i in 0..total {
            let mut entry = archive.by_index(i)?;
            if !entry.is_file() {
                continue;
            }
            let size = entry.size();
            if size > MAX_ENTRY_BYTES {
                return Err(IngestError::OversizedEntry { name: entry.name().to_string(), observed: size });
            }
            total_bytes = total_bytes.saturating_add(size);
            if total_bytes > MAX_TOTAL_BYTES {
                return Err(IngestError::TotalSizeExceeded { observed: total_bytes });
            }

            let mut buf = Vec::with_capacity(size as usize);
            entry.read_to_end(&mut buf)?;

            let advisory: osv::Advisory = serde_json::from_slice(&buf)
                .map_err(|e| IngestError::BadJson { entry: entry.name().to_string(), message: e.to_string() })?;

            let (severity, cvss_score) = osv::normalized_severity(&advisory);
            let published = advisory.published.clone().unwrap_or_default();
            let modified = advisory.modified.clone().unwrap_or_default();

            insert_adv.execute(params![advisory.id, advisory.summary, severity, cvss_score, published, modified,])?;

            for alias in &advisory.aliases {
                insert_alias.execute(params![advisory.id, alias])?;
            }

            // range_index is monotonic per (advisory, ecosystem, package) so
            // overlapping ranges don't collide on the PK.
            let mut per_package: HashMap<(String, String), i64> = HashMap::new();
            for affected in &advisory.affected {
                if !affected.package.ecosystem.eq_ignore_ascii_case(ecosystem) {
                    continue;
                }
                let package_norm = affected.package.name.to_lowercase();
                for range in &affected.ranges {
                    if range.kind != "SEMVER" && range.kind != "ECOSYSTEM" {
                        continue;
                    }
                    for pair in range.to_pairs() {
                        let key = (affected.package.ecosystem.clone(), package_norm.clone());
                        let idx = per_package.entry(key).or_insert(0);
                        let range_index = *idx;
                        *idx += 1;

                        insert_affected.execute(params![
                            advisory.id,
                            ecosystem,
                            package_norm,
                            pair.introduced,
                            pair.fixed,
                            range_index,
                        ])?;
                    }
                }
            }

            ingested += 1;
            if ingested % PROGRESS_EVERY == 0 {
                progress.emit(ingested, total);
            }
        }
    }

    let now_iso = chrono_iso_now();
    upsert_meta(&tx, ecosystem, "last_sync_iso", &now_iso)?;
    upsert_meta(&tx, ecosystem, "advisory_count", &ingested.to_string())?;
    if let Some(etag) = manifest_etag {
        upsert_meta(&tx, ecosystem, "manifest_etag", etag)?;
    }

    tx.commit()?;
    conn.execute("ANALYZE", [])?;

    progress.emit(ingested, total);

    let _ = std::fs::remove_file(zip_path.as_ref());

    Ok(IngestStats { advisories_ingested: ingested, duration_ms: started.elapsed().as_millis() })
}

fn upsert_meta(conn: &Connection, ecosystem: &str, key: &str, value: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO meta (ecosystem, key, value) VALUES (?1, ?2, ?3) \
         ON CONFLICT(ecosystem, key) DO UPDATE SET value = excluded.value",
        params![ecosystem, key, value],
    )?;
    Ok(())
}

/// Avoid adding a chrono dependency for a single ISO-8601 timestamp; the format
/// `YYYY-MM-DDTHH:MM:SSZ` is well-defined and we don't need sub-second precision.
fn chrono_iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    format_iso8601(secs)
}

fn format_iso8601(unix_secs: u64) -> String {
    // days since epoch + seconds-of-day. Algorithm: Howard Hinnant's date.h
    // (public domain). Good for the 1970–9999 range.
    let days = (unix_secs / 86_400) as i64;
    let sod = unix_secs % 86_400;
    let z = days + 719_468;
    let era = if z >= 0 { z / 146_097 } else { (z - 146_096) / 146_097 };
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    let hour = sod / 3600;
    let minute = (sod % 3600) / 60;
    let second = sod % 60;
    format!("{year:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", m, d, hour, minute, second)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso8601_known_epoch_seconds() {
        // 2024-01-15T12:34:56Z = 1705322096
        assert_eq!(format_iso8601(1_705_322_096), "2024-01-15T12:34:56Z");
        // 1970-01-01T00:00:00Z = 0
        assert_eq!(format_iso8601(0), "1970-01-01T00:00:00Z");
    }
}
