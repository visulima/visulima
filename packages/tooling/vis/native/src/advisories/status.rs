use std::path::Path;

use rusqlite::{Connection, OpenFlags, params};

use super::schema::{NATIVE_KNOWN_VERSION, read_schema_version};

#[derive(Debug)]
pub struct DbStatus {
    pub exists: bool,
    pub schema_version: u32,
    pub size_bytes: u64,
    pub ecosystems: Vec<EcosystemStatus>,
}

#[derive(Debug)]
pub struct EcosystemStatus {
    pub name: String,
    pub advisory_count: u64,
    pub last_sync_iso: String,
    /// HTTP ETag stored at the last sync. Used to short-circuit re-downloads.
    /// `None` when the server never sent one (or the meta row is missing).
    pub manifest_etag: Option<String>,
}

pub fn status<P: AsRef<Path>>(db_path: P) -> Result<DbStatus, rusqlite::Error> {
    let path = db_path.as_ref();
    if !path.exists() {
        return Ok(DbStatus {
            exists: false,
            schema_version: 0,
            size_bytes: 0,
            ecosystems: Vec::new(),
        });
    }

    let size_bytes = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    let schema_version = read_schema_version(&conn).unwrap_or(NATIVE_KNOWN_VERSION);

    let mut stmt = conn.prepare(
        "SELECT DISTINCT ecosystem FROM meta WHERE ecosystem != '' ORDER BY ecosystem",
    )?;
    let names = stmt.query_map([], |row| row.get::<_, String>(0))?;

    let mut ecosystems = Vec::new();
    for name in names {
        let name = name?;
        let advisory_count: u64 = conn
            .query_row(
                "SELECT value FROM meta WHERE ecosystem = ?1 AND key = 'advisory_count'",
                params![name],
                |row| row.get::<_, String>(0),
            )
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let last_sync_iso: String = conn
            .query_row(
                "SELECT value FROM meta WHERE ecosystem = ?1 AND key = 'last_sync_iso'",
                params![name],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_default();
        let manifest_etag: Option<String> = conn
            .query_row(
                "SELECT value FROM meta WHERE ecosystem = ?1 AND key = 'manifest_etag'",
                params![name],
                |row| row.get::<_, String>(0),
            )
            .ok();
        ecosystems.push(EcosystemStatus {
            name,
            advisory_count,
            last_sync_iso,
            manifest_etag,
        });
    }

    Ok(DbStatus {
        exists: true,
        schema_version,
        size_bytes,
        ecosystems,
    })
}
