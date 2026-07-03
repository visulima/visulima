import { describe, expect, it } from "vitest";

import { interpolateFilename, isPartialPath, stripRawSuffix, stripTeraSuffix } from "../../src/generate/moon-adapter/filename-interp";

describe(interpolateFilename, () => {
    it("should substitute simple [var] tokens", () => {
        expect.assertions(1);

        expect(interpolateFilename("src/[name].ts", { name: "Button" })).toBe("src/Button.ts");
    });

    it("should apply a single filter", () => {
        expect.assertions(1);

        expect(interpolateFilename("src/[name | kebab_case].ts", { name: "MyComponent" })).toBe("src/my-component.ts");
    });

    it("should apply multiple bracket interpolations in one path", () => {
        expect.assertions(1);

        expect(interpolateFilename("[type]/[name | snake_case].ts", { name: "FooBar", type: "components" })).toBe("components/foo_bar.ts");
    });

    it("should strip .tera suffix", () => {
        expect.assertions(1);

        expect(interpolateFilename("[name].ts.tera", { name: "Button" })).toBe("Button.ts");
    });

    it("should strip .twig suffix", () => {
        expect.assertions(1);

        expect(interpolateFilename("[name].html.twig", { name: "page" })).toBe("page.html");
    });

    it("should error on missing variables", () => {
        expect.assertions(1);

        expect(() => interpolateFilename("[missing].ts", { other: "x" })).toThrow(/missing/);
    });

    it("should error on unknown filters", () => {
        expect.assertions(1);

        expect(() => interpolateFilename("[name | nope].ts", { name: "x" })).toThrow(/Unknown filter/);
    });
});

describe(stripTeraSuffix, () => {
    it("should leave non-tera files untouched", () => {
        expect.assertions(1);

        expect(stripTeraSuffix("README.md")).toBe("README.md");
    });

    it("should strip .tera and .twig", () => {
        expect.assertions(2);

        expect(stripTeraSuffix("file.ts.tera")).toBe("file.ts");
        expect(stripTeraSuffix("page.html.twig")).toBe("page.html");
    });
});

describe(stripRawSuffix, () => {
    it("should strip .raw and leave others alone", () => {
        expect.assertions(2);

        expect(stripRawSuffix("foo.raw")).toBe("foo");
        expect(stripRawSuffix("foo.ts")).toBe("foo.ts");
    });
});

describe(isPartialPath, () => {
    it("should match files with underscore-prefixed basenames", () => {
        expect.assertions(2);

        expect(isPartialPath("partials/_header.ts")).toBe(true);
        expect(isPartialPath("_header.tera")).toBe(true);
    });

    it("should match any file inside a partials/ directory segment", () => {
        expect.assertions(2);

        expect(isPartialPath("nested/partials/x.ts")).toBe(true);
        expect(isPartialPath("partials/x.ts")).toBe(true);
    });

    it("should NOT match files that merely contain the substring 'partial'", () => {
        expect.assertions(3);

        expect(isPartialPath("foo.partial.tera")).toBe(false);
        expect(isPartialPath("src/PartialResult.ts")).toBe(false);
        expect(isPartialPath("components/partially-applied.ts")).toBe(false);
    });

    it("should NOT match regular files", () => {
        expect.assertions(1);

        expect(isPartialPath("just-a-file.ts")).toBe(false);
    });
});
