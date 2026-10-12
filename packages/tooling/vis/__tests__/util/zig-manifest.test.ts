import { describe, expect, it } from "vitest";

import { parseZigManifest, ZigManifestError } from "../../src/util/zig-manifest";

const manifest = (body: string): string => `.{\n${body}\n}\n`;

describe(parseZigManifest, () => {
    it("reads the enum name, the version literal and only the path dependencies", () => {
        expect.hasAssertions();

        const raw = manifest(`    .name = .zlib_wrap, // the package
    .version = "1.2.3",
    .fingerprint = 0x1234,
    .dependencies = .{
        .core = .{ .path = "../core" },
        .remote = .{ .url = "https://example.com/x.tar.gz", .hash = "1220abc" },
    },
    .paths = .{ "build.zig", "src" },`);

        const parsed = parseZigManifest(raw, "build.zig.zon");

        expect(parsed.name?.value).toBe("zlib_wrap");
        expect(parsed.version?.value).toBe("1.2.3");
        expect(raw.slice(parsed.version!.start, parsed.version!.end)).toBe("\"1.2.3\"");
        expect(parsed.pathDependencies).toStrictEqual(["../core"]);
    });

    it("accepts a string name", () => {
        expect.hasAssertions();

        expect(parseZigManifest(manifest(`    .name = "plain-name",\n    .version = "0.1.0",`), "m").name?.value).toBe("plain-name");
    });

    it("ignores a nested .version and .name, which are not top-level fields", () => {
        expect.hasAssertions();

        const parsed = parseZigManifest(manifest(`    .name = .app,\n    .dependencies = .{ .core = .{ .version = "9.9.9", .path = "core" } },`), "m");

        expect(parsed.version).toBeUndefined();
        expect(parsed.pathDependencies).toStrictEqual(["core"]);
    });

    it("refuses a second top-level .version", () => {
        expect.hasAssertions();

        expect(() => parseZigManifest(manifest(`    .name = .app,\n    .version = "1.0.0",\n    .version = "2.0.0",`), "m")).toThrow(ZigManifestError);
    });

    it("refuses a version that is an expression, not a plain literal", () => {
        expect.hasAssertions();

        expect(() => parseZigManifest(manifest(`    .name = .app,\n    .version = version_str,`), "m")).toThrow(/string literal/);
        expect(() => parseZigManifest(manifest(`    .name = .app,\n    .version = "1." ++ "0",`), "m")).toThrow(/expected/);
    });

    it("refuses a multiline string and an escape it cannot decode", () => {
        expect.hasAssertions();

        expect(() => parseZigManifest(manifest(`    .name = .app,\n    .version = \\\\1.0.0`), "m")).toThrow(/multiline/);
        expect(() => parseZigManifest(manifest(`    .name = .app,\n    .version = "1.\\x00",`), "m")).toThrow(/unsupported escape/);
    });

    it("refuses a path dependency that is not a string literal", () => {
        expect.hasAssertions();

        expect(() => parseZigManifest(manifest(`    .dependencies = .{ .core = .{ .path = some_dir } },`), "m")).toThrow(/string literal/);
    });

    it("refuses text outside the struct", () => {
        expect.hasAssertions();

        expect(() => parseZigManifest(`${manifest("    .name = .app,")}junk`, "m")).toThrow(/after the manifest/);
    });
});
