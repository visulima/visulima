// eslint-disable-next-line n/no-unsupported-features/node-builtins -- node:sqlite is unflagged from Node 22.13, inside the ^22.14.0 engine range
import { DatabaseSync } from "node:sqlite";

// Same DDL the native reader creates (native/src/advisories/schema.rs). Seeding it directly keeps
// tests independent of the ingest path while still running the real native query against the file.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (ecosystem TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (ecosystem, key));
CREATE TABLE IF NOT EXISTS advisory (id TEXT PRIMARY KEY, summary TEXT NOT NULL, severity TEXT NOT NULL, cvss_score REAL, published TEXT NOT NULL, modified TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS advisory_alias (advisory_id TEXT NOT NULL REFERENCES advisory(id) ON DELETE CASCADE, alias TEXT NOT NULL, PRIMARY KEY (advisory_id, alias));
CREATE TABLE IF NOT EXISTS affected (advisory_id TEXT NOT NULL REFERENCES advisory(id) ON DELETE CASCADE, ecosystem TEXT NOT NULL, package TEXT NOT NULL, introduced TEXT NOT NULL, fixed TEXT, last_affected TEXT, range_index INTEGER NOT NULL, PRIMARY KEY (advisory_id, ecosystem, package, introduced, range_index));
INSERT OR IGNORE INTO meta (ecosystem, key, value) VALUES ('', 'schema_version', '2');
`;

export interface AdvisoryFixtureRow {
    advisoryId: string;
    /** Canonical ecosystem name as the native query compares it, e.g. `npm`, `crates.io`. */
    ecosystem: string;
    /** Fixed version, or `null` when no fix exists. */
    fixed: string | null;
    introduced: string;
    package: string;
    summary: string;
}

/** Create an advisory DB at `dbPath` holding one `affected` row per entry (each row adds its advisory). */
export const seedAdvisoryDb = (dbPath: string, rows: AdvisoryFixtureRow[]): void => {
    const db = new DatabaseSync(dbPath);

    db.exec(SCHEMA_SQL);

    const insertAdvisory = db.prepare("INSERT OR IGNORE INTO advisory (id, summary, severity, cvss_score, published, modified) VALUES (?, ?, 'HIGH', NULL, '', '')");
    const insertAffected = db.prepare("INSERT INTO affected (advisory_id, ecosystem, package, introduced, fixed, last_affected, range_index) VALUES (?, ?, ?, ?, ?, NULL, 0)");

    for (const row of rows) {
        insertAdvisory.run(row.advisoryId, row.summary);
        insertAffected.run(row.advisoryId, row.ecosystem, row.package, row.introduced, row.fixed);
    }

    db.close();
};
