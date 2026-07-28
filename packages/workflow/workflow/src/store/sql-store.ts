/* eslint-disable unicorn/no-null -- SQL drivers require `null` (not `undefined`) to bind a SQL NULL */
import WorkflowError from "../errors";
import type { RunStatus } from "../types";
import type { StoredRun, WorkflowStore } from "./types";

/** A safe SQL identifier: a leading letter/underscore followed by letters, digits or underscores. */
const IDENTIFIER_PATTERN = /^[A-Z_]\w*$/i;

/** SQL dialect the store renders for. */
type SqlDialect = "mysql" | "postgres";

/** The shape returned by {@link SqlClient.query}: result rows plus a matched/affected count. */
interface SqlResult {
    /**
     * Rows matched by the statement. For `UPDATE`, this MUST be the *matched* count,
     * not the *changed* count — on MySQL connect with the `FOUND_ROWS` client flag so
     * an idempotent re-acquire of the same lease still reports a hit.
     */
    rowCount: number;
    rows: Record<string, unknown>[];
}

/**
 * Minimal structural view of a SQL client. Adapt your driver (node-postgres,
 * postgres.js, mysql2, pglite, …) to this single async method; the store needs
 * nothing else, so it stays driver-agnostic with no hard dependency.
 */
interface SqlClient {
    query: (sql: string, parameters?: ReadonlyArray<unknown>) => Promise<SqlResult>;
}

/** Options for {@link SqlStore}. */
interface SqlStoreOptions {
    /** SQL dialect to render. Defaults to `"postgres"`. */
    dialect?: SqlDialect;
    /** Table name. Defaults to `"workflow_runs"`. */
    table?: string;
}

const DUE_STATUSES: RunStatus[] = ["suspended", "waiting"];

/** Rewrite `?` placeholders to PostgreSQL's `$1, $2, …` form. */
const toNumberedPlaceholders = (sql: string): string => {
    let index = 0;

    return sql.replaceAll("?", () => {
        index += 1;

        return `$${String(index)}`;
    });
};

/**
 * {@link WorkflowStore} backed by a SQL database (PostgreSQL or MySQL), with a
 * genuinely-atomic cross-process lease (a single conditional `UPDATE`), making it
 * safe for multiple runtime instances against one shared database.
 *
 * The store is driver-agnostic — pass any client adapted to {@link SqlClient}.
 * Call {@link SqlStore.init} once (or rely on lazy initialisation) to create the
 * table. Run state is stored as JSON text, so no JSON column type is required.
 */
class SqlStore implements WorkflowStore {
    readonly #client: SqlClient;

    readonly #dialect: SqlDialect;

    readonly #table: string;

    #ensured: Promise<unknown> | undefined;

    public constructor(client: SqlClient, options: SqlStoreOptions = {}) {
        this.#client = client;
        this.#dialect = options.dialect ?? "postgres";
        this.#table = options.table ?? "workflow_runs";

        if (!IDENTIFIER_PATTERN.test(this.#table)) {
            throw new WorkflowError(
                "invalid-option",
                `table must be a valid SQL identifier (a letter or underscore followed by letters, digits or underscores). Received: ${JSON.stringify(this.#table)}.`,
            );
        }
    }

    /** Create the backing table if it does not exist. Idempotent; called lazily by every operation. */
    public async init(): Promise<void> {
        this.#ensured ??= this.#run(this.#createTableSql());

        await this.#ensured;
    }

    public async save(run: StoredRun): Promise<void> {
        await this.init();

        const columns = "run_id, definition_id, status, wake_at, event_name, snapshot, updated_at";
        const values = [run.runId, run.definitionId, run.status, run.wakeAt ?? null, run.eventName ?? null, JSON.stringify(run.snapshot), run.updatedAt];

        await this.#run(`INSERT INTO ${this.#tableRef()} (${columns}) VALUES (?, ?, ?, ?, ?, ?, ?) ${this.#upsertClause()}`, values);
    }

    public async load(runId: string): Promise<StoredRun | undefined> {
        await this.init();

        const result = await this.#run(
            `SELECT run_id, definition_id, status, wake_at, event_name, snapshot, updated_at FROM ${this.#tableRef()} WHERE run_id = ?`,
            [runId],
        );
        const row = result.rows[0];

        if (row === undefined) {
            return undefined;
        }

        return {
            definitionId: row.definition_id as string,
            eventName: row.event_name == null ? undefined : (row.event_name as string),
            runId: row.run_id as string,
            snapshot: JSON.parse(row.snapshot as string),
            status: row.status as RunStatus,
            updatedAt: Number(row.updated_at),
            wakeAt: row.wake_at == null ? undefined : Number(row.wake_at),
        };
    }

