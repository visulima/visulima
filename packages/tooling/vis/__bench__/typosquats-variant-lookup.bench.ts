/**
 * Throughput bench for the typosquat heuristic path.
 *
 * Contrasts the optimized amortized Map lookup (one `generateVariants` pass
 * over the whole blocklist, cached) against the previous approach that rebuilt
 * the full variant set for every legitimate package on *every* checked input
 * (O(deps × blocklistKeys) set rebuilds).
 *
 * Run with `pnpm --filter @visulima/vis run bench`.
 */
import { beforeAll, bench, describe } from "vitest";

import { generateVariants } from "../src/security/typosquats";

// Synthetic blocklist of legitimate names, sized to mirror the real
// auto-generated blocklist (~96 keys today, designed to grow).
const BLOCKLIST: string[] = Array.from({ length: 96 }, (_, index) => `legitimate-package-${String(index)}`);

// A batch of dependency names to check — none are exact blocklist hits, so the
// heuristic path runs to completion for every input (worst case).
const DEPS: string[] = Array.from({ length: 200 }, (_, index) => `some-dependency-name-${String(index)}`);

// Optimized: build the variant -> legitimate Map once, then O(1) lookups.
let variantLookup: Map<string, string>;

beforeAll(() => {
    variantLookup = new Map<string, string>();

    for (const legitimate of BLOCKLIST) {
        for (const variant of generateVariants(legitimate)) {
            if (!variantLookup.has(variant)) {
                variantLookup.set(variant, legitimate);
            }
        }
    }
});

describe("typosquats · heuristic batch (200 deps × 96 blocklist keys)", () => {
    bench("optimized · cached variant Map lookup", () => {
        for (const dep of DEPS) {
            variantLookup.get(dep);
        }
    });

    bench("previous · per-package variant set rebuild", () => {
        for (const dep of DEPS) {
            for (const legitimate of BLOCKLIST) {
                if (generateVariants(legitimate).has(dep)) {
                    break;
                }
            }
        }
    });
});
