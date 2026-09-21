// @vitest-environment jsdom
import "../../setup";

import { afterEach, describe, expect, it } from "vitest";

import { collectVariablesFromRules, isRootSelector, scanRootVariables } from "../../../src/apps/tailwind/analyze";

const addStyle = (css: string): HTMLStyleElement => {
    const element = document.createElement("style");

    element.textContent = css;
    document.head.append(element);

    return element;
};

afterEach(() => {
    for (const element of document.querySelectorAll("style")) {
        element.remove();
    }
});

describe(isRootSelector, () => {
    it("accepts :root and html", () => {
        expect.hasAssertions();

        expect(isRootSelector(":root")).toBe(true);
        expect(isRootSelector("html")).toBe(true);
    });

    it("accepts a comma list containing one, ignoring whitespace", () => {
        expect.hasAssertions();

        expect(isRootSelector("  .theme-dark ,  :root ")).toBe(true);
    });

    it("rejects a selector that merely mentions root", () => {
        expect.hasAssertions();

        expect(isRootSelector(":root .nested")).toBe(false);
        expect(isRootSelector(".sidebar")).toBe(false);
    });
});

describe(collectVariablesFromRules, () => {
    it("reads custom properties off a :root rule", () => {
        expect.hasAssertions();

        const style = addStyle(":root { --color-red-500: #ef4444; --spacing-4: 1rem; }");
        const variables = new Map<string, string>();

        collectVariablesFromRules((style.sheet as CSSStyleSheet).cssRules, variables);

        expect([...variables]).toStrictEqual([
            ["--color-red-500", "#ef4444"],
            ["--spacing-4", "1rem"],
        ]);
    });

    it("recurses into @layer, which is where Tailwind v4 puts the theme", () => {
        expect.hasAssertions();

        const style = addStyle("@layer theme { :root { --color-blue-500: #3b82f6; } }");
        const variables = new Map<string, string>();

        collectVariablesFromRules((style.sheet as CSSStyleSheet).cssRules, variables);

        expect(variables.get("--color-blue-500")).toBe("#3b82f6");
    });

    it("recurses into @media too", () => {
        expect.hasAssertions();

        const style = addStyle("@media (min-width: 0px) { :root { --spacing-2: 0.5rem; } }");
        const variables = new Map<string, string>();

        collectVariablesFromRules((style.sheet as CSSStyleSheet).cssRules, variables);

        expect(variables.get("--spacing-2")).toBe("0.5rem");
    });

    it("skips Tailwind's internal --tw- properties and the --brand- namespace", () => {
        expect.hasAssertions();

        const style = addStyle(":root { --tw-ring-color: red; --brand-primary: blue; --color-ok: green; }");
        const variables = new Map<string, string>();

        collectVariablesFromRules((style.sheet as CSSStyleSheet).cssRules, variables);

        expect([...variables.keys()]).toStrictEqual(["--color-ok"]);
    });

    it("ignores declarations outside a root rule", () => {
        expect.hasAssertions();

        const style = addStyle(".card { --color-nope: #000; }");
        const variables = new Map<string, string>();

        collectVariablesFromRules((style.sheet as CSSStyleSheet).cssRules, variables);

        expect(variables.size).toBe(0);
    });
});

describe(scanRootVariables, () => {
    it("merges every stylesheet in the document", () => {
        expect.hasAssertions();

        addStyle(":root { --color-a: #aaa; }");
        addStyle("@layer theme { html { --color-b: #bbb; } }");

        const variables = scanRootVariables();

        expect(variables.get("--color-a")).toBe("#aaa");
        expect(variables.get("--color-b")).toBe("#bbb");
    });
});
