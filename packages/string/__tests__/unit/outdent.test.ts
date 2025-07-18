import { describe, expect, it } from "vitest";

import { outdent } from "../../src";

// Helper function to create template strings array
const makeStrings = (...strings: string[]): TemplateStringsArray => {
    // eslint-disable-next-line no-param-reassign
    (strings as any as { raw: ReadonlyArray<string> }).raw = strings;

    return strings as any as TemplateStringsArray;
};

describe(outdent, () => {
    it("should remove indentation from a template literal", () => {
        expect.assertions(1);

        const result = outdent`
            Hello
            World
        `;

        expect(result).toBe("Hello\nWorld");
    });

    it("should handle interpolated values", () => {
        expect.assertions(1);

        const name = "User";
        const result = outdent`
            Hello ${name}
            Welcome to the world
        `;

        expect(result).toBe("Hello User\nWelcome to the world");
    });

    it("should handle empty strings", () => {
        expect.assertions(1);

        const result = outdent`

        `;

        expect(result).toBe("");
    });

    it("should handle strings with only whitespace", () => {
        expect.assertions(1);

        const result = outdent`
        
        `;

        expect(result).toBe("");
    });

    it("should accept lines shorter than indentation", () => {
        expect.assertions(1);

        const result = outdent`
                        Hello
            removed
                        World
        `;

        expect(result).toBe("Hello\n\nWorld");
    });

    it("should preserve trailing spaces on blank lines", () => {
        expect.assertions(1);

        const result = outdent`
            Hello

            World
        `;

        expect(result).toBe("Hello\n\nWorld");
    });

    it("should preserve indentation within the content", () => {
        expect.assertions(1);

        const result = outdent`
            Hello
              World
                !!!!
        `;

        expect(result).toBe("Hello\n  World\n    !!!!");
    });

    it("should preserve extra leading newlines", () => {
        expect.assertions(1);

        const result = outdent`

            Hello
            World
        `;

        expect(result).toBe("\nHello\nWorld");
    });

    it("should preserve extra trailing newlines", () => {
        expect.assertions(1);

        const result = outdent`
            Hello
            World

        `;

        expect(result).toBe("Hello\nWorld\n");
    });

    it("should remove non-whitespace characters in indentation columns", () => {
        expect.assertions(1);

        const result = outdent`
                                    Hello
            (this text is removed)  World
        `;

        expect(result).toBe("Hello\nWorld");
    });

    it("should handle different newline types", () => {
        expect.assertions(3);

        const unixResult = outdent(makeStrings("\n    Hello\n    world\n"));

        expect(unixResult).toBe("Hello\nworld");

        const windowsResult = outdent(makeStrings("\r\n    Hello\r\n    world\r\n"));

        expect(windowsResult).toBe("Hello\r\nworld");

        const macResult = outdent(makeStrings("\r    Hello\r    world\r"));

        expect(macResult).toBe("Hello\rworld");
    });

    it("should normalize newlines when specified", () => {
        expect.assertions(3);

        const mixedNewlines = makeStrings("\r Win\r\n Linux\n Mac\r .");

        const unixResult = outdent({ newline: "\n" })(mixedNewlines);

        expect(unixResult).toBe("Win\nLinux\nMac\n.");

        const windowsResult = outdent({ newline: "\r\n" })(mixedNewlines);

        expect(windowsResult).toBe("Win\r\nLinux\r\nMac\r\n.");

        const macResult = outdent({ newline: "\r" })(mixedNewlines);

        expect(macResult).toBe("Win\rLinux\rMac\r.");
    });

    it("should respect trimming options", () => {
        expect.assertions(1);

        const result = outdent({
            trimLeadingNewline: false,
            trimTrailingNewline: false,
        })`
            Test
        `;

        expect(result).toBe("\nTest\n");
    });

    it("should merge options objects", () => {
        expect.assertions(2);

        const customOutdent = outdent({ trimLeadingNewline: false })({ trimTrailingNewline: false });
        const result = customOutdent`

        `;

        expect(result).toBe("\n\n");

        const result2 = customOutdent({ trimLeadingNewline: true })`
            Hi
        `;

        expect(result2).toBe("Hi\n");
    });

    describe("string method", () => {
        it("should remove indentation from a string", () => {
            expect.assertions(1);

            const input = "\n    Hello\n    World\n";
            const result = outdent.string(input);

            expect(result).toBe("Hello\nWorld");
        });

        it("should handle empty string", () => {
            expect.assertions(1);
            expect(outdent.string("")).toBe("");
        });

        it("should preserve content before first newline", () => {
            expect.assertions(1);

            const result = outdent.string("Hello\n                world!\n");

            expect(result).toBe("Hello\nworld!");
        });

        it("should handle strings with no newlines", () => {
            expect.assertions(1);

            const result = outdent.string("Hello world!");

            expect(result).toBe("Hello world!");
        });

        it("should handle strings with no content after newline", () => {
            expect.assertions(1);

            const result = outdent.string("Hello world!\n");

            expect(result).toBe("Hello world!");
        });
    });

    it("should handle outdent reference in interpolation", () => {
        expect.assertions(2);

        const result = outdent`
            ${outdent}
                Some text
        `;

        expect(result).toBe("    Some text");

        const result2 = outdent`
                ${outdent}
            12345678
        `;

        expect(result2).toBe("5678");
    });

    it("should not get indentation from outdent when preceded by non-whitespace", () => {
        expect.assertions(3);

        const outdentAsString = outdent.toString();

        // eslint-disable-next-line unicorn/template-indent
        const result = outdent`non-whitespace
                              ${outdent}
                              Hello world!
        `;

        expect(result).toBe(`non-whitespace\n${outdentAsString}\nHello world!`);

        const result2 = outdent`
            foo${outdent}
               Hello world!
        `;

        expect(result2).toBe(`foo${outdentAsString}\n   Hello world!`);

        const result3 = outdent`
            ${outdent}foo
            Hello world!
        `;

        expect(result3).toBe(`${outdentAsString}foo\nHello world!`);
    });

    it("should maintain cache consistency", () => {
        expect.assertions(1);

        const template = outdent`
            Test
            Cache
        `;
        const repeated = outdent`
            Test
            Cache
        `;

        expect(template).toBe(repeated);
    });

    it("should handle complex interpolations", () => {
        expect.assertions(1);

        const object = { toString: () => "Object" };
        const result = outdent`
            Values:
            String: ${"text"}
            Number: ${42}
            Object: ${object}
        `;

        expect(result).toBe("Values:\nString: text\nNumber: 42\nObject: Object");
    });
});
