use std::collections::BTreeMap;
use std::path::Path;

use rusqlite::{Connection, OpenFlags, params};

use super::range::matcher_for;
use super::schema::check_schema;

#[derive(Debug, Clone)]
pub struct QueryInput {
    pub ecosystem: String,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone)]
pub struct AdvisoryHit {
    pub name: String,
    pub version: String,
    pub vulnerabilities: Vec<NativeVulnerability>,
}

#[derive(Debug, Clone)]
pub struct NativeVulnerability {
    pub id: String,
    pub aliases: Vec<String>,
    pub severity: String,
    pub summary: String,
    pub fixed_versions: Vec<String>,
    pub cvss_score: Option<f64>,
}

#[derive(Debug)]
pub enum QueryError {
    Schema(super::schema::AdvisorySchemaError),
    Sqlite(rusqlite::Error),
    DbNotFound(String),
}

impl std::fmt::Display for QueryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Schema(e) => write!(f, "{e}"),
            Self::Sqlite(e) => match e {
                rusqlite::Error::SqliteFailure(err, _)
                    if err.code == rusqlite::ErrorCode::DatabaseCorrupt =>
                {
                    write!(f, "Advisory DB is corrupt. Run 'vis advisories sync --force'.")
                }
                rusqlite::Error::SqliteFailure(err, _)
                    if err.code == rusqlite::ErrorCode::DatabaseBusy
                        || err.code == rusqlite::ErrorCode::DatabaseLocked =>
                {
                    write!(f, "Advisory DB is busy. A 'vis advisories sync' may be in progress; retry shortly.")
                }
                rusqlite::Error::InvalidQuery | rusqlite::Error::InvalidParameterName(_) => {
                    write!(f, "Internal advisory query error: {e}. Please file a bug.")
                }
                _ => write!(f, "Advisory query failed: {e}"),
            },
            Self::DbNotFound(path) => {
                write!(f, "No local advisory DB at {path}. Run 'vis advisories sync' first.")
            }
        }
    }
}

impl std::error::Error for QueryError {}

impl From<super::schema::AdvisorySchemaError> for QueryError {
    fn from(e: super::schema::AdvisorySchemaError) -> Self {
        Self::Schema(e)
    }
}
impl From<rusqlite::Error> for QueryError {
    fn from(e: rusqlite::Error) -> Self {
        Self::Sqlite(e)
    }
}

