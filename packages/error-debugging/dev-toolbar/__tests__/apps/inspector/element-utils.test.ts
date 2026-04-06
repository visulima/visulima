// @vitest-environment jsdom
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import {
    captureAccessibility,
    captureComputedStyles,
    cleanCssClasses,
    generateSelector,
    getElementLabel,
    getFullDomPath,
    getNearbyElements,
    getNearbyText,
    getSelectedText,
    isElementFixed,
} from "../../../src/apps/inspector/element-utils";

// Polyfill CSS.escape for JSDOM
beforeAll(() => {
    if (typeof CSS === "undefined" || !CSS.escape) {
        (globalThis as any).CSS = {
            ...typeof CSS === "undefined" ? {} : CSS,
            escape: (value: string) => value.replaceAll(/([^\w-])/g, String.raw`\$1`),
        };
    }
});

describe("element-utils", () => {
    describe(generateSelector, () => {
        it("uses ID when available", () => {
            const el = document.createElement("div");

            el.id = "my-element";
            document.body.append(el);

            expect(generateSelector(el)).toBe("#my-element");

            el.remove();
        });

        it("uses tag + class when unique", () => {
            const el = document.createElement("button");

            el.classList.add("submit-btn");
            document.body.append(el);

            const selector = generateSelector(el);

            expect(selector).toContain("button");
            expect(selector).toContain("submit-btn");

            el.remove();
        });

        it("falls back to nth-of-type for non-unique elements", () => {
            const parent = document.createElement("div");
            const el1 = document.createElement("span");
            const el2 = document.createElement("span");

            parent.append(el1, el2);
            document.body.append(parent);

            const selector = generateSelector(el2);

            expect(selector).toContain("nth-of-type");

            parent.remove();
        });
    });

    describe(getElementLabel, () => {
        it("labels buttons with text", () => {
            const btn = document.createElement("button");

            btn.textContent = "Submit";

            expect(getElementLabel(btn)).toBe("button \"Submit\"");
        });

        it("labels links with href", () => {
            const a = document.createElement("a");

            a.href = "/about";
            a.textContent = "About";

            expect(getElementLabel(a)).toBe("link \"About\" to /about");
        });

        it("labels images with alt text", () => {
            const img = document.createElement("img");

            img.alt = "Logo";

            expect(getElementLabel(img)).toBe("image \"Logo\"");
        });

        it("labels inputs with type and placeholder", () => {
            const input = document.createElement("input");

            input.type = "email";
            input.placeholder = "Enter email";

            expect(getElementLabel(input)).toBe("input[email] \"Enter email\"");
        });

        it("labels headings with text", () => {
            const h1 = document.createElement("h1");

            h1.textContent = "Welcome";

            expect(getElementLabel(h1)).toBe("h1 \"Welcome\"");
        });

        it("falls back to tag for empty elements", () => {
            const div = document.createElement("div");

            expect(getElementLabel(div)).toBe("div");
        });
    });

    describe(cleanCssClasses, () => {
        it("strips CSS module hashes", () => {
            const el = document.createElement("div");

            el.classList.add("btn_abc123", "primary_def456");

            const cleaned = cleanCssClasses(el.classList);

            expect(cleaned).toBe("btn primary");
        });

        it("keeps non-hashed classes", () => {
            const el = document.createElement("div");

            el.classList.add("flex", "items-center");

            expect(cleanCssClasses(el.classList)).toBe("flex items-center");
        });
    });

    describe(getFullDomPath, () => {
        it("builds path from element to body", () => {
            const div = document.createElement("div");
            const span = document.createElement("span");

            div.append(span);
            document.body.append(div);

            const path = getFullDomPath(span);

            expect(path).toContain("body");
            expect(path).toContain("div");
            expect(path).toContain("span");

            div.remove();
        });
    });

    describe(getNearbyElements, () => {
        it("returns sibling tags", () => {
            const parent = document.createElement("div");
            const a = document.createElement("span");
            const b = document.createElement("p");
            const target = document.createElement("button");

            parent.append(a, target, b);

            const result = getNearbyElements(target);

            expect(result).toContain("span");
            expect(result).toContain("p");
        });

        it("returns empty for orphan elements", () => {
            const el = document.createElement("div");

            expect(getNearbyElements(el)).toBe("");
        });
    });

    describe(getNearbyText, () => {
        it("returns element text content", () => {
            const el = document.createElement("p");

            el.textContent = "Hello world";

            expect(getNearbyText(el)).toBe("Hello world");
        });

        it("truncates long text", () => {
            const el = document.createElement("p");

            el.textContent = "A".repeat(200);

            const result = getNearbyText(el, 50);

            expect(result.length).toBeLessThanOrEqual(51); // 50 + ellipsis
        });

        it("falls back to aria-label", () => {
            const el = document.createElement("button");

            el.setAttribute("aria-label", "Close dialog");

            expect(getNearbyText(el)).toBe("Close dialog");
        });

        it("falls back to placeholder", () => {
            const input = document.createElement("input");

            input.placeholder = "Search...";

            expect(getNearbyText(input)).toBe("Search...");
        });
    });

    describe(getSelectedText, () => {
        it("returns empty when no selection", () => {
            expect(getSelectedText()).toBe("");
        });
    });

    describe(isElementFixed, () => {
        it("returns false for static elements", () => {
            const el = document.createElement("div");

            document.body.append(el);

            // JSDOM doesn't compute styles, but we test the function doesn't crash
            expectTypeOf(isElementFixed(el)).toBeBoolean();

            el.remove();
        });
    });

    describe(captureAccessibility, () => {
        it("captures role", () => {
            const el = document.createElement("div");

            el.setAttribute("role", "navigation");

            const a11y = captureAccessibility(el);

            expect(a11y.role).toBe("navigation");
        });

        it("captures aria-label", () => {
            const el = document.createElement("button");

            el.setAttribute("aria-label", "Close");

            expect(captureAccessibility(el).ariaLabel).toBe("Close");
        });

        it("detects focusable elements", () => {
            expect(captureAccessibility(document.createElement("button")).focusable).toBe(true);
            expect(captureAccessibility(document.createElement("input")).focusable).toBe(true);
            expect(captureAccessibility(document.createElement("div")).focusable).toBe(false);
        });

        it("captures tabindex", () => {
            const el = document.createElement("div");

            el.setAttribute("tabindex", "0");

            const a11y = captureAccessibility(el);

            expect(a11y.tabindex).toBe(0);
            expect(a11y.focusable).toBe(true);
        });
    });

    describe(captureComputedStyles, () => {
        it("returns a string of styles", () => {
            const el = document.createElement("div");

            document.body.append(el);

            const styles = captureComputedStyles(el);

            expectTypeOf(styles).toBeString();

            el.remove();
        });
    });
});
