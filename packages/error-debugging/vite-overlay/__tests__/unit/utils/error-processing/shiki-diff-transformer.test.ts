/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Element } from "hast";
import { describe, expect, it, vi } from "vitest";

import shikiDiffTransformer from "../../../../src/utils/error-processing/shiki-diff-transformer";

/**
 * Build a Shiki-like AST line element with one inner span containing a single text node.
 */
const makeLine = (text: string): Element => ({
    children: [
        {
            children: [{ type: "text", value: text }],
            properties: {},
            tagName: "span",
            type: "element",
        } as Element,
    ],
    properties: {},
    tagName: "span",
    type: "element",
});

const makeCodeAst = (lines: string[]): Element => ({
    children: lines.map((l) => makeLine(l)),
    properties: {},
    tagName: "code",
    type: "element",
});

/**
 * Returns a fake `this` object that satisfies the small subset of the Shiki
 * transformer API the diff transformer relies on (`addClassToHast` + `pre`).
 */
const makeContext = () => {
    const addedClasses: Array<{ classes: string; target: string }> = [];
    const pre = { tagName: "pre", type: "element" } as Element;

    const context = {
        addClassToHast: vi.fn((target: Element, classes: string) => {
            addedClasses.push({ classes, target: target.tagName });
        }),
        pre,
    };

    return { addedClasses, context };
};

describe(shikiDiffTransformer, () => {
    it("returns a transformer with the expected name and a code hook", () => {
        expect.assertions(2);

        const transformer = shikiDiffTransformer();

        expect(transformer.name).toBe("shiki-diff");
        expect(typeof transformer.code).toBe("function");
    });

    it("tags lines beginning with [!code ++] as additions and strips the marker", () => {
        expect.assertions(3);

        const transformer = shikiDiffTransformer();
        const ast = makeCodeAst(["[!code ++] const x = 1;"]);
        const { addedClasses, context } = makeContext();

        transformer.code!.call(context as any, ast);

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

        transformer.code!.call(context as any, ast);

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

        transformer.code!.call(context as any, ast);

        expect(addedClasses.some((c) => c.classes === "x-pre")).toBe(true);
        expect(addedClasses.some((c) => c.classes === "x-add")).toBe(true);
        expect(addedClasses.some((c) => c.classes === "x-rem")).toBe(true);
    });

    it("filters out non-element top-level children before processing inner spans", () => {
        expect.assertions(2);

        const transformer = shikiDiffTransformer();
        const line: Element = {
            children: [{ children: [{ type: "text", value: "[!code ++] kept" }], properties: {}, tagName: "span", type: "element" } as Element],
            properties: {},
            tagName: "span",
            type: "element",
        };
        const ast: Element = {
            children: [{ type: "text", value: "noise" } as any, line],
            properties: {},
            tagName: "code",
            type: "element",
        };
        const { addedClasses, context } = makeContext();

        transformer.code!.call(context as any, ast);

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

        transformer.code!.call(context as any, ast);

        const inner = (ast.children[0] as Element).children[0] as Element;
        const textNode = inner.children[0] as { value: string };

        expect(textNode.value).toBe("const untouched = true;");
        // The has-diff class on the pre is added unconditionally, but no add/remove tags should be added.
        expect(addedClasses.filter((c) => c.classes.startsWith("diff "))).toHaveLength(0);
    });
});
