import type { Element } from "hast";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import shikiDiffTransformer from "../../../../src/utils/error-processing/shiki-diff-transformer";

/**
 * Build a Shiki-like AST line element with one inner span containing a single text node.
 */
const makeLine = (text: string): Element => {
    return {
        children: [
            {
                children: [{ type: "text", value: text }],
                properties: {},
                tagName: "span",
                type: "element",
            },
        ],
        properties: {},
        tagName: "span",
        type: "element",
    };
};

const makeCodeAst = (lines: string[]): Element => {
    return {
        children: lines.map((l) => makeLine(l)),
        properties: {},
        tagName: "code",
        type: "element",
    };
};

/**
 * Returns a fake `this` object that satisfies the small subset of the Shiki
 * transformer API the diff transformer relies on (`addClassToHast` + `pre`).
 */
const makeContext = () => {
    const addedClasses: { classes: string; target: string }[] = [];
    const pre = { tagName: "pre", type: "element" } as Element;

    const context = {
        addClassToHast: vi.fn((target: Element, classes: string) => {
            addedClasses.push({ classes, target: target.tagName });
        }),
        pre,
    };

    return { addedClasses, context };
};

const runCode = (transformer: ReturnType<typeof shikiDiffTransformer>, context: ReturnType<typeof makeContext>["context"], ast: Element): void => {
    const code = transformer.code as NonNullable<typeof transformer.code>;

    code.call(context as unknown as ThisParameterType<typeof code>, ast);
};

describe(shikiDiffTransformer, () => {
    it("returns a transformer with the expected name and a code hook", () => {
        expect.assertions(1);

        const transformer = shikiDiffTransformer();

        expect(transformer.name).toBe("shiki-diff");

        expectTypeOf(transformer.code).toBeFunction();
    });

    it("tags lines beginning with [!code ++] as additions and strips the marker", () => {
        expect.assertions(3);

        const transformer = shikiDiffTransformer();
        const ast = makeCodeAst(["[!code ++] const x = 1;"]);
        const { addedClasses, context } = makeContext();

        runCode(transformer, context, ast);

        const inner = (ast.children[0] as Element).children[0] as Element;
        const textNode = inner.children[0] as { type: string; value: string };

        expect(textNode.value).toBe(" const x = 1;");
        expect(addedClasses.some((c) => c.target === "pre" && c.classes === "has-diff")).toBe(true);
        expect(addedClasses.some((c) => c.target === "span" && c.classes === "diff add")).toBe(true);
    });

    it("tags lines beginning with [!code --] as removals", () => {
        expect.assertions(2);

        const transformer = shikiDiffTransformer();
        const ast = makeCodeAst(["[!code --] gone();"]);
        const { addedClasses, context } = makeContext();

        runCode(transformer, context, ast);

        const inner = (ast.children[0] as Element).children[0] as Element;
        const textNode = inner.children[0] as { type: string; value: string };

        expect(textNode.value).toBe(" gone();");
        expect(addedClasses.some((c) => c.classes === "diff remove")).toBe(true);
    });

    it("supports custom class names", () => {
        expect.assertions(3);

        const transformer = shikiDiffTransformer({
            classActivePre: "x-pre",
            classLineAdd: "x-add",
            classLineRemove: "x-rem",
        });
        const ast = makeCodeAst(["[!code ++] a", "[!code --] b"]);
        const { addedClasses, context } = makeContext();

        runCode(transformer, context, ast);

        expect(addedClasses.some((c) => c.classes === "x-pre")).toBe(true);
        expect(addedClasses.some((c) => c.classes === "x-add")).toBe(true);
        expect(addedClasses.some((c) => c.classes === "x-rem")).toBe(true);
    });

    it("filters out non-element top-level children before processing inner spans", () => {
        expect.assertions(2);

        const transformer = shikiDiffTransformer();
        const line: Element = {
            children: [{ children: [{ type: "text", value: "[!code ++] kept" }], properties: {}, tagName: "span", type: "element" }],
            properties: {},
            tagName: "span",
            type: "element",
        };
        const ast: Element = {
            children: [{ type: "text", value: "noise" }, line],
            properties: {},
            tagName: "code",
            type: "element",
        };
        const { addedClasses, context } = makeContext();

        runCode(transformer, context, ast);

        // The kept span should still be processed (top-level text was filtered out).
        const keptText = (line.children[0] as Element).children[0] as { value: string };

        expect(keptText.value).toBe(" kept");
        expect(addedClasses.some((c) => c.classes === "diff add")).toBe(true);
    });

    it("leaves plain text alone when no marker is present", () => {
        expect.assertions(2);

        const transformer = shikiDiffTransformer();
        const ast = makeCodeAst(["const untouched = true;"]);
        const { addedClasses, context } = makeContext();

        runCode(transformer, context, ast);

        const inner = (ast.children[0] as Element).children[0] as Element;
        const textNode = inner.children[0] as { value: string };

        expect(textNode.value).toBe("const untouched = true;");
        // The has-diff class on the pre is added unconditionally, but no add/remove tags should be added.
        expect(addedClasses.filter((c) => c.classes.startsWith("diff "))).toHaveLength(0);
    });

    it("skips non-element children inside a line", () => {
        expect.assertions(1);

        const transformer = shikiDiffTransformer();
        // A line whose children include a raw text node (not an element) that must be skipped.
        const line: Element = {
            children: [
                { type: "text", value: "[!code ++] should be ignored at this level" },
                { children: [{ type: "text", value: "plain span" }], properties: {}, tagName: "span", type: "element" },
            ],
            properties: {},
            tagName: "span",
            type: "element",
        };
        const ast: Element = {
            children: [line],
            properties: {},
            tagName: "code",
            type: "element",
        };
        const { addedClasses, context } = makeContext();

        runCode(transformer, context, ast);

        // The non-element child is skipped (continue), so no add/remove class is applied.
        expect(addedClasses.filter((c) => c.classes.startsWith("diff "))).toHaveLength(0);
    });

    it("skips element children whose first child is not a text node", () => {
        expect.assertions(1);

        const transformer = shikiDiffTransformer();
        // The inner span's first child is itself an element rather than a text node.
        const line: Element = {
            children: [
                {
                    children: [{ children: [], properties: {}, tagName: "em", type: "element" }],
                    properties: {},
                    tagName: "span",
                    type: "element",
                },
            ],
            properties: {},
            tagName: "span",
            type: "element",
        };
        const ast: Element = {
            children: [line],
            properties: {},
            tagName: "code",
            type: "element",
        };
        const { addedClasses, context } = makeContext();

        runCode(transformer, context, ast);

        // The element child has no text first child, so it is skipped (continue).
        expect(addedClasses.filter((c) => c.classes.startsWith("diff "))).toHaveLength(0);
    });
});
