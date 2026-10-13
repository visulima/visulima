import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { gemDetector } from "../../src/inference/detectors/gem";

describe("inference: gem detector", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-gem-detect-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    const detect = (matchedConfigs: string[]) =>
        gemDetector.detect({ hasConfigFile: matchedConfigs.length > 0, matchedConfigs, pkg: {}, projectDirectory: "gems/a", projectRoot: root });

    it("builds the gem from its gemspec, uncached, and tests and lints when the files exist", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "a.gemspec"), "");
        writeFileSync(join(root, "Rakefile"), "");
        writeFileSync(join(root, ".rubocop.yml"), "");

        const { targets } = detect(["Rakefile"]);

        expect(targets.build).toMatchObject({ cache: false, command: "gem build a.gemspec" });
        expect(targets.test).toMatchObject({ command: "bundle exec rake test", outputs: [], type: "test" });
        expect(targets["format:check"]).toMatchObject({ command: "bundle exec rubocop --format quiet", outputs: [], type: "test" });
    });

    it("skips test and lint when their precondition is missing", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "a.gemspec"), "");

        const { targets } = detect(["Gemfile"]);

        expect(Object.keys(targets)).toStrictEqual(["build"]);
    });

    it("infers no build target with two gemspecs in one directory", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "a.gemspec"), "");
        writeFileSync(join(root, "b.gemspec"), "");

        expect(detect(["Gemfile"]).targets.build).toBeUndefined();
    });
});
