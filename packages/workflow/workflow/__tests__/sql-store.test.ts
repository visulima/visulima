import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";

import defineWorkflow from "../src/define-workflow";
import createRuntime from "../src/runtime";
import type { SqlClient } from "../src/store/sql-store";
import SqlStore from "../src/store/sql-store";
import { runStoreContract } from "./_helpers/store-contract";

interface PgliteResult {
    affectedRows?: number;
    rows: Record<string, unknown>[];
}

/** Adapt a real embedded Postgres (pglite) to the structural {@link SqlClient}. */
const createPgliteStore = async (): Promise<{ close: () => Promise<void>; store: SqlStore }> => {
    const database = new PGlite();

    await database.waitReady;

    const client: SqlClient = {
        query: async (sql, parameters = []) => {
            const result = (await database.query(sql, parameters as unknown[])) as PgliteResult;

            return { rowCount: result.affectedRows ?? result.rows.length, rows: result.rows };
        },
    };

    return { close: () => database.close(), store: new SqlStore(client, { dialect: "postgres" }) };
};

runStoreContract("SqlStore (pglite / postgres)", () => createPgliteStore());

describe("SqlStore constructor", () => {
    const noopClient: SqlClient = { query: () => Promise.resolve({ rowCount: 0, rows: [] }) };

    it("rejects a table name that is not a safe SQL identifier", () => {
        expect.assertions(3);

        expect(() => new SqlStore(noopClient, { table: 'runs"; DROP TABLE users; --' })).toThrow("valid SQL identifier");
        expect(() => new SqlStore(noopClient, { table: "with space" })).toThrow("valid SQL identifier");
        expect(() => new SqlStore(noopClient, { table: "back`tick" })).toThrow("valid SQL identifier");
    });

    it("accepts a plain identifier table name", () => {
        expect.assertions(1);

        expect(() => new SqlStore(noopClient, { table: "workflow_runs_2" })).not.toThrow();
    });
});

describe("SqlStore with a runtime (pglite / postgres)", () => {
    it("persists a run and resumes it from a fresh runtime against the same database", async () => {
        expect.assertions(3);

        const { close, store } = await createPgliteStore();
        const sideEffect = vi.fn(() => "shipped");
        const workflow = defineWorkflow({
            id: "order",
            run: async (context) => {
                await context.sleep("settle", 1000);
                await context.step("ship", sideEffect);
            },
        });

        const first = createRuntime({ store, workflows: [workflow] });
        const triggered = await first.trigger(workflow, {});

        expect(triggered.status).toBe("suspended");

        // Fresh runtime, same database (simulates another process / a restart).
        const second = createRuntime({ store, workflows: [workflow] });
        const [resumed] = await second.sweep(Date.now() + 2000);

        expect(resumed?.status).toBe("completed");
        expect(sideEffect).toHaveBeenCalledTimes(1);

        await close();
    });

    it("serialises two runtimes on the shared lease so a step runs exactly once", async () => {
        expect.assertions(1);

        const { close, store } = await createPgliteStore();
        const sideEffect = vi.fn(() => "x");
        const workflow = defineWorkflow({
            id: "leased-sql",
            run: async (context) => {
                await context.sleep("nap", 1000);
                await context.step("after", sideEffect);
            },
        });

        const a = createRuntime({ store, workflows: [workflow] });
        const b = createRuntime({ store, workflows: [workflow] });

        await a.trigger(workflow, {});

        const now = Date.now() + 2000;

        // Two independent runtimes sweep the same due run concurrently; the SQL lease
        // must let only one of them drive it.
        await Promise.all([a.sweep(now), b.sweep(now)]);

        expect(sideEffect).toHaveBeenCalledTimes(1);

        await close();
    });
});
