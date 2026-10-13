import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveComposerProjectDirectories } from "../../src/config/composer-projects";
import { composerDetector } from "../../src/inference/detectors/composer";

describe("composer task projects", () => {
    let root: string;

    const write = (relative: string, content: unknown): void => {
        mkdirSync(dirname(join(root, relative)), { recursive: true });
        writeFileSync(join(root, relative), JSON.stringify(content));
    };

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-composer-tasks-"));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("returns nested composer.json directories, not the root or vendor", () => {
        expect.hasAssertions();

        write("composer.json", { name: "acme/root" });
        write("packages/a/composer.json", { name: "acme/a" });
        write("packages/b/composer.json", {});
        write("packages/a/vendor/x/composer.json", { name: "x/y" });

        expect(resolveComposerProjectDirectories(root, []).sort()).toStrictEqual(["packages/a", "packages/b"]);
    });

    it("drops directories a JS package already claims", () => {
        expect.hasAssertions();

        write("packages/a/composer.json", { name: "acme/a" });
        write("packages/b/composer.json", { name: "acme/b" });

        expect(resolveComposerProjectDirectories(root, ["packages/a"])).toStrictEqual(["packages/b"]);
    });

    it("validates always and runs test and lint only when their scripts exist", () => {
        expect.hasAssertions();

        write("svc/composer.json", { scripts: { lint: "phpstan analyse", test: "phpunit" } });
        write("plain/composer.json", {});

        const withScripts = composerDetector.detect({ hasConfigFile: true, matchedConfigs: [], pkg: {}, projectDirectory: "svc", projectRoot: join(root, "svc") });
        const plain = composerDetector.detect({ hasConfigFile: true, matchedConfigs: [], pkg: {}, projectDirectory: "plain", projectRoot: join(root, "plain") });

        expect(Object.keys(withScripts.targets).sort()).toStrictEqual(["lint", "test", "validate"]);
        expect(withScripts.targets.validate).toMatchObject({ command: "composer validate --strict", type: "test" });
        expect(withScripts.targets.lint).toMatchObject({ command: "composer run-script lint", type: "test" });
        expect(Object.keys(plain.targets)).toStrictEqual(["validate"]);
    });

    it("treats a script given as an array as present", () => {
        expect.hasAssertions();

        write("arr/composer.json", { scripts: { lint: ["@php vendor/bin/phpstan"], test: ["@php vendor/bin/phpunit"] } });

        const detected = composerDetector.detect({ hasConfigFile: true, matchedConfigs: [], pkg: {}, projectDirectory: "arr", projectRoot: join(root, "arr") });

        expect(Object.keys(detected.targets).sort()).toStrictEqual(["lint", "test", "validate"]);
    });
});
