import { createDB } from "mysql-memory-server";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import defineWorkflow from "../src/define-workflow";
import createRuntime from "../src/runtime";
import type { SqlClient } from "../src/store/sql-store";
import SqlStore from "../src/store/sql-store";
import { makeRun } from "./_helpers/store-contract";

/**
 * Real-engine gate for the MySQL dialect, run against a genuine **MySQL 8.0**
 * spawned by [`mysql-memory-server`](https://www.npmjs.com/package/mysql-memory-server)
 * (no Docker, no external service). It downloads mysqld on first run, so it is
 * slow and skips gracefully when the binary cannot be fetched (e.g. offline CI).
 *
 * The connection sets the `FOUND_ROWS` flag so the lease's affected-rows check
 * counts matched (not changed) rows — without it an idempotent re-acquire would
 * spuriously report a miss.
 */
interface MysqlHarness {
    close: () => Promise<void>;
    store: SqlStore;
}

let harness: MysqlHarness | undefined;

beforeAll(async () => {
    // mysql-memory-server downloads/spawns mysqld, which is slow and unreliable on
    // Windows CI runners — skip there and let the pglite suite cover the SQL store.
    if (process.platform === "win32") {
        return;
    }

    try {
        const database = await createDB({ version: "8.0.x" });
        const connection = await mysql.createConnection({
            database: database.dbName,
            flags: ["FOUND_ROWS"],
            host: "127.0.0.1",
            port: database.port,
            user: database.username,
        });

        const client: SqlClient = {
            query: async (sql, parameters = []) => {
                const [result] = await connection.query(sql, parameters as unknown[]);

                if (Array.isArray(result)) {
                    return { rowCount: result.length, rows: result as Record<string, unknown>[] };
                }

                return { rowCount: (result as { affectedRows?: number }).affectedRows ?? 0, rows: [] };
            },
        };

        const store = new SqlStore(client, { dialect: "mysql" });

        await store.init();

        harness = {
            close: async () => {
                await connection.end();
                await database.stop();
            },
            store,
        };
    } catch {
        harness = undefined;
    }
}, 180_000);

afterAll(async () => {
    await harness?.close();
});

describe("SqlStore (mysql-memory-server / mysql)", () => {
    it("persists, queries due, and leases against real MySQL", async (context) => {
        if (!harness) {
            context.skip();

            return;
        }

        expect.assertions(6);

        const { store } = harness;

        await store.save(makeRun("m1", { eventName: "go", status: "waiting", wakeAt: 1000 }));

        await expect(store.load("m1")).resolves.toMatchObject({ eventName: "go", runId: "m1", status: "waiting", wakeAt: 1000 });
        await expect(store.due(2000, 10)).resolves.toContain("m1");

        await expect(store.acquire("m1", "t1", 60_000)).resolves.toBe(true);
        await expect(store.acquire("m1", "t2", 60_000)).resolves.toBe(false);

        await store.release("m1", "t1");

        await expect(store.acquire("m1", "t2", 60_000)).resolves.toBe(true);

        await store.delete("m1");

        await expect(store.load("m1")).resolves.toBeUndefined();
    });

    it("drives a workflow to completion across a sweep", async (context) => {
        if (!harness) {
            context.skip();

            return;
        }

        expect.assertions(2);

        const { store } = harness;
        const workflow = defineWorkflow({
            id: "mysql-flow",
            run: async (runContext) => {
                await runContext.sleep("nap", 1000);
                await runContext.step("done", () => "ok");
            },
        });

        const runtime = createRuntime({ store, workflows: [workflow] });
        const triggered = await runtime.trigger(workflow, {});

        expect(triggered.status).toBe("suspended");

        const [resumed] = await runtime.sweep(Date.now() + 2000);

        expect(resumed?.status).toBe("completed");
    });
});
