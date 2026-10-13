import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildComposerSbomParts, toComposerPurl } from "../../src/sbom/composer";
import { lockedPackagesForEcosystem } from "../../src/security/multi-eco-lockfiles";

const lock = {
    packages: [
        { name: "acme/a", require: { "ext-json": "*", php: "^8.2", "vendor/b": "^1.0" }, version: "v1.0.0" },
        { name: "vendor/b", require: {}, version: "1.4.0" },
        { name: "vendor/unreached", require: {}, version: "2.0.0" },
    ],
    "packages-dev": [{ name: "phpunit/phpunit", require: { "vendor/c": "^1.0" }, version: "v10.5.0" }, { name: "vendor/c", require: {}, version: "1.0.0" }],
};

describe("composer sbom graph and lockfile reader", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-composer-sbom-"));
        writeFileSync(join(root, "composer.json"), JSON.stringify({ name: "acme/app", require: { "acme/a": "^1.0" }, "require-dev": { "phpunit/phpunit": "^10.0" } }));
        writeFileSync(join(root, "composer.lock"), JSON.stringify(lock));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("builds purls with the composer type and percent-encoded segments", () => {
        expect.hasAssertions();

        expect(toComposerPurl("acme/a", "1.0.0")).toBe("pkg:composer/acme/a@1.0.0");
    });

    it("keeps what the root reaches and drops platform requirements", () => {
        expect.hasAssertions();

        const parts = buildComposerSbomParts(root);
        const refs = parts.components.map((component) => component["bom-ref"]).sort();

        expect(refs).toStrictEqual(["pkg:composer/acme/a@1.0.0", "pkg:composer/vendor/b@1.4.0"]);
        expect(parts.dependencies.find((dependency) => dependency.ref === "pkg:composer/acme/a@1.0.0")).toStrictEqual({
            dependsOn: ["pkg:composer/vendor/b@1.4.0"],
            ref: "pkg:composer/acme/a@1.0.0",
        });
    });

    it("follows dev edges only with includeDev", () => {
        expect.hasAssertions();

        const refs = buildComposerSbomParts(root, { includeDev: true }).components.map((component) => component["bom-ref"]);

        expect(refs).toContain("pkg:composer/phpunit/phpunit@10.5.0");
        expect(refs).toContain("pkg:composer/vendor/c@1.0.0");
    });

    it("returns nothing when focus leaves out the root package", () => {
        expect.hasAssertions();

        expect(buildComposerSbomParts(root, { focusNames: ["@acme/web"] })).toStrictEqual({ components: [], dependencies: [] });
    });

    it("reads packages and packages-dev as the audit lockfile, without the tag's v", () => {
        expect.hasAssertions();

        const packages = lockedPackagesForEcosystem(root, "Packagist");

        expect(packages).toContainEqual({ isDev: false, name: "acme/a", version: "1.0.0" });
        expect(packages).toContainEqual({ isDev: true, name: "phpunit/phpunit", version: "10.5.0" });
    });
});
