import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildPythonSbomParts, toPypiPurl } from "../../src/sbom/python";

/**
 * uv.lock → CycloneDX parts. Extras are followed, dependency groups only with
 * `includeDev`, and each entry resolves to the exact locked version it names.
 */
const LOCK = [
    "version = 1",
    "",
    "[[package]]",
    "name = \"my_lib\"",
    "version = \"0.1.0\"",
    "source = { editable = \".\" }",
    "dependencies = [",
    "    { name = \"requests\" },",
    "]",
    "",
    "[package.optional-dependencies]",
    "socks = [",
    "    { name = \"pysocks\" },",
    "]",
    "",
    "[package.dev-dependencies]",
    "dev = [",
    "    { name = \"pytest\" },",
    "]",
    "",
    "[package.metadata]",
    "requires-dist = []",
    "",
    "[[package]]",
    "name = \"requests\"",
    "version = \"2.31.0\"",
    "source = { registry = \"https://pypi.org/simple\" }",
    "dependencies = [",
    "    { name = \"urllib3\", version = \"2.2.0\" },",
    "]",
    "",
    "[[package]]",
    "name = \"urllib3\"",
    "version = \"2.2.0\"",
    "source = { registry = \"https://pypi.org/simple\" }",
    "",
    "[[package]]",
    "name = \"pysocks\"",
    "version = \"1.7.1\"",
    "source = { registry = \"https://pypi.org/simple\" }",
    "",
    "[[package]]",
    "name = \"pytest\"",
    "version = \"8.0.0\"",
    "source = { registry = \"https://pypi.org/simple\" }",
    "",
].join("\n");

describe("sbom: buildPythonSbomParts", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-sbom-py-")));
        writeFileSync(join(root, "uv.lock"), LOCK);
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("follows main and extras, and leaves out dependency groups by default", () => {
        expect.hasAssertions();

        const purls = buildPythonSbomParts(root).components.map((component) => component.purl);

        expect(purls).toStrictEqual(["pkg:pypi/my-lib@0.1.0", "pkg:pypi/pysocks@1.7.1", "pkg:pypi/requests@2.31.0", "pkg:pypi/urllib3@2.2.0"]);
    });

    it("includes dependency groups when includeDev is set", () => {
        expect.hasAssertions();

        const purls = buildPythonSbomParts(root, { includeDev: true }).components.map((component) => component.purl);

        expect(purls).toContain("pkg:pypi/pytest@8.0.0");
    });

    it("resolves an edge to the version it names", () => {
        expect.hasAssertions();

        const dep = buildPythonSbomParts(root).dependencies.find((entry) => entry.ref === "pkg:pypi/requests@2.31.0");

        expect(dep).toStrictEqual({ dependsOn: ["pkg:pypi/urllib3@2.2.0"], ref: "pkg:pypi/requests@2.31.0" });
    });

    it("returns nothing without a uv.lock", () => {
        expect.hasAssertions();

        rmSync(join(root, "uv.lock"));

        expect(buildPythonSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });

    it("normalizes the purl name", () => {
        expect.hasAssertions();

        expect(toPypiPurl("My_Lib.Name", "1.0")).toBe("pkg:pypi/my-lib-name@1.0");
    });
});
