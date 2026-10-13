import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildZigSbomParts } from "../../src/sbom/zig";
import { validateBom } from "./validator";

const LEGACY_HASH = `1220${"ab".repeat(32)}`;
const CURRENT_HASH = "clap-0.10.0-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const ROOT_MANIFEST = `.{
    .name = .app,
    .version = "0.1.0",
    .dependencies = .{
        .tagged = .{
            .url = "https://github.com/Owner/Repo/archive/refs/tags/v1.2.3.tar.gz",
            .hash = "${LEGACY_HASH}",
        },
        .commit = .{
            .url = "git+https://example.com/team/tool.git#4f3a2b1",
            .hash = "${CURRENT_HASH}",
        },
        .generic = .{
            .url = "https://mirror.example.org/pkg/archive/refs/tags/2.0.0.zip",
            .hash = "${LEGACY_HASH}",
        },
        .local = .{ .path = "vendor/local" },
    },
    .paths = .{ "build.zig", "build.zig.zon", "src" },
}
`;

describe(buildZigSbomParts, () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-zig-sbom-")));
        writeFileSync(join(root, "build.zig.zon"), ROOT_MANIFEST);
        mkdirSync(join(root, "vendor", "local"), { recursive: true });
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    const byName = (name: string) => {
        const { components } = buildZigSbomParts(root);
        const found = components.find((component) => component.name === name);

        if (found === undefined) {
            throw new Error(`no component named ${name}`);
        }

        return found;
    };

    it("versions a GitHub tag archive, drops the leading v, and uses pkg:github", () => {
        expect.hasAssertions();

        const component = byName("github.com/Owner/Repo");

        expect(component.version).toBe("1.2.3");
        expect(component.purl).toBe("pkg:github/owner/repo@v1.2.3");
        expect(component.hashes).toStrictEqual([{ alg: "SHA-256", content: "ab".repeat(32) }]);
        expect(component.externalReferences).toStrictEqual([{ type: "distribution", url: "https://github.com/Owner/Repo/archive/refs/tags/v1.2.3.tar.gz" }]);
    });

    it("leaves a git URL unversioned and keeps its current-form hash as a property", () => {
        expect.hasAssertions();

        const component = byName("example.com/team/tool");

        expect(component.version).toBeUndefined();
        expect(component.purl).toBe("pkg:generic/example.com%2Fteam%2Ftool?download_url=git%2Bhttps%3A%2F%2Fexample.com%2Fteam%2Ftool.git%234f3a2b1");
        expect(component.hashes).toBeUndefined();
        expect(component.properties).toStrictEqual([
            { name: "vis:zig:version", value: "unversioned: URL is not a tag archive" },
            { name: "vis:zig:hash", value: CURRENT_HASH },
        ]);
    });

    it("versions a tag archive on another host with pkg:generic", () => {
        expect.hasAssertions();

        const component = byName("mirror.example.org/pkg");

        expect(component.version).toBe("2.0.0");
        expect(component.purl).toMatch(/^pkg:generic\/mirror\.example\.org%2Fpkg@2\.0\.0\?download_url=/);
    });

    it("names a path dependency by its directory, with no version and no hash", () => {
        expect.hasAssertions();

        const component = byName("local");

        expect(component.version).toBeUndefined();
        expect(component["bom-ref"]).toBe("zig:path:vendor/local");
        expect(component.hashes).toBeUndefined();
        expect(component.purl).toBe("pkg:generic/local");
        expect(component.properties).toStrictEqual([
            { name: "vis:zig:version", value: "unversioned: local path dependency" },
            { name: "vis:zig:path", value: "vendor/local" },
        ]);
    });

    it("emits one flat dependency entry per component and no edges", () => {
        expect.hasAssertions();

        const { components, dependencies } = buildZigSbomParts(root);

        expect(dependencies).toHaveLength(components.length);

        for (const dependency of dependencies) {
            expect(dependency).not.toHaveProperty("dependsOn");
        }

        const refs = components.map((component) => component["bom-ref"]);

        expect(new Set(refs).size).toBe(refs.length);
    });

    it("produces components that pass the CycloneDX 1.7 schema", () => {
        expect.hasAssertions();

        const { components, dependencies } = buildZigSbomParts(root);

        expect(validateBom({ bomFormat: "CycloneDX", components, dependencies, specVersion: "1.7", version: 1 })).toStrictEqual({ errors: [], valid: true });
    });

    it("returns nothing, rather than failing the BOM, when the manifest does not parse", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "build.zig.zon"), ".{ .version = some_expression }");

        expect(buildZigSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });

    it("returns nothing when the workspace has no build.zig.zon", () => {
        expect.hasAssertions();

        rmSync(join(root, "build.zig.zon"));

        expect(buildZigSbomParts(root)).toStrictEqual({ components: [], dependencies: [] });
    });
});
