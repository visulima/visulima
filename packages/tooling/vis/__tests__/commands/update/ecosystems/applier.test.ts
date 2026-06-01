import { readFileSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyEcosystemUpdates } from "../../../../src/commands/update/ecosystems/applier";
import type { EcosystemUpdate } from "../../../../src/commands/update/ecosystems/types";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../../test-helpers";

const makeUpdate = (overrides: Partial<EcosystemUpdate> & Pick<EcosystemUpdate, "file" | "line" | "original" | "replacement">): EcosystemUpdate => {
    return {
        currentRef: "v1.0.0",
        currentVersion: "v1.0.0",
        ecosystem: "actions",
        name: "test/action",
        newRef: "v2.0.0",
        newVersion: "v2.0.0",
        updateType: "major",
        ...overrides,
    };
};

describe(applyEcosystemUpdates, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-applier-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("rewrites the original token while preserving surrounding formatting", () => {
        expect.assertions(2);

        const file = join(workspaceRoot, "workflow.yml");

        writeFileSync(file, "name: ci\njobs:\n  build:\n    steps:\n      - uses: actions/checkout@v3.5.0\n");

        const result = applyEcosystemUpdates([
            makeUpdate({
                file,
                line: 5,
                name: "actions/checkout",
                original: "actions/checkout@v3.5.0",
                replacement: "actions/checkout@v4.0.0",
            }),
        ]);

        expect(result.applied).toHaveLength(1);
        expect(readFileSync(file)).toContain("- uses: actions/checkout@v4.0.0");
    });

    it("strips trailing `# vN.M.P` hint when re-pinning to SHA", () => {
        expect.assertions(1);

        const file = join(workspaceRoot, "workflow.yml");

        writeFileSync(file, "      - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # v3.5.0\n");

        applyEcosystemUpdates([
            makeUpdate({
                file,
                line: 1,
                name: "actions/checkout",
                original: "actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                replacement: "actions/checkout@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb # v4.0.0",
            }),
        ]);

        const content = readFileSync(file);

        // The original v3.5.0 hint must not survive into the rewritten line.
        expect(content).not.toContain("v3.5.0");
    });

    it("skips updates whose original token can't be located on the line", () => {
        expect.assertions(2);

        const file = join(workspaceRoot, "workflow.yml");

        writeFileSync(file, "      - uses: actions/setup-node@v4\n");

        const result = applyEcosystemUpdates([
            makeUpdate({
                file,
                line: 1,
                name: "actions/setup-node",
                // Wrong original — the line says v4, not v3.
                original: "actions/setup-node@v3",
                replacement: "actions/setup-node@v5",
            }),
        ]);

        expect(result.applied).toHaveLength(0);
        expect(result.skipped[0]?.reason).toBe("original token not found on expected line");
    });

    it("preserves CRLF line endings", () => {
        expect.assertions(1);

        const file = join(workspaceRoot, "workflow.yml");

        writeFileSync(file, "      - uses: actions/checkout@v3.5.0\r\n");

        applyEcosystemUpdates([
            makeUpdate({
                file,
                line: 1,
                name: "actions/checkout",
                original: "actions/checkout@v3.5.0",
                replacement: "actions/checkout@v4.0.0",
            }),
        ]);

        expect(readFileSync(file)).toMatch(/\r\n$/);
    });
});
