import { readFileSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyEcosystemUpdates } from "../../../../src/commands/update/ecosystems/applier";
import type { EcosystemUpdate } from "../../../../src/commands/update/ecosystems/types";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../../test-helpers";

const makeUpdate = (overrides: Partial<EcosystemUpdate> & Pick<EcosystemUpdate, "file" | "line" | "original" | "replacement">): EcosystemUpdate => ({
    currentRef: "v1.0.0",
    currentVersion: "v1.0.0",
    ecosystem: "actions",
    name: "test/action",
    newRef: "v2.0.0",
    newVersion: "v2.0.0",
    updateType: "major",
    ...overrides,
});

describe("applier — file round-trip", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-applier-roundtrip-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("does NOT accumulate trailing newlines on re-applies (regression: split+join double-newline)", () => {
        expect.assertions(3);

        const file = join(workspaceRoot, "workflow.yml");

        writeFileSync(file, "      - uses: actions/checkout@v3.5.0\n");

        // First apply.
        applyEcosystemUpdates([
            makeUpdate({
                file,
                line: 1,
                original: "actions/checkout@v3.5.0",
                replacement: "actions/checkout@v4.0.0",
            }),
        ]);

        const afterFirst = readFileSync(file);

        expect(afterFirst).toBe("      - uses: actions/checkout@v4.0.0\n");

        // Second apply (same shape) — file must NOT grow a blank line at EOF.
        applyEcosystemUpdates([
            makeUpdate({
                file,
                line: 1,
                original: "actions/checkout@v4.0.0",
                replacement: "actions/checkout@v5.0.0",
            }),
        ]);

        const afterSecond = readFileSync(file);

        expect(afterSecond).toBe("      - uses: actions/checkout@v5.0.0\n");
        // Trailing newline count stays at 1.
        expect(afterSecond.match(/\n+$/)?.[0].length).toBe(1);
    });

    it("preserves a user audit comment that follows a version-looking token (regression: greedy [^\\n]*$)", () => {
        expect.assertions(1);

        const file = join(workspaceRoot, "workflow.yml");

        writeFileSync(file, "      - uses: actions/checkout@v3.5.0 # v3.5.3 keep pinned for SOC2\n");

        applyEcosystemUpdates([
            makeUpdate({
                file,
                line: 1,
                original: "actions/checkout@v3.5.0",
                replacement: "actions/checkout@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb # v4.0.0",
            }),
        ]);

        const content = readFileSync(file);

        // The user's "keep pinned for SOC2" audit note must NOT be eaten
        // by the version-hint stripper — only a *bare* `# vN.M.P` token
        // is removed.
        expect(content).toContain("keep pinned for SOC2");
    });

    it("strips a bare `# vN.M.P` hint when re-pinning to SHA", () => {
        expect.assertions(1);

        const file = join(workspaceRoot, "workflow.yml");

        writeFileSync(
            file,
            "      - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # v3.5.0\n",
        );

        applyEcosystemUpdates([
            makeUpdate({
                file,
                line: 1,
                original: "actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                replacement: "actions/checkout@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb # v4.0.0",
            }),
        ]);

        const content = readFileSync(file);

        expect(content).not.toContain("v3.5.0");
    });
});
