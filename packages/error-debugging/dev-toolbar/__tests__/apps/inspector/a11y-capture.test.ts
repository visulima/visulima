// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { captureA11yInfo, formatA11yText } from "../../../src/apps/inspector/a11y-capture";

describe(captureA11yInfo, () => {
    describe("role", () => {
        it("returns role when present", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.setAttribute("role", "navigation");

            expect(captureA11yInfo(element).role).toBe("navigation");
        });

        it("returns null when no role", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            expect(captureA11yInfo(element).role).toBeNull();
        });
    });

    describe("aria attributes", () => {
        it("captures all aria-* attributes", () => {
            expect.assertions(1);

            const element = document.createElement("button");

            element.setAttribute("aria-expanded", "true");
            element.setAttribute("aria-haspopup", "listbox");
            element.setAttribute("aria-label", "Open menu");

            const info = captureA11yInfo(element);

            expect(info.ariaAttributes).toStrictEqual({
                "aria-expanded": "true",
                "aria-haspopup": "listbox",
                "aria-label": "Open menu",
            });
        });

        it("returns empty object when no aria attributes", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.setAttribute("class", "foo");
            element.setAttribute("id", "bar");

            expect(captureA11yInfo(element).ariaAttributes).toStrictEqual({});
        });

        it("ignores non-aria attributes", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.dataset.ariaTest = "value";
            element.setAttribute("aria-hidden", "true");

            expect(captureA11yInfo(element).ariaAttributes).toStrictEqual({
                "aria-hidden": "true",
            });
        });
    });

    describe("tabindex", () => {
        it("captures tabindex as number", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.setAttribute("tabindex", "0");

            expect(captureA11yInfo(element).tabindex).toBe(0);
        });

        it("captures negative tabindex", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.setAttribute("tabindex", "-1");

            expect(captureA11yInfo(element).tabindex).toBe(-1);
        });

        it("returns null when no tabindex", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            expect(captureA11yInfo(element).tabindex).toBeNull();
        });
    });

    describe("focusability", () => {
        it("button is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("button");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });

        it("input is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("input");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });

        it("select is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("select");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });

        it("textarea is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("textarea");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });

        it("anchor is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("a");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });

        it("details is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("details");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });

        it("summary is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("summary");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });

        it("disabled button is not focusable", () => {
            expect.assertions(1);

            const element = document.createElement("button");

            element.setAttribute("disabled", "");

            expect(captureA11yInfo(element).focusable).toBe(false);
        });

        it("disabled input is not focusable", () => {
            expect.assertions(1);

            const element = document.createElement("input");

            element.setAttribute("disabled", "");

            expect(captureA11yInfo(element).focusable).toBe(false);
        });

        it("div is not focusable by default", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            expect(captureA11yInfo(element).focusable).toBe(false);
        });

        it("div with tabindex=0 is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.setAttribute("tabindex", "0");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });

        it("div with tabindex=-1 is not focusable", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.setAttribute("tabindex", "-1");

            expect(captureA11yInfo(element).focusable).toBe(false);
        });

        it("contenteditable element is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.setAttribute("contenteditable", "true");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });

        it("contenteditable=false is not focusable", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.setAttribute("contenteditable", "false");

            expect(captureA11yInfo(element).focusable).toBe(false);
        });

        it("contenteditable (empty value) is focusable", () => {
            expect.assertions(1);

            const element = document.createElement("div");

            element.setAttribute("contenteditable", "");

            expect(captureA11yInfo(element).focusable).toBe(true);
        });
    });

    describe("combined attributes", () => {
        it("captures role, aria, tabindex, and focusability together", () => {
            expect.assertions(4);

            const element = document.createElement("div");

            element.setAttribute("role", "listbox");
            element.setAttribute("aria-multiselectable", "true");
            element.setAttribute("aria-label", "Options");
            element.setAttribute("tabindex", "0");

            const info = captureA11yInfo(element);

            expect(info.role).toBe("listbox");
            expect(info.ariaAttributes).toStrictEqual({
                "aria-label": "Options",
                "aria-multiselectable": "true",
            });
            expect(info.tabindex).toBe(0);
            expect(info.focusable).toBe(true);
        });
    });
});

describe(formatA11yText, () => {
    it("formats role and focusable", () => {
        expect.assertions(1);

        const text = formatA11yText({
            ariaAttributes: {},
            focusable: true,
            role: "button",
            tabindex: null,
        });

        expect(text).toBe("role: button\nfocusable: true");
    });

    it("includes tabindex when present", () => {
        expect.assertions(1);

        const text = formatA11yText({
            ariaAttributes: {},
            focusable: true,
            role: null,
            tabindex: 0,
        });

        expect(text).toBe("focusable: true\ntabindex: 0");
    });

    it("includes aria attributes", () => {
        expect.assertions(1);

        const text = formatA11yText({
            ariaAttributes: {
                "aria-expanded": "false",
                "aria-label": "Menu",
            },
            focusable: false,
            role: "menu",
            tabindex: null,
        });

        expect(text).toBe("role: menu\nfocusable: false\naria-expanded: false\naria-label: Menu");
    });

    it("minimal output for plain div", () => {
        expect.assertions(1);

        const text = formatA11yText({
            ariaAttributes: {},
            focusable: false,
            role: null,
            tabindex: null,
        });

        expect(text).toBe("focusable: false");
    });
});
