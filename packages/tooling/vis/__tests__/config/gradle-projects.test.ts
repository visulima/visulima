import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { dirname, join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace } from "../../src/config/workspace";

const write = (root: string, path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};

/**
 * Gradle modules listed in `settings.gradle(.kts)` are task projects only with
 * `gradle.discover`. A JS package keeps its own targets, and a module nested in a
 * JS package is left to that package.
 */
describe("gradle projects as tasks", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-gradle-tasks-"));
        write(root, "pnpm-workspace.yaml", "packages:\n  - \"packages/*\"\n");
        write(root, "package.json", JSON.stringify({ name: "root", private: true }));
        write(root, "settings.gradle.kts", "include(\":core\", \":app:android\", \":packages:web:android\")\n");
        write(root, "core/build.gradle.kts", "plugins { `java-library` }\n");
        write(root, "app/android/build.gradle.kts", "\n");
        write(root, "packages/web/package.json", JSON.stringify({ name: "web" }));
        write(root, "packages/web/android/build.gradle.kts", "\n");
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("is not a task project unless gradle.discover is set", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, {});

        expect(workspace.projects["core"]).toBeUndefined();
    });

    it("gives each listed module build and test, run from the root wrapper with its task path", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, { gradle: { discover: true } });
        const targets = workspace.projects["core"]?.targets ?? {};

        expect(targets["build"]?.command).toBe("../gradlew :core:build");
        expect(targets["test"]?.command).toBe("../gradlew :core:test");
        expect(targets["test"]?.cache).toBe(true);
    });

    it("uses the wrapper depth of a nested module", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, { gradle: { discover: true } });

        expect(workspace.projects["android"]?.targets["build"]?.command).toBe("../../gradlew :app:android:build");
    });

    it("does not give a Gradle module inside a JS package the targets", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, { gradle: { discover: true } });
        const commands = Object.values(workspace.projects["web"]?.targets ?? {}).map((target) => target.command);

        expect(commands.some((command) => typeof command === "string" && command.includes("gradlew"))).toBe(false);
    });
});
