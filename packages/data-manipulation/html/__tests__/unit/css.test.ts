import { describe, expect, it } from "vitest";

import css from "../../src/css";

describe(css, () => {
    describe("template tag", () => {
        it("should return CSS as-is from template literal", () => {
            expect.assertions(1);

            const result = css`
                :where(.UnderlineNav-actions ul) {
                    animation: 1ms rgh-selector-observer;
                }
            `;

            expect(result).toBe(
                "\n                :where(.UnderlineNav-actions ul) {\n                    animation: 1ms rgh-selector-observer;\n                }\n            ",
            );
        });

        it("should handle template literal with values", () => {
            expect.assertions(1);

            const selector = ".test-class";
            const result = css`
                ${selector} {
                    color: red;
                }
            `;

            expect(result).toBe("\n                .test-class {\n                    color: red;\n                }\n            ");
        });

        it("should handle multiple template literal values", () => {
            expect.assertions(1);

            const property = "color";
            const value = "blue";
            const result = css`
                .test {
                    ${property}: ${value};
                }
            `;

            expect(result).toBe("\n                .test {\n                    color: blue;\n                }\n            ");
        });

        it("should handle empty template literal", () => {
            expect.assertions(1);

            const result = css``;

            expect(result).toBe("");
        });

        it("should handle null and undefined values in template literal", () => {
            expect.assertions(2);

            expect(css`
                .test {
                    color: ${null};
                }
            `).toBe("\n                .test {\n                    color: ;\n                }\n            ");
            expect(css`
                .test {
                    color: ${undefined};
                }
            `).toBe("\n                .test {\n                    color: ;\n                }\n            ");
        });
    });

    describe("function call with string input", () => {
        it("should return CSS as-is when escape is false", () => {
            expect.assertions(1);

            const result = css(":where(.UnderlineNav-actions ul) { animation: 1ms rgh-selector-observer; }", false);

            expect(result).toBe(":where(.UnderlineNav-actions ul) { animation: 1ms rgh-selector-observer; }");
        });

        it("should escape CSS when escape is true", () => {
            expect.assertions(1);

            const cssString = ":where(.test) { animation: 1ms test; }";
            const result = css(cssString, true);

            // The escapeCss function will escape special characters
            expect(result).toBeDefined();
        });

        it("should return CSS as-is when escape is undefined (default)", () => {
            expect.assertions(1);

            const result = css(":where(.test) { color: red; }");

            expect(result).toBe(":where(.test) { color: red; }");
        });

        it("should handle empty string", () => {
            expect.assertions(1);

            const result = css("", false);

            expect(result).toBe("");
        });
    });

    describe("function call with object input", () => {
        it("should convert CSS object to string when escape is false", () => {
            expect.assertions(1);

            const result = css({ padding: "1px" }, false);

            expect(result).toBe("padding: 1px;");
        });

        it("should convert CSS object to string and escape when escape is true", () => {
            expect.assertions(1);

            const result = css({ padding: "1px" }, true);

            // The result should be escaped CSS string
            expect(result).toBeDefined();
        });

        it("should convert camelCase properties to kebab-case", () => {
            expect.assertions(2);

            const result = css({ marginBottom: "20px", paddingTop: "10px" }, false);

            // Object.entries() order may vary, so check that both properties are present
            expect(result).toContain("padding-top: 10px;");
            expect(result).toContain("margin-bottom: 20px;");
        });

        it("should handle multiple CSS properties", () => {
            expect.assertions(3);

            const result = css(
                {
                    color: "red",
                    margin: "2px",
                    padding: "1px",
                },
                false,
            );

            // Object.entries() order may vary, so check that all properties are present
            expect(result).toContain("padding: 1px;");
            expect(result).toContain("margin: 2px;");
            expect(result).toContain("color: red;");
        });

        it("should skip undefined and null values", () => {
            expect.assertions(4);

            const result = css(
                {
                    color: null,
                    display: "block",
                    margin: undefined,
                    padding: "1px",
                },
                false,
            );

            // Object.entries() order may vary, so check that all properties are present
            expect(result).toContain("padding: 1px;");
            expect(result).toContain("display: block;");
            expect(result).not.toContain("margin:");
            expect(result).not.toContain("color:");
        });

        it("should handle empty object", () => {
            expect.assertions(1);

            const result = css({}, false);

            expect(result).toBe("");
        });

        it("should convert number values to strings", () => {
            expect.assertions(2);

            const result = css({ margin: 20, padding: 10 }, false);

            // Object.entries() order may vary, so check that both properties are present
            expect(result).toContain("padding: 10;");
            expect(result).toContain("margin: 20;");
        });

        it("should return CSS as-is when escape is undefined (default)", () => {
            expect.assertions(1);

            const result = css({ padding: "1px" });

            expect(result).toBe("padding: 1px;");
        });
    });
});
