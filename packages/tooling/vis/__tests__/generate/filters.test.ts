import { describe, expect, it } from "vitest";

import { applyFilter, FILTERS, isKnownFilter } from "../../src/generate/moon-adapter/filters";

describe("case filters", () => {
    it("camel_case should lowercase first segment", () => {
        expect.assertions(2);

        expect(applyFilter("camel_case", "hello world")).toBe("helloWorld");
        expect(applyFilter("camel_case", "HelloWorld")).toBe("helloWorld");
    });

    it("pascal_case should capitalize each segment", () => {
        expect.assertions(2);

        expect(applyFilter("pascal_case", "hello world")).toBe("HelloWorld");
        expect(applyFilter("pascal_case", "my-component")).toBe("MyComponent");
    });

    it("snake_case should lowercase with underscores", () => {
        expect.assertions(2);

        expect(applyFilter("snake_case", "HelloWorld")).toBe("hello_world");
        expect(applyFilter("snake_case", "my-component")).toBe("my_component");
    });

    it("kebab_case should lowercase with hyphens", () => {
        expect.assertions(2);

        expect(applyFilter("kebab_case", "HelloWorld")).toBe("hello-world");
        expect(applyFilter("kebab_case", "my_component")).toBe("my-component");
    });

    it("upper_case should uppercase all", () => {
        expect.assertions(1);

        expect(applyFilter("upper_case", "hello")).toBe("HELLO");
    });

    it("lower_case should lowercase all", () => {
        expect.assertions(1);

        expect(applyFilter("lower_case", "HELLO")).toBe("hello");
    });

    it("upper_kebab_case should uppercase with hyphens", () => {
        expect.assertions(1);

        expect(applyFilter("upper_kebab_case", "hello world")).toBe("Hello-World");
    });

    it("upper_snake_case should uppercase with underscores", () => {
        expect.assertions(1);

        expect(applyFilter("upper_snake_case", "hello world")).toBe("HELLO_WORLD");
    });
});

describe("path filters", () => {
    it("path_join should append segments", () => {
        expect.assertions(1);

        expect(applyFilter("path_join", "src", ["components"])).toBe("src/components");
    });

    it("path_relative should compute relative path", () => {
        expect.assertions(1);

        expect(applyFilter("path_relative", "/a/b/c/file.ts", ["/a/b"])).toBe("c/file.ts");
    });
});

describe("filter registry", () => {
    it("isKnownFilter should be true for registered filters", () => {
        expect.assertions(2);

        expect(isKnownFilter("camel_case")).toBe(true);
        expect(isKnownFilter("doesnt_exist")).toBe(false);
    });

    it("applyFilter should error on unknown filters with hint", () => {
        expect.assertions(2);

        expect(() => applyFilter("doesnt_exist", "x")).toThrow(/Unknown filter/);
        expect(() => applyFilter("doesnt_exist", "x")).toThrow(/camel_case/);
    });

    it("fILTERS should expose all eight case filters plus path helpers", () => {
        expect.assertions(1);

        const expected = [
            "camel_case",
            "kebab_case",
            "lower_case",
            "pascal_case",
            "path_join",
            "path_relative",
            "snake_case",
            "upper_case",
            "upper_kebab_case",
            "upper_snake_case",
        ];

        expect(Object.keys(FILTERS).sort()).toStrictEqual(expected);
    });
});
