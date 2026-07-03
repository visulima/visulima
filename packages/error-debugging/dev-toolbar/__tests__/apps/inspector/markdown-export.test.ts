// @vitest-environment node
import { describe, expect, it } from "vitest";

import { annotationsToMarkdown } from "../../../src/apps/inspector/element-utils";

const makeAnnotation = (overrides = {}) => {
    return {
        comment: "Fix the padding",
        elementTag: "button",
        intent: "fix",
        severity: "important",
        status: "pending",
        url: "/page",
        ...overrides,
    };
};

describe(annotationsToMarkdown, () => {
    it("returns 'no annotations' message for empty array", () => {
        expect.assertions(1);

        const md = annotationsToMarkdown([]);

        expect(md).toContain("No annotations found");
    });

    describe("compact format", () => {
        it("outputs one line per annotation", () => {
            expect.assertions(1);

            const md = annotationsToMarkdown([makeAnnotation()], "compact");

            expect(md).toContain("- **button:** Fix the padding");
        });

        it("includes selected text", () => {
            expect.assertions(1);

            const md = annotationsToMarkdown([makeAnnotation({ selectedText: "some selected text" })], "compact");

            expect(md).toContain(`(re: "some selected tex`);
        });

        it("uses elementLabel when available", () => {
            expect.assertions(1);

            const md = annotationsToMarkdown([makeAnnotation({ elementLabel: "button \"Submit\"" })], "compact");

            expect(md).toContain("**button \"Submit\":**");
        });
    });

    describe("standard format", () => {
        it("includes status and URL", () => {
            expect.assertions(2);

            const md = annotationsToMarkdown([makeAnnotation()], "standard");

            expect(md).toContain("**Status:** pending");
            expect(md).toContain("**URL:** /page");
        });

        it("includes selector", () => {
            expect.assertions(1);

            const md = annotationsToMarkdown([makeAnnotation({ elementPath: "#submit-btn" })], "standard");

            expect(md).toContain("**Selector:** `#submit-btn`");
        });

        it("includes source", () => {
            expect.assertions(1);

            const md = annotationsToMarkdown([makeAnnotation({ source: "src/App.tsx:42:10" })], "standard");

            expect(md).toContain("**Source:** `src/App.tsx:42:10`");
        });

        it("includes framework context", () => {
            expect.assertions(3);

            const md = annotationsToMarkdown(
                [
                    makeAnnotation({
                        frameworkContext: {
                            componentName: "Button",
                            componentStack: ["App", "Layout", "Button"],
                            framework: "react",
                            sourceFile: "src/Button.tsx",
                            sourceLine: 10,
                        },
                    }),
                ],
                "standard",
            );

            expect(md).toContain("**Component:** Button (react)");
            expect(md).toContain("**Stack:** App > Layout > Button");
            expect(md).toContain("**File:** `src/Button.tsx:10`");
        });

        it("does NOT include detailed fields", () => {
            expect.assertions(3);

            const md = annotationsToMarkdown(
                [makeAnnotation({ computedStyles: "color: red", cssClasses: "btn primary", fullPath: "body > div > button" })],
                "standard",
            );

            expect(md).not.toContain("**Classes:**");
            expect(md).not.toContain("**DOM Path:**");
            expect(md).not.toContain("**Styles:**");
        });
    });

    describe("detailed format", () => {
        it("includes classes, context, DOM path", () => {
            expect.assertions(3);

            const md = annotationsToMarkdown(
                [makeAnnotation({ cssClasses: "btn primary", fullPath: "body > div > button", nearbyText: "Click here" })],
                "detailed",
            );

            expect(md).toContain("**Classes:** `btn primary`");
            expect(md).toContain("**DOM Path:** `body > div > button`");
            expect(md).toContain("**Context:** Click here");
        });

        it("does NOT include forensic fields", () => {
            expect.assertions(3);

            const md = annotationsToMarkdown(
                [makeAnnotation({ accessibility: { focusable: true, role: "button" }, computedStyles: "color: red", nearbyElements: "span, div" })],
                "detailed",
            );

            expect(md).not.toContain("**Styles:**");
            expect(md).not.toContain("**Nearby:**");
            expect(md).not.toContain("**Role:**");
        });
    });

    describe("forensic format", () => {
        it("includes everything", () => {
            expect.assertions(6);

            const md = annotationsToMarkdown(
                [
                    makeAnnotation({
                        accessibility: { focusable: true, role: "button" },
                        computedStyles: "color: red; font-size: 14px",
                        cssClasses: "btn",
                        fullPath: "body > main > button",
                        nearbyElements: "span, div, a",
                        nearbyText: "Submit form",
                    }),
                ],
                "forensic",
            );

            expect(md).toContain("**Role:** button");
            expect(md).toContain("**Nearby:** span, div, a");
            expect(md).toContain("**Styles:** `color: red; font-size: 14px`");
            expect(md).toContain("**Classes:** `btn`");
            expect(md).toContain("**DOM Path:**");
            expect(md).toContain("**Context:** Submit form");
        });
    });

    it("defaults to standard format", () => {
        expect.assertions(1);

        const md = annotationsToMarkdown([makeAnnotation({ elementPath: "#btn" })]);

        expect(md).toContain("**Selector:** `#btn`");
    });

    it("handles multiple annotations", () => {
        expect.assertions(3);

        const md = annotationsToMarkdown([makeAnnotation({ comment: "First" }), makeAnnotation({ comment: "Second" })]);

        expect(md).toContain("2 annotation(s)");
        expect(md).toContain("First");
        expect(md).toContain("Second");
    });
});
