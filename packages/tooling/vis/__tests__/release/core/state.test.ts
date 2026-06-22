import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearState, filterPlanByState, newState, readState, stateFilePath, writeState } from "../../../src/release/core/state";
import type { PlannedRelease, StateFile } from "../../../src/release/types";

const mkRelease = (name: string, newVersion: string): PlannedRelease => {
    return {
        changeFiles: [],
        isCascadeBump: false,
        isDependencyBump: false,
        isGroupBump: false,
        name,
        newVersion,
        oldVersion: "1.0.0",
        reasons: ["EXPLICIT"],
        sources: [],
        type: "minor",
    };
};

describe("state — file lifecycle", () => {
    let cwd: string;
    const changesDir = ".vis/release";

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-state-"));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("returns undefined when no state file exists", async () => {
        expect.hasAssertions();

        const state = await readState(cwd, changesDir);

        expect(state).toBeUndefined();
    });

    it("write → read round-trip preserves shape", async () => {
        expect.hasAssertions();

        const state = newState("alpha", [mkRelease("a", "1.1.0"), mkRelease("b", "2.1.0")]);

        await writeState(cwd, changesDir, state);
        const read = await readState(cwd, changesDir);

        expect(read?.version).toBe(1);
        expect(read?.channel).toBe("alpha");
        expect(read?.plan).toHaveLength(2);
        expect(read?.applied).toStrictEqual([]);
        expect(read?.published).toStrictEqual([]);
        expect(read?.tagged).toStrictEqual([]);
        expect(read?.pushed).toBe(false);
    });

    it("clearState removes the file", async () => {
        expect.hasAssertions();

        await writeState(cwd, changesDir, newState(undefined, [mkRelease("a", "1.1.0")]));

        await expect(readState(cwd, changesDir)).resolves.toBeDefined();

        await clearState(cwd, changesDir);

        await expect(readState(cwd, changesDir)).resolves.toBeUndefined();
    });

    it("clearState is a no-op when file is absent", async () => {
        expect.hasAssertions();
        await expect(clearState(cwd, changesDir)).resolves.toBeUndefined();
    });

    it("stateFilePath joins cwd + changesDir + .state.json", () => {
        expect.hasAssertions();
        expect(stateFilePath("/r", ".vis/release")).toBe(join("/r", ".vis/release", ".state.json"));
    });

    it("throws STATE_FILE_CORRUPT on unknown schema version", async () => {
        expect.hasAssertions();

        const fs = await import("node:fs/promises");

        await fs.mkdir(join(cwd, changesDir), { recursive: true });
        await fs.writeFile(stateFilePath(cwd, changesDir), JSON.stringify({ version: 999 }));

        await expect(readState(cwd, changesDir)).rejects.toThrow(/Unknown state file version/);
    });
});

describe("state — filterPlanByState", () => {
    it("filters out already-published packages", () => {
        expect.hasAssertions();

        const plan = [mkRelease("a", "1.1.0"), mkRelease("b", "2.1.0"), mkRelease("c", "3.1.0")];
        const state: StateFile = {
            applied: ["a@1.1.0", "b@2.1.0", "c@3.1.0"],
            plan,
            published: ["a@1.1.0", "b@2.1.0"],
            pushed: false,
            startedAt: "2026-05-02T00:00:00Z",
            tagged: [],
            version: 1,
        };

        const filtered = filterPlanByState(plan, state);

        expect(filtered).toHaveLength(1);
        expect(filtered[0]?.name).toBe("c");
    });

    it("returns full plan when nothing is published", () => {
        expect.hasAssertions();

        const plan = [mkRelease("a", "1.1.0"), mkRelease("b", "2.1.0")];
        const state: StateFile = {
            applied: [],
            plan,
            published: [],
            pushed: false,
            startedAt: "2026-05-02T00:00:00Z",
            tagged: [],
            version: 1,
        };

        const filtered = filterPlanByState(plan, state);

        expect(filtered).toHaveLength(2);
    });
});
