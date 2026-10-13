import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hexDetector } from "../../src/inference/detectors/hex";

describe("inference: hex detector", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-hex-detect-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    const detect = () => hexDetector.detect({ hasConfigFile: true, matchedConfigs: ["mix.exs"], pkg: {}, projectDirectory: "apps/a", projectRoot: root });

    it("builds uncached, and tests and checks formatting when their preconditions exist", () => {
        expect.hasAssertions();

        mkdirSync(join(root, "test"));
        writeFileSync(join(root, ".formatter.exs"), "[]\n");

        const { targets } = detect();

        expect(targets.build).toMatchObject({ cache: false, command: "mix compile" });
        expect(targets.test?.inputs).toContain("{workspaceRoot}/mix.lock");
        expect(targets.test).toMatchObject({ command: "mix test", outputs: [], type: "test" });
        expect(targets["format:check"]).toMatchObject({ command: "mix format --check-formatted", outputs: [], type: "test" });
    });

    it("skips test and format when their precondition is missing", () => {
        expect.hasAssertions();

        const { targets } = detect();

        expect(targets.build).toBeDefined();
        expect(targets.test).toBeUndefined();
        expect(targets["format:check"]).toBeUndefined();
    });
});
