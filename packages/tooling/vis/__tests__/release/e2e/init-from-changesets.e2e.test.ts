/**
 * E2E: `vis release init --from-changesets` against the from-changesets
 * fixture. Verifies that `.changeset/config.json` is parsed, `.changeset/*.md`
 * files are copied verbatim into `.vis/release/`, and a config snippet is
 * printed.
 *
 * Skipped automatically when verdaccio isn't installed (gates on the
 * harness's startup). Will run on local machines that have run
 * `pnpm add -D --filter \@visulima/vis verdaccio` plus a vis build.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prepareFixture } from "../harness/runner";

const visBuilt = (): boolean => existsSync(join(__dirname, "..", "..", "..", "dist", "bin.js"));

describe.skipIf(!visBuilt())("e2e: vis release init --from-changesets", () => {
    let result: Awaited<ReturnType<typeof prepareFixture>>;

    beforeEach(async () => {
        result = await prepareFixture({ fixture: "from-changesets" });
    });

    afterEach(async () => {
        await result.cleanup();
        const fs = await import("node:fs/promises");

        await fs.rm(result.cwd, { force: true, recursive: true });
    });

    it("auto-detects changesets and migrates the change file", () => {
        expect.hasAssertions();

        const { exitCode, stdout } = result.runVisRelease(["init", "--from-changesets"]);

        expect(exitCode).toBe(0);
        expect(stdout).toContain("Detected source: changesets");
        expect(existsSync(join(result.cwd, ".vis", "release", "sample.md"))).toBe(true);
    });

    it("aborts when changesets pre-release mode is active", async () => {
        expect.hasAssertions();

        const fs = await import("node:fs/promises");

        await fs.writeFile(
            join(result.cwd, ".changeset", "pre.json"),
            JSON.stringify({ changesets: [], initialVersions: {}, mode: "pre", tag: "alpha" }),
        );

        const { exitCode, stderr } = result.runVisRelease(["init", "--from-changesets"]);

        expect(exitCode).not.toBe(0);
        expect(stderr).toMatch(/pre-release mode/i);
    });
});
