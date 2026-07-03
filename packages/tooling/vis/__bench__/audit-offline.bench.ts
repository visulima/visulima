/**
 * Phase 1 throughput bench for `vis audit --offline`.
 *
 * Run with `pnpm --filter @visulima/vis run bench`. The hard budget gate
 * lives in `audit-offline.test.ts` next door — this file is for trend
 * reporting through Vitest's bench reporter.
 */
import { advisoriesQuery } from "#native";
import type { AdvisoryQuery } from "#native";
import { afterAll, beforeAll, bench, describe } from "vitest";

import { createAuditOfflineFixture } from "./audit-offline-fixture";

const PKG_COUNT = 2800;

let dbPath: string;
let queries: AdvisoryQuery[];
let cleanup: () => void;

beforeAll(async () => {
    const fixture = await createAuditOfflineFixture(PKG_COUNT);

    dbPath = fixture.dbPath;
    queries = fixture.queries;
    cleanup = fixture.cleanup;

    // Warm the page cache so the bench measures steady-state cost, not
    // first-touch SQLite open + page-fault behaviour.
    advisoriesQuery(dbPath, queries);
});

afterAll(() => {
    cleanup?.();
});

describe("audit-offline · advisoriesQuery", () => {
    bench(`× ${PKG_COUNT} packages`, () => {
        advisoriesQuery(dbPath, queries);
    });
});