    public async delete(runId: string): Promise<void> {
        await this.init();
        await this.#run(`DELETE FROM ${this.#tableRef()} WHERE run_id = ?`, [runId]);
    }

    public async due(now: number, limit: number): Promise<string[]> {
        await this.init();

        const placeholders = DUE_STATUSES.map(() => "?").join(", ");
        const result = await this.#run(
            `SELECT run_id FROM ${this.#tableRef()} WHERE status IN (${placeholders}) AND wake_at IS NOT NULL AND wake_at <= ? ORDER BY wake_at ASC LIMIT ?`,
            [...DUE_STATUSES, now, limit],
        );

        return result.rows.map((row) => row.run_id as string);
    }

    public async acquire(runId: string, token: string, ttlMs: number): Promise<boolean> {
        await this.init();

        const now = Date.now();
        // Single atomic conditional UPDATE: claim the run iff it is unleased, the lease
        // has expired, or we already hold it. `rowCount` is the matched-row count.
        const result = await this.#run(
            `UPDATE ${this.#tableRef()} SET lease_token = ?, lease_expires = ? WHERE run_id = ? AND (lease_token IS NULL OR lease_expires < ? OR lease_token = ?)`,
            [token, now + ttlMs, runId, now, token],
        );

        return result.rowCount === 1;
    }

    public async release(runId: string, token: string): Promise<void> {
        await this.init();
        await this.#run(`UPDATE ${this.#tableRef()} SET lease_token = NULL, lease_expires = NULL WHERE run_id = ? AND lease_token = ?`, [runId, token]);
    }

    #tableRef(): string {
        return this.#dialect === "postgres" ? `"${this.#table}"` : `\`${this.#table}\``;
    }

    #upsertClause(): string {
        if (this.#dialect === "postgres") {
            return `ON CONFLICT (run_id) DO UPDATE SET definition_id = EXCLUDED.definition_id, status = EXCLUDED.status, wake_at = EXCLUDED.wake_at, event_name = EXCLUDED.event_name, snapshot = EXCLUDED.snapshot, updated_at = EXCLUDED.updated_at`;
        }

        return `ON DUPLICATE KEY UPDATE definition_id = VALUES(definition_id), status = VALUES(status), wake_at = VALUES(wake_at), event_name = VALUES(event_name), snapshot = VALUES(snapshot), updated_at = VALUES(updated_at)`;
    }

    #createTableSql(): string {
        if (this.#dialect === "postgres") {
            return `CREATE TABLE IF NOT EXISTS ${this.#tableRef()} (run_id TEXT PRIMARY KEY, definition_id TEXT NOT NULL, status TEXT NOT NULL, wake_at BIGINT, event_name TEXT, snapshot TEXT NOT NULL, updated_at BIGINT NOT NULL, lease_token TEXT, lease_expires BIGINT)`;
        }

        return `CREATE TABLE IF NOT EXISTS ${this.#tableRef()} (run_id VARCHAR(255) PRIMARY KEY, definition_id VARCHAR(255) NOT NULL, status VARCHAR(32) NOT NULL, wake_at BIGINT, event_name VARCHAR(255), snapshot LONGTEXT NOT NULL, updated_at BIGINT NOT NULL, lease_token VARCHAR(255), lease_expires BIGINT)`;
    }

    /** Render `?` placeholders to the dialect's style and run the statement. */
    async #run(sql: string, parameters: ReadonlyArray<unknown> = []): Promise<SqlResult> {
        return this.#client.query(this.#dialect === "postgres" ? toNumberedPlaceholders(sql) : sql, parameters);
    }
}

export type { SqlClient, SqlDialect, SqlResult, SqlStoreOptions };
export default SqlStore;
