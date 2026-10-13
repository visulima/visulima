import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveComposerProjectDirectories } from "../../src/config/composer-projects";
import { discoverWorkspace } from "../../src/config/workspace";
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

    describe("format:check", () => {
        const detectAt = (directory: string) =>
            composerDetector.detect({ hasConfigFile: true, matchedConfigs: [], pkg: {}, projectDirectory: directory, projectRoot: join(root, directory) });

        it("uses pint --test when laravel/pint is a dev dependency", () => {
            expect.hasAssertions();

            write("pint/composer.json", { "require-dev": { "laravel/pint": "^1.0" } });

            const detected = detectAt("pint");

            expect(detected.targets["format:check"]).toStrictEqual({
                command: "vendor/bin/pint --test",
                description: "pint --test (inferred)",
                inputs: [
                    "{projectRoot}/composer.json",
                    "{projectRoot}/composer.lock",
                    "{projectRoot}/src/**/*.php",
                    "{projectRoot}/tests/**/*.php",
                    "{projectRoot}/pint.json",
                ],
                outputs: [],
                type: "test",
            });
        });

        it("prefers pint over phpcs when both are dev dependencies", () => {
            expect.hasAssertions();

            write("both/composer.json", { "require-dev": { "laravel/pint": "^1.0", "squizlabs/php_codesniffer": "^3.0" } });
            write("both/phpcs.xml", "<ruleset/>");

            expect(detectAt("both").targets["format:check"]).toMatchObject({ command: "vendor/bin/pint --test" });
        });

        it("uses vendor/bin/phpcs when phpcs.xml exists", () => {
            expect.hasAssertions();

            write("cs/composer.json", { "require-dev": { "squizlabs/php_codesniffer": "^3.0" } });
            write("cs/phpcs.xml", "<ruleset/>");

            expect(detectAt("cs").targets["format:check"]).toStrictEqual({
                command: "vendor/bin/phpcs",
                description: "phpcs (inferred)",
                inputs: [
                    "{projectRoot}/composer.json",
                    "{projectRoot}/composer.lock",
                    "{projectRoot}/src/**/*.php",
                    "{projectRoot}/tests/**/*.php",
                    "{projectRoot}/phpcs.xml",
                    "{projectRoot}/phpcs.xml.dist",
                ],
                outputs: [],
                type: "test",
            });
        });

        it("uses vendor/bin/phpcs when only phpcs.xml.dist exists", () => {
            expect.hasAssertions();

            write("dist/composer.json", { "require-dev": { "squizlabs/php_codesniffer": "^3.0" } });
            write("dist/phpcs.xml.dist", "<ruleset/>");

            expect(detectAt("dist").targets["format:check"]).toMatchObject({ command: "vendor/bin/phpcs", type: "test" });
        });

        it("infers no phpcs target without a phpcs config file, since its default standard depends on the phpcs version", () => {
            expect.hasAssertions();

            write("nocfg/composer.json", { "require-dev": { "squizlabs/php_codesniffer": "^3.0" } });

            const detected = detectAt("nocfg");

            expect(detected.targets["format:check"]).toBeUndefined();
            expect(Object.keys(detected.targets).sort()).toStrictEqual(["validate"]);
        });

        it("infers no format target when neither formatter is a dev dependency", () => {
            expect.hasAssertions();

            write("none/composer.json", { "require-dev": { "phpunit/phpunit": "^11.0" }, scripts: { format: "pint" } });
            write("none/phpcs.xml", "<ruleset/>");

            const detected = detectAt("none");

            expect(detected.targets["format:check"]).toBeUndefined();
            expect(Object.keys(detected.targets).sort()).toStrictEqual(["validate"]);
        });
    });
});

describe("composer format:check through discoverWorkspace", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-composer-discover-"));
        mkdirSync(root, { recursive: true });
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - \"packages/*\"\n");
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", private: true }));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it.each([
        {
            expected: "vendor/bin/pint --test",
            files: { "composer.json": { "require-dev": { "laravel/pint": "^1.0" } } },
            name: "pint",
        },
        {
            expected: "vendor/bin/phpcs",
            files: { "composer.json": { "require-dev": { "squizlabs/php_codesniffer": "^3.0" } }, "phpcs.xml": "<ruleset/>" },
            name: "phpcs-config",
        },
        {
            expected: undefined,
            files: { "composer.json": { "require-dev": { "squizlabs/php_codesniffer": "^3.0" } } },
            name: "phpcs-no-config",
        },
        {
            expected: undefined,
            files: { "composer.json": { "require-dev": { "phpunit/phpunit": "^11.0" }, scripts: { format: "pint" } } },
            name: "none",
        },
    ])("infers format:check for $name as expected", ({ expected, files, name }) => {
        expect.hasAssertions();

        const dir = join(root, "packages", name);

        mkdirSync(dir, { recursive: true });

        for (const [file, content] of Object.entries(files)) {
            writeFileSync(join(dir, file), typeof content === "string" ? content : JSON.stringify(content));
        }

        const { workspace } = discoverWorkspace(root, { composer: { discover: true } });

        // The validate target proves the project was inferred, so an undefined format:check is not a missing project.
        expect(workspace.projects[name]?.targets?.["validate"]?.command).toBe("composer validate --strict");
        expect(workspace.projects[name]?.targets?.["format:check"]?.command).toBe(expected);
    });
});
