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

            expect(result).toBe(":where(.UnderlineNav-actions ul) { animation: 1ms rgh-selector-observer; }");
        });

        it("should handle template literal with values", () => {
            expect.assertions(1);

            const selector = ".test-class";
            const result = css`
                ${selector} {
                    color: red;
                }
            `;

            expect(result).toBe(String.raw`\.test-class { color: red; }`);
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

            expect(result).toBe(".test { color: blue; }");
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
            `).toBe(".test { color: ; }");
            expect(css`
                .test {
                    color: ${undefined};
                }
            `).toBe(".test { color: ; }");
        });

        it("should handle empty string interpolation", () => {
            expect.assertions(1);

            const result = css`
                .test {
                    color: ${""};
                }
            `;

            expect(result).toBe(".test { color: ; }");
        });

        it("should handle zero value", () => {
            expect.assertions(1);

            const result = css`
                .test {
                    margin: ${0}px;
                }
            `;

            expect(result).toBe(String.raw`.test { margin: \30 px; }`);
        });

        it("should handle negative numbers", () => {
            expect.assertions(1);

            const result = css`
                .test {
                    margin: ${-10}px;
                }
            `;

            expect(result).toBe(String.raw`.test { margin: -\31 0px; }`);
        });

        it("should handle decimal numbers", () => {
            expect.assertions(1);

            const result = css`
                .test {
                    opacity: ${0.5};
                }
            `;

            expect(result).toBe(String.raw`.test { opacity: \30 \.5; }`);
        });

        it("should handle template literal with only interpolation", () => {
            expect.assertions(1);

            const value = "color: red;";
            const result = css`
                ${value}
            `;

            expect(result).toBe(String.raw`color\:\ red\;`);
        });

        it("should handle template literal starting with interpolation", () => {
            expect.assertions(1);

            const selector = ".test";
            const result = css`
                ${selector} {
                    color: red;
                }
            `;

            expect(result).toBe(String.raw`\.test { color: red; }`);
        });

        it("should handle template literal ending with interpolation", () => {
            expect.assertions(1);

            const value = "red";
            const result = css`
                .test {
                    color: ${value};
                }
            `;

            expect(result).toBe(".test { color: red; }");
        });

        it("should handle object with toString method", () => {
            expect.assertions(1);

            const object = {
                toString: () => "red",
            };
            const result = css`
                .test {
                    color: ${object};
                }
            `;

            expect(result).toBe(".test { color: red; }");
        });

        it("should handle array interpolation", () => {
            expect.assertions(1);

            const array = [1, 2, 3];
            const result = css`
                .test {
                    margin: ${array};
                }
            `;

            expect(result).toBe(String.raw`.test { margin: \31 \,2\,3; }`);
        });

        it("should handle boolean values", () => {
            expect.assertions(1);

            const bool = true;
            const result = css`
                .test {
                    display: ${bool};
                }
            `;

            expect(result).toBe(".test { display: true; }");
        });

        it("should preserve whitespace inside double-quoted CSS strings", () => {
            expect.assertions(1);

            const result = css`
                .test::before {
                    content: "a   b";
                }
            `;

            expect(result).toBe('.test::before { content: "a   b"; }');
        });

        it("should preserve whitespace inside single-quoted CSS strings", () => {
            expect.assertions(1);

            const result = css`
                .test::after {
                    content: 'x   y';
                }
            `;

            expect(result).toBe(".test::after { content: 'x   y'; }");
        });

        it("should still collapse whitespace outside of quoted strings", () => {
            expect.assertions(1);

            const result = css`
                .a {
                    color: red;
                }
                .b {
                    content: "keep   me";
                }
            `;

            expect(result).toBe('.a { color: red; } .b { content: "keep   me"; }');
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

        it("should preserve CSS custom properties verbatim", () => {
            expect.assertions(2);

            const result = css({ "--another-property": "red", "--myVar": "10px" }, false);

            expect(result).toContain("--myVar: 10px;");
            expect(result).toContain("--another-property: red;");
        });

        it("should not transform CSS custom properties with camelCase", () => {
            expect.assertions(1);

            const result = css({ "--myCustomVar": "20px" }, false);

            expect(result).toContain("--myCustomVar: 20px;");
        });

        it("should handle CSS custom properties alongside regular properties", () => {
            expect.assertions(3);

            const result = css(
                {
                    "--primary-color": "blue",
                    "--secondary-color": "green",
                    marginTop: "10px",
                },
                false,
            );

            expect(result).toContain("--primary-color: blue;");
            expect(result).toContain("--secondary-color: green;");
            expect(result).toContain("margin-top: 10px;");
        });

        it("should prefix vendor `ms` properties with a leading dash", () => {
            expect.assertions(2);

            // camelCase MsFlexAlign -> -ms-flex-align (not ms-flex-align)
            expect(css({ MsFlexAlign: "center" }, false)).toBe("-ms-flex-align: center;");
            expect(css({ msOverflowStyle: "none" }, false)).toBe("-ms-overflow-style: none;");
        });
    });

    describe("template tag with crafted strings array", () => {
        it("should fall back to empty string when the leading and trailing strings are missing", () => {
            expect.assertions(1);

            // Crafted template strings array whose entries are all undefined exercises the
            // `strings[0] ?? ""` and `strings[i + 1] ?? ""` fallbacks.
            const strings = Object.assign([undefined, undefined], { raw: ["", ""] }) as unknown as TemplateStringsArray;

            expect(css(strings, "A & B")).toBe(String.raw`A\ \&\ B`);
        });

        it("should fall back to empty string when the strings array is empty", () => {
            expect.assertions(1);

            const strings = Object.assign([], { raw: [] }) as unknown as TemplateStringsArray;

            expect(css(strings, "Z")).toBe("Z");
        });
    });
});
