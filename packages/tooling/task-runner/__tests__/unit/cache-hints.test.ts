import { describe, expect, it } from "vitest";

import { applyAccessHints, collectHints, emptyHints, mergeEnvPatterns, summarizeHints } from "../../src/cache-hints";
import type { FileAccess } from "../../src/file-access-tracker";

const CWD = "/workspace/pkg";

describe(collectHints, () => {
    it("returns an empty aggregate for empty input", () => {
        expect.assertions(1);

        expect(collectHints("", CWD)).toStrictEqual(emptyHints());
    });

    it("parses each op into the matching bucket and resolves paths against cwd", () => {
        expect.assertions(1);

        const ndjson = [
            JSON.stringify({ op: "ignoreInput", path: "node_modules/.cache/eslint" }),
            JSON.stringify({ op: "ignoreOutput", path: "/abs/scratch" }),
            JSON.stringify({ name: "API_URL", op: "trackEnv" }),
            JSON.stringify({ op: "trackEnvPattern", pattern: "VITE_*" }),
            JSON.stringify({ op: "disableCache" }),
        ].join("\n");

        expect(collectHints(ndjson, CWD)).toStrictEqual({
            cacheDisabled: true,
            ignoredInputs: ["/workspace/pkg/node_modules/.cache/eslint"],
            ignoredOutputs: ["/abs/scratch"],
            trackedEnv: ["API_URL"],
            trackedEnvPatterns: ["VITE_*"],
        });
    });

    it("tolerates blank lines, malformed JSON, and unknown ops", () => {
        expect.assertions(1);

        const ndjson = ["", "   ", "not json", JSON.stringify({ op: "futureOp", x: 1 }), JSON.stringify({ op: "disableCache" })].join("\n");

        expect(collectHints(ndjson, CWD)).toStrictEqual({ ...emptyHints(), cacheDisabled: true });
    });

    it("ignores path/name/pattern entries with missing or non-string fields", () => {
        expect.assertions(1);

        const ndjson = [
            JSON.stringify({ op: "ignoreInput" }),
            JSON.stringify({ op: "ignoreInput", path: "" }),
            JSON.stringify({ name: 42, op: "trackEnv" }),
        ].join("\n");

        expect(collectHints(ndjson, CWD)).toStrictEqual(emptyHints());
    });
});

describe(applyAccessHints, () => {
    const accesses: FileAccess[] = [
        { path: "/workspace/pkg/src/index.ts", type: "read" },
        { path: "/workspace/pkg/node_modules/.cache/eslint/result", type: "read" },
        { path: "/workspace/pkg/dist/out.js", type: "write" },
        { path: "/workspace/pkg/tmp/scratch.tmp", type: "write" },
    ];

    it("returns the same array when there is nothing to ignore", () => {
        expect.assertions(1);

        expect(applyAccessHints(accesses, emptyHints())).toBe(accesses);
    });

    it("drops reads under ignoredInputs and writes under ignoredOutputs", () => {
        expect.assertions(1);

        const hints = collectHints(
            [JSON.stringify({ op: "ignoreInput", path: "node_modules/.cache/eslint" }), JSON.stringify({ op: "ignoreOutput", path: "tmp" })].join("\n"),
            CWD,
        );

        expect(applyAccessHints(accesses, hints)).toStrictEqual([
            { path: "/workspace/pkg/src/index.ts", type: "read" },
            { path: "/workspace/pkg/dist/out.js", type: "write" },
        ]);
    });

    it("ignoreInput does not drop a write to the same root (and vice versa)", () => {
        expect.assertions(1);

        // A path appearing as both a read input and a write output: only
        // the matching access-type is dropped by each hint.
        const mixed: FileAccess[] = [
            { path: "/workspace/pkg/cache/x", type: "read" },
            { path: "/workspace/pkg/cache/x", type: "write" },
        ];

        const hints = collectHints(JSON.stringify({ op: "ignoreInput", path: "cache" }), CWD);

        expect(applyAccessHints(mixed, hints)).toStrictEqual([{ path: "/workspace/pkg/cache/x", type: "write" }]);
    });
});

describe(mergeEnvPatterns, () => {
    it("returns the base array unchanged when nothing was tracked", () => {
        expect.assertions(1);

        const base = ["RUNNER_*"];

        expect(mergeEnvPatterns(base, emptyHints())).toBe(base);
    });

    it("appends tracked names and patterns onto the base", () => {
        expect.assertions(1);

        const hints = { ...emptyHints(), trackedEnv: ["API_URL"], trackedEnvPatterns: ["VITE_*"] };

        expect(mergeEnvPatterns(["RUNNER_*"], hints)).toStrictEqual(["RUNNER_*", "API_URL", "VITE_*"]);
    });
});

describe(summarizeHints, () => {
    it("returns undefined when only disableCache (or nothing) was emitted", () => {
        expect.assertions(2);

        expect(summarizeHints(emptyHints())).toBeUndefined();
        // disableCache alone is behavioural, not provenance — it surfaces via
        // TaskResult.cacheDisabledByTask, so summarizeHints stays undefined.
        expect(summarizeHints({ ...emptyHints(), cacheDisabled: true })).toBeUndefined();
    });

    it("projects the four hint buckets, dropping the cacheDisabled flag", () => {
        expect.assertions(1);

        const hints = {
            cacheDisabled: true,
            ignoredInputs: ["/w/.cache"],
            ignoredOutputs: ["/w/tmp"],
            trackedEnv: ["API_URL"],
            trackedEnvPatterns: ["VITE_*"],
        };

        expect(summarizeHints(hints)).toStrictEqual({
            ignoredInputs: ["/w/.cache"],
            ignoredOutputs: ["/w/tmp"],
            trackedEnv: ["API_URL"],
            trackedEnvPatterns: ["VITE_*"],
        });
    });
});
