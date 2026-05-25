use rusqlite::{params, Connection};

/// Schema version that this build of `vis-native` writes.
pub const NATIVE_KNOWN_VERSION: u32 = 1;
/// Oldest schema version this build can still read.
pub const MIN_SUPPORTED_VERSION: u32 = 1;

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS meta (
    ecosystem TEXT NOT NULL,
    key       TEXT NOT NULL,
    value     TEXT NOT NULL,
    PRIMARY KEY (ecosystem, key)
);

CREATE TABLE IF NOT EXISTS advisory (
    id           TEXT PRIMARY KEY,
    summary      TEXT NOT NULL,
    severity     TEXT NOT NULL,
    cvss_score   REAL,
    published    TEXT NOT NULL,
    modified     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS advisory_alias (
    advisory_id TEXT NOT NULL REFERENCES advisory(id) ON DELETE CASCADE,
    alias       TEXT NOT NULL,
    PRIMARY KEY (advisory_id, alias)
);
CREATE INDEX IF NOT EXISTS idx_alias_value ON advisory_alias(alias);

CREATE TABLE IF NOT EXISTS affected (
    advisory_id TEXT NOT NULL REFERENCES advisory(id) ON DELETE CASCADE,
    ecosystem   TEXT NOT NULL,
    package     TEXT NOT NULL,
    introduced  TEXT NOT NULL,
    fixed       TEXT,
    range_index INTEGER NOT NULL,
    PRIMARY KEY (advisory_id, ecosystem, package, introduced, range_index)
);
CREATE INDEX IF NOT EXISTS idx_affected_package ON affected(ecosystem, package);
"#;

#[derive(Debug)]
pub enum AdvisorySchemaError {
    TooOld { observed: u32 },
    TooNew { observed: u32 },
    Corrupt(String),
}

impl std::fmt::Display for AdvisorySchemaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TooOld { observed } => write!(
                f,
                "Advisory DB schema is v{observed}, this build of vis expects >= v{MIN_SUPPORTED_VERSION}. Run 'vis advisories sync --force'.",
            ),
            Self::TooNew { observed } => write!(
                f,
                "Advisory DB schema is v{observed}, this build of vis only knows up to v{NATIVE_KNOWN_VERSION}. Upgrade vis or run 'vis advisories sync --force' to rebuild.",
            ),
            Self::Corrupt(msg) => write!(f, "Advisory DB schema is unreadable: {msg}"),
        }
    }
}

impl std::error::Error for AdvisorySchemaError {}

/// Run CREATE TABLE IF NOT EXISTS on every table, then stamp the schema version.
///
/// Called by `ingest` before each sync. Query paths use [`check_schema`] instead so
/// they only ever read.
pub fn ensure_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(SCHEMA_SQL)?;
    conn.execute(
        "INSERT OR IGNORE INTO meta (ecosystem, key, value) VALUES ('', 'schema_version', ?1)",
        params![NATIVE_KNOWN_VERSION.to_string()],
    )?;
    Ok(())
}

pub fn read_schema_version(conn: &Connection) -> Result<u32, AdvisorySchemaError> {
    let value: Result<String, rusqlite::Error> =
        conn.query_row("SELECT value FROM meta WHERE ecosystem = '' AND key = 'schema_version'", [], |row| row.get(0));

    match value {
        Ok(s) => s.parse::<u32>().map_err(|e| AdvisorySchemaError::Corrupt(format!("non-numeric schema_version: {e}"))),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Err(AdvisorySchemaError::Corrupt("missing schema_version meta row".to_string()))
        }
        Err(e) => Err(AdvisorySchemaError::Corrupt(e.to_string())),
    }
}

pub fn check_schema(conn: &Connection) -> Result<(), AdvisorySchemaError> {
    let observed = read_schema_version(conn)?;
    if observed < MIN_SUPPORTED_VERSION {
        Err(AdvisorySchemaError::TooOld { observed })
    } else if observed > NATIVE_KNOWN_VERSION {
        Err(AdvisorySchemaError::TooNew { observed })
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_creates_tables_and_stamps_version() {
        let conn = Connection::open_in_memory().unwrap();
        ensure_schema(&conn).unwrap();
        let v = read_schema_version(&conn).unwrap();
        assert_eq!(v, NATIVE_KNOWN_VERSION);
        check_schema(&conn).unwrap();
    }

    #[test]
    fn check_rejects_too_new() {
        let conn = Connection::open_in_memory().unwrap();
        ensure_schema(&conn).unwrap();
        conn.execute("UPDATE meta SET value = '999' WHERE ecosystem = '' AND key = 'schema_version'", []).unwrap();
        let err = check_schema(&conn).unwrap_err();
        assert!(matches!(err, AdvisorySchemaError::TooNew { observed: 999 }));
    }

    #[test]
    fn check_rejects_too_old() {
        let conn = Connection::open_in_memory().unwrap();
        ensure_schema(&conn).unwrap();
        conn.execute("UPDATE meta SET value = '0' WHERE ecosystem = '' AND key = 'schema_version'", []).unwrap();
        let err = check_schema(&conn).unwrap_err();
        assert!(matches!(err, AdvisorySchemaError::TooOld { observed: 0 }));
    }
}
