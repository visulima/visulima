/**
 * Phase 1 perf budget gate for `vis audit --offline`.
 *
 * Budget from the RFC (`packages/tooling/vis/rfc/design-offline-vuln-scanner.md`
 * §Performance budget): `advisoriesQuery` over 2.8k packages must finish
 * inside 80 ms. We sample N times and assert on the median against 10× the
 * budget (800 ms) — GitHub-hosted runners measured 175-566 ms per sample
 * (median ~478 ms under contention) on identical code that runs well under
 * 80 ms locally, so a tighter gate flakes constantly. CodSpeed runs on tuned
 * hardware and provides the real trend signal; this it() is the
 * catastrophic-regression backstop that still works on standard CI hosts.
 *
 * Companion file: `audit-offline.bench.ts` provides the trend-reporting
 * `bench()` task for `vitest bench`.
 */
import { performance } from "node:perf_hooks";

import { advisoriesQuery } from "#native";
import type { AdvisoryQuery } from "#native";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuditOfflineFixture } from "./audit-offline-fixture";

const PKG_COUNT = 2800;
const BUDGET_MS = 80;
const BUDGET_WITH_SLACK_MS = 800;
const SAMPLE_COUNT = 11;

const median = (values: readonly number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);

    return sorted[Math.floor(sorted.length / 2)] as number;
};

let dbPath: string;
let queries: AdvisoryQuery[];
let cleanup: () => void;

beforeAll(async () => {
    const fixture = await createAuditOfflineFixture(PKG_COUNT);

    dbPath = fixture.dbPath;
    queries = fixture.queries;
    cleanup = fixture.cleanup;
});

afterAll(() => {
    cleanup?.();
});

// Per-it timeout = warmup + (SAMPLE_COUNT + 1) × BUDGET_WITH_SLACK_MS plus
// generous overhead. Under CI contention each sample has been seen up to
// ~570 ms, and the default 5 s vitest timeout kills the whole it() before
// all 11 samples land — even when the median itself is well under budget.
const TEST_TIMEOUT_MS = (SAMPLE_COUNT + 2) * BUDGET_WITH_SLACK_MS + 5000;

describe("audit-offline · advisoriesQuery 2.8k packages", () => {
    it(
        `median of ${SAMPLE_COUNT} samples stays under the ${BUDGET_MS}ms budget (with 10× slack for CI hosts → ${BUDGET_WITH_SLACK_MS}ms)`,
        () => {
            expect.assertions(2);

            // Warm pass to fault SQLite pages into the OS page cache; the budget
            // describes steady-state query latency, not cold-cache open costs.
            const warmHits = advisoriesQuery(dbPath, queries);

            expect(warmHits.length).toBe(PKG_COUNT);

            const samples: number[] = [];

            for (let index = 0; index < SAMPLE_COUNT; index += 1) {
                const start = performance.now();

                advisoriesQuery(dbPath, queries);

                samples.push(performance.now() - start);
            }

            const elapsed = median(samples);

            expect(
                elapsed,
                `advisoriesQuery median took ${elapsed.toFixed(1)}ms over ${SAMPLE_COUNT} samples (budget ${BUDGET_MS}ms, ceiling ${BUDGET_WITH_SLACK_MS}ms; samples: [${samples.map((s) => s.toFixed(1)).join(", ")}])`,
            ).toBeLessThan(BUDGET_WITH_SLACK_MS);
        },
        TEST_TIMEOUT_MS,
    );
});
