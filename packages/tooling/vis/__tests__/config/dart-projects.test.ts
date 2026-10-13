import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveDartProjectDirectories } from "../../src/config/dart-projects";
import { dartDetector } from "../../src/inference/detectors/dart";

describe(resolveDartProjectDirectories, () => {
    let root: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(root, rel, ".."), { recursive: true });
        writeFileSync(join(root, rel), content);
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-dart-tasks-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("returns the workspace members that hold a pubspec, minus claimed directories", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: root\npublish_to: none\nworkspace:\n  - packages/*\n");
        write("packages/core/pubspec.yaml", "name: core\nversion: 1.0.0\n");
        write("packages/app/pubspec.yaml", "name: app\nversion: 1.0.0\n");
        mkdirSync(join(root, "packages/docs"), { recursive: true });

        expect(resolveDartProjectDirectories(root, [])).toStrictEqual(["packages/app", "packages/core"]);
        expect(resolveDartProjectDirectories(root, ["packages/app"])).toStrictEqual(["packages/core"]);
    });

    it("returns nothing for a single-package root or an unexpandable pattern", () => {
        expect.hasAssertions();

        write("pubspec.yaml", "name: solo\nversion: 1.0.0\n");

        expect(resolveDartProjectDirectories(root, [])).toStrictEqual([]);

        write("pubspec.yaml", "name: root\nworkspace:\n  - packages/**\n");

        expect(resolveDartProjectDirectories(root, [])).toStrictEqual([]);
    });
});

describe("dartDetector", () => {
    it("emits analyze, test and a format check that fails on unformatted code", () => {
        expect.hasAssertions();

        const { targets } = dartDetector.detect({ projectDirectory: "packages/core" } as never) as { targets: Record<string, { command: string; type?: string }> };

        expect(targets.build?.command).toBe("dart analyze");
        expect(targets.test).toMatchObject({ command: "dart test", type: "test" });
        expect(targets["format:check"]).toMatchObject({ command: "dart format --output=none --set-exit-if-changed .", type: "test" });
    });
});