pub fn query<P: AsRef<Path>>(
    db_path: P,
    queries: &[QueryInput],
) -> Result<Vec<AdvisoryHit>, QueryError> {
    let path = db_path.as_ref();
    if !path.exists() {
        return Err(QueryError::DbNotFound(path.display().to_string()));
    }

    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    check_schema(&conn)?;

    let mut stmt = conn.prepare(
        "SELECT a.id, a.summary, a.severity, a.cvss_score, f.introduced, f.fixed \
         FROM affected f \
         JOIN advisory a ON a.id = f.advisory_id \
         WHERE f.ecosystem = ?1 AND f.package = ?2",
    )?;
    let mut stmt_aliases =
        conn.prepare("SELECT alias FROM advisory_alias WHERE advisory_id = ?1")?;

    let mut results: Vec<AdvisoryHit> = Vec::with_capacity(queries.len());

    for q in queries {
        let matcher = match matcher_for(&q.ecosystem) {
            Some(m) => m,
            None => {
                results.push(AdvisoryHit {
                    name: q.name.clone(),
                    version: q.version.clone(),
                    vulnerabilities: Vec::new(),
                });
                continue;
            }
        };

        let package_norm = q.name.to_lowercase();
        let rows = stmt.query_map(params![q.ecosystem, package_norm], |row| {
            Ok((
                row.get::<_, String>(0)?,        // id
                row.get::<_, String>(1)?,        // summary
                row.get::<_, String>(2)?,        // severity
                row.get::<_, Option<f64>>(3)?,   // cvss_score
                row.get::<_, String>(4)?,        // introduced
                row.get::<_, Option<String>>(5)?, // fixed
            ))
        })?;

        // Group by advisory id so multiple ranges per advisory collapse into
        // one vulnerability entry whose `fixed_versions` enumerates the patches.
        let mut by_id: BTreeMap<String, NativeVulnerability> = BTreeMap::new();

        for row in rows {
            let (id, summary, severity, cvss_score, introduced, fixed) = row?;
            if !matcher.matches(&q.version, &introduced, fixed.as_deref()) {
                continue;
            }
            let entry = by_id.entry(id.clone()).or_insert_with(|| NativeVulnerability {
                id: id.clone(),
                aliases: Vec::new(),
                severity: severity.clone(),
                summary: summary.clone(),
                fixed_versions: Vec::new(),
                cvss_score,
            });
            if let Some(f) = fixed {
                if !entry.fixed_versions.contains(&f) {
                    entry.fixed_versions.push(f);
                }
            }
        }

        for (id, vuln) in by_id.iter_mut() {
            let aliases = stmt_aliases.query_map(params![id], |row| row.get::<_, String>(0))?;
            for alias in aliases {
                vuln.aliases.push(alias?);
            }
        }

        let vulnerabilities: Vec<NativeVulnerability> = by_id.into_values().collect();
        results.push(AdvisoryHit {
            name: q.name.clone(),
            version: q.version.clone(),
            vulnerabilities,
        });
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::advisories::schema::ensure_schema;
    use rusqlite::params;

    fn seed_db(path: &std::path::Path) {
        let conn = Connection::open(path).unwrap();
        ensure_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO advisory (id, summary, severity, cvss_score, published, modified) \
             VALUES ('GHSA-test', 'lodash prototype pollution', 'HIGH', 7.4, '2019-07-15T00:00:00Z', '2024-01-01T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO advisory_alias (advisory_id, alias) VALUES ('GHSA-test', 'CVE-2019-10744')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO affected (advisory_id, ecosystem, package, introduced, fixed, range_index) \
             VALUES ('GHSA-test', 'npm', 'lodash', '0', '4.17.12', 0)",
            [],
        )
        .unwrap();
    }

    #[test]
    fn query_hits_vulnerable_version() {
        let tmp = tempfile_path();
        seed_db(&tmp);

        let inputs = vec![QueryInput {
            ecosystem: "npm".into(),
            name: "lodash".into(),
            version: "4.17.10".into(),
        }];
        let hits = query(&tmp, &inputs).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].vulnerabilities.len(), 1);
        let v = &hits[0].vulnerabilities[0];
        assert_eq!(v.id, "GHSA-test");
        assert_eq!(v.aliases, vec!["CVE-2019-10744"]);
        assert_eq!(v.fixed_versions, vec!["4.17.12"]);
    }

    #[test]
    fn query_skips_patched_version() {
        let tmp = tempfile_path();
        seed_db(&tmp);

        let inputs = vec![QueryInput {
            ecosystem: "npm".into(),
            name: "lodash".into(),
            version: "4.17.12".into(),
        }];
        let hits = query(&tmp, &inputs).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].vulnerabilities.len(), 0);
    }

    #[test]
    fn query_missing_db_errors_clearly() {
        let tmp = std::env::temp_dir().join(format!(
            "vis-advisories-missing-{}.sqlite",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&tmp);
        let inputs = vec![QueryInput {
            ecosystem: "npm".into(),
            name: "x".into(),
            version: "1.0.0".into(),
        }];
        let err = query(&tmp, &inputs).unwrap_err();
        assert!(matches!(err, QueryError::DbNotFound(_)));
    }

    #[test]
    fn query_with_unknown_ecosystem_returns_empty() {
        let tmp = tempfile_path();
        seed_db(&tmp);

        let inputs = vec![QueryInput {
            ecosystem: "PyPI".into(),
            name: "lodash".into(),
            version: "4.17.10".into(),
        }];
        let hits = query(&tmp, &inputs).unwrap();
        assert_eq!(hits.len(), 1);
        assert!(hits[0].vulnerabilities.is_empty());
    }

    fn tempfile_path() -> std::path::PathBuf {
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("vis-advisories-test-{pid}-{nanos}.sqlite"));
        let _ = std::fs::remove_file(&path);
        path
    }
}
