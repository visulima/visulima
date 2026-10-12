import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildPythonSbomParts, toPypiPurl } from "../../src/sbom/python";

/**
 * uv.lock → CycloneDX parts. Names are PEP 503 normalized in the purl, and an
 * edge resolves to the single locked version of the dependency.
 */
describe("sbom: buildPythonSbomParts", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-sbom-py-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("emits pkg:pypi components and resolves dependency edges", () => {
        expect.hasAssertions();

        writeFileSync(
            join(root, "uv.lock"),
            [
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
                "[[package]]",
                "name = \"requests\"",
                "version = \"2.31.0\"",
                "source = { registry = \"https://pypi.org/simple\" }",
                "",
            ].join("\n"),
        );

        const { components, dependencies } = buildPythonSbomParts(root);

        expect(components.map((component) => component.purl)).toStrictEqual(["pkg:pypi/my-lib@0.1.0", "pkg:pypi/requests@2.31.0"]);
        expect(dependencies.find((dep) => dep.ref === "pkg:pypi/my-lib@0.1.0")).toStrictEqual({
            dependsOn: ["pkg:pypi/requests@2.31.0"],
            ref: "pkg:pypi/my-lib@0.1.0",
        });
    });

    it("returns nothing without a uv.lock", () => {
        expect.hasAssertions();

        expect(buildPythonSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });

    it("normalizes the purl name", () => {
        expect.hasAssertions();

        expect(toPypiPurl("My_Lib.Name", "1.0")).toBe("pkg:pypi/my-lib-name@1.0");
    });
});
